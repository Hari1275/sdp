import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import {
  errorResponse,
  getAuthenticatedUser,
  rateLimit,
  successResponse,
  logError,
} from "@/lib/api-utils";
import type { AuthenticatedUser } from "@/types/api";

function getScopedUserWhere(user: {
  id: string;
  role: UserRole;
  regionId?: string | null;
}) {
  switch (user.role) {
    case UserRole.MR:
      return { id: user.id } as Record<string, unknown>;
    case UserRole.LEAD_MR:
      return { OR: [{ id: user.id }, { leadMrId: user.id }] } as Record<
        string,
        unknown
      >;
    case UserRole.ADMIN:
    default:
      return {};
  }
}

export async function GET(request: NextRequest) {
  let user: AuthenticatedUser | null = null;
  try {
    if (!rateLimit(request)) {
      return errorResponse(
        "RATE_LIMIT_EXCEEDED",
        "Too many requests. Please try again later.",
        429
      );
    }

    user = await getAuthenticatedUser(request);
    if (!user) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo) : null;

    const scopedUserWhere = getScopedUserWhere({
      id: user.id,
      role: user.role as UserRole,
      regionId: user.regionId ?? null,
    });

    // Get all scoped users (both MR and Lead MR) needed for aggregation
    const scopedUsers = await prisma.user.findMany({
      where: scopedUserWhere,
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        leadMrId: true,
      },
    });
    const userIds = scopedUsers.map((u) => u.id);

    if (userIds.length === 0) {
      return successResponse({ mrs: [], leads: [] });
    }

    // Aggregations (optionally date-scoped)
    const sessionWhere: Record<string, unknown> = { userId: { in: userIds } };
    if (from || to) {
      sessionWhere.checkIn = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }
    const businessWhere: Record<string, unknown> = { mrId: { in: userIds } };
    if (from || to) {
      businessWhere.createdAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }
    const clientsWhere: Record<string, unknown> = { mrId: { in: userIds } };
    if (from || to) {
      clientsWhere.createdAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

    const [sessions, business, clients] = await Promise.all([
      prisma.gPSSession.groupBy({
        by: ["userId"],
        where: sessionWhere,
        _sum: { totalKm: true },
        _count: { userId: true },
      }),
      prisma.businessEntry.groupBy({
        by: ["mrId"],
        where: businessWhere,
        _sum: { amount: true },
        _count: { mrId: true },
      }),
      prisma.client.findMany({
        where: clientsWhere,
        select: { id: true, name: true, createdAt: true, mrId: true },
      }),
    ]);

    const mapKm = new Map<string, { totalKm: number; sessions: number }>(
      sessions.map((s) => [
        s.userId,
        { totalKm: s._sum.totalKm || 0, sessions: s._count.userId },
      ])
    );
    const mapBiz = new Map<string, { entries: number; amount: number }>(
      business.map((b) => [
        b.mrId,
        { entries: b._count.mrId, amount: b._sum.amount || 0 },
      ])
    );
    const mapClients = new Map<
      string,
      Array<{ id: string; name: string; date: string }>
    >();
    for (const c of clients) {
      const arr = mapClients.get(c.mrId) || [];
      arr.push({
        id: c.id,
        name: c.name,
        date: new Date(c.createdAt).toISOString(),
      });
      mapClients.set(c.mrId, arr);
    }

    // MR rows
    const mrs = scopedUsers
      .filter((u) => u.role === UserRole.MR)
      .map((u) => {
        const k = mapKm.get(u.id) || { totalKm: 0, sessions: 0 };
        const b = mapBiz.get(u.id) || { entries: 0, amount: 0 };
        const jc = mapClients.get(u.id) || [];
        return {
          userId: u.id,
          name: u.name,
          employeeId: u.username,
          designation: "MR",
          totalKm: Math.round((k.totalKm || 0) * 100) / 100,
          businessEntries: b.entries,
          businessAmount: Math.round((b.amount || 0) * 100) / 100,
          joinedClients: jc,
        };
      });

    // Lead MR rows with rollups
    const leadsSource = scopedUsers.filter((u) => u.role === UserRole.LEAD_MR);
    const leadIdToMembers = new Map<string, typeof mrs>();
    for (const mr of mrs) {
      const userRec = scopedUsers.find((u) => u.id === mr.userId);
      const lid = userRec?.leadMrId;
      if (lid) {
        const arr = leadIdToMembers.get(lid) || [];
        arr.push(mr);
        leadIdToMembers.set(lid, arr);
      }
    }

    const leads = leadsSource.map((l) => {
      const teamMembers = leadIdToMembers.get(l.id) || [];
      // Include lead's own travel in totalKm
      const leadKm = mapKm.get(l.id)?.totalKm || 0;
      const combinedKm =
        teamMembers.reduce((sum, m) => sum + (m.totalKm || 0), 0) + leadKm;
      const combinedBizEntries = teamMembers.reduce(
        (sum, m) => sum + (m.businessEntries || 0),
        0
      );
      const combinedBizAmount = teamMembers.reduce(
        (sum, m) => sum + (m.businessAmount || 0),
        0
      );
      const combinedJoined = teamMembers.flatMap((m) => m.joinedClients);

      return {
        userId: l.id,
        name: l.name,
        employeeId: l.username,
        teamMembers,
        totalKm: Math.round(combinedKm * 100) / 100,
        businessEntries: combinedBizEntries,
        businessAmount: Math.round(combinedBizAmount * 100) / 100,
        joinedClients: combinedJoined,
      };
    });

    return successResponse({ mrs, leads });
  } catch (error) {
    logError(error, "GET /api/reports/admin-overview", user?.id);
    return errorResponse(
      "INTERNAL_SERVER_ERROR",
      "Failed to load admin overview report",
      500
    );
  }
}
