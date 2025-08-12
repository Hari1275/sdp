import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole, TaskStatus } from "@prisma/client";
import {
  errorResponse,
  getAuthenticatedUser,
  logError,
  rateLimit,
  successResponse,
} from "@/lib/api-utils";
import type { AuthenticatedUser } from "@/types/api";

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
    const regionId = searchParams.get("region");

    const from = dateFrom
      ? new Date(dateFrom)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = dateTo ? new Date(dateTo) : new Date();

    // Determine user scope
    let scopedUserWhere: Record<string, unknown> = {};
    switch (user.role as UserRole) {
      case UserRole.MR:
        scopedUserWhere = { id: user.id };
        break;
      case UserRole.LEAD_MR:
        // Restrict to self and direct team only
        scopedUserWhere = {
          OR: [{ id: user.id }, { leadMrId: user.id }],
        };
        break;
      case UserRole.ADMIN:
      default:
        scopedUserWhere = {};
        break;
    }

    if (regionId) {
      // Only admins can arbitrarily filter by region; Lead MR scope is team/self-only
      if (user.role !== UserRole.ADMIN) {
        return errorResponse(
          "FORBIDDEN",
          "Only administrators can filter by arbitrary region",
          403
        );
      }
      scopedUserWhere = { ...scopedUserWhere, regionId };
    }

    const users = await prisma.user.findMany({
      where: scopedUserWhere,
      select: { id: true, name: true, username: true, regionId: true },
    });
    if (users.length === 0) {
      return successResponse({ data: [], total: 0 });
    }
    const userIds = users.map((u) => u.id);

    // Aggregate tasks assigned and completed
    const [tasksAssigned, tasksCompleted] = await Promise.all([
      prisma.task.groupBy({
        by: ["assigneeId"],
        where: {
          assigneeId: { in: userIds },
          createdAt: { gte: from, lte: to },
        },
        _count: { assigneeId: true },
      }),
      prisma.task.groupBy({
        by: ["assigneeId"],
        where: {
          assigneeId: { in: userIds },
          status: TaskStatus.COMPLETED,
          completedAt: { gte: from, lte: to },
        },
        _count: { assigneeId: true },
      }),
    ]);

    // Aggregate GPS sessions
    const sessions = await prisma.gPSSession.groupBy({
      by: ["userId"],
      where: {
        userId: { in: userIds },
        checkIn: { gte: from, lte: to },
      },
      _sum: { totalKm: true },
      _count: { userId: true },
    });

    // Aggregate business entries
    const business = await prisma.businessEntry.groupBy({
      by: ["mrId"],
      where: {
        mrId: { in: userIds },
        createdAt: { gte: from, lte: to },
      },
      _sum: { amount: true },
      _count: { mrId: true },
    });

    const mapAssigned = new Map(
      tasksAssigned.map((t) => [t.assigneeId, t._count.assigneeId])
    );
    const mapCompleted = new Map(
      tasksCompleted.map((t) => [t.assigneeId, t._count.assigneeId])
    );
    const mapSessions = new Map(
      sessions.map((s) => [
        s.userId,
        { totalKm: s._sum.totalKm || 0, totalSessions: s._count.userId },
      ])
    );
    const mapBusiness = new Map(
      business.map((b) => [
        b.mrId,
        { totalAmount: b._sum.amount || 0, entries: b._count.mrId },
      ])
    );

    const report = users.map((u) => {
      const assigned = mapAssigned.get(u.id) || 0;
      const completed = mapCompleted.get(u.id) || 0;
      const completionRate =
        assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
      const gps = mapSessions.get(u.id) || { totalKm: 0, totalSessions: 0 };
      const biz = mapBusiness.get(u.id) || { totalAmount: 0, entries: 0 };
      return {
        userId: u.id,
        name: u.name,
        username: u.username,
        regionId: u.regionId,
        tasksAssigned: assigned,
        tasksCompleted: completed,
        completionRate,
        totalKm: Math.round((gps.totalKm || 0) * 100) / 100,
        gpsSessions: gps.totalSessions || 0,
        businessEntries: biz.entries || 0,
        businessAmount: Math.round((biz.totalAmount || 0) * 100) / 100,
      };
    });

    report.sort((a, b) => b.completionRate - a.completionRate);

    return successResponse({
      data: report,
      total: report.length,
      dateRange: { from, to },
    });
  } catch (error) {
    logError(error, "GET /api/reports/user-performance", user?.id);
    return errorResponse(
      "INTERNAL_SERVER_ERROR",
      "Failed to load user performance report",
      500
    );
  }
}
