import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
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
    const clientId = searchParams.get("clientId");
    const regionId = searchParams.get("region");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const from = dateFrom
      ? new Date(dateFrom)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = dateTo ? new Date(dateTo) : new Date();

    // Role-based client scope
    let clientWhere: Record<string, unknown> = {};
    switch (user.role as UserRole) {
      case UserRole.MR:
        clientWhere = { mrId: user.id };
        break;
      case UserRole.LEAD_MR:
        clientWhere = {
          OR: [
            { regionId: user.regionId || undefined },
            { mr: { leadMrId: user.id } },
          ],
        };
        break;
      case UserRole.ADMIN:
      default:
        clientWhere = {};
        break;
    }

    if (clientId) {
      clientWhere = { ...clientWhere, id: clientId };
    }
    if (regionId) {
      if (user.role !== UserRole.ADMIN && user.regionId !== regionId) {
        return errorResponse(
          "FORBIDDEN",
          "You can only access your region data",
          403
        );
      }
      clientWhere = { ...clientWhere, regionId };
    }

    // Activity from BusinessEntry as proxy for interactions
    const entries = await prisma.businessEntry.findMany({
      where: {
        client: clientWhere,
        createdAt: { gte: from, lte: to },
      },
      select: {
        id: true,
        amount: true,
        createdAt: true,
        clientId: true,
        mrId: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const clientIds = Array.from(new Set(entries.map((e) => e.clientId)));
    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, name: true, areaId: true, regionId: true },
    });
    // MR details can be joined when needed for UI

    const summaryByClient = new Map<
      string,
      { amount: number; count: number }
    >();
    for (const e of entries) {
      const agg = summaryByClient.get(e.clientId) || { amount: 0, count: 0 };
      agg.amount += e.amount || 0;
      agg.count += 1;
      summaryByClient.set(e.clientId, agg);
    }

    const summary = Array.from(summaryByClient.entries()).map(([id, s]) => ({
      clientId: id,
      clientName: clients.find((c) => c.id === id)?.name || "Unknown",
      totalAmount: Math.round(s.amount * 100) / 100,
      interactions: s.count,
    }));

    return successResponse({
      entries,
      summary,
      dateRange: { from, to },
    });
  } catch (error) {
    logError(error, "GET /api/reports/client-activity", user?.id);
    return errorResponse(
      "INTERNAL_SERVER_ERROR",
      "Failed to load client activity report",
      500
    );
  }
}
