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

    // Only Lead MR and Admin can access
    if (user.role !== UserRole.LEAD_MR && user.role !== UserRole.ADMIN) {
      return errorResponse("FORBIDDEN", "Insufficient permissions", 403);
    }

    const { searchParams } = new URL(request.url);
    const regionIdParam = searchParams.get("region");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const from = dateFrom
      ? new Date(dateFrom)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = dateTo ? new Date(dateTo) : new Date();

    // Scope regions based on role
    let regionWhere: Record<string, unknown> = {};
    if (user.role === UserRole.LEAD_MR) {
      regionWhere = { id: user.regionId || undefined };
    }
    if (regionIdParam) {
      if (user.role === UserRole.LEAD_MR && regionIdParam !== user.regionId) {
        return errorResponse(
          "FORBIDDEN",
          "You can only access your region",
          403
        );
      }
      regionWhere = { id: regionIdParam };
    }

    const regions = await prisma.region.findMany({
      where: regionWhere,
      select: { id: true, name: true },
    });
    const regionIds = regions.map((r) => r.id);

    if (regionIds.length === 0) {
      return successResponse({ data: [], total: 0, dateRange: { from, to } });
    }

    // Aggregate metrics per region
    const [clientsByRegion, tasksByRegion, completedByRegion, gpsByRegion] =
      await Promise.all([
        prisma.client.groupBy({
          by: ["regionId"],
          where: {
            regionId: { in: regionIds },
            createdAt: { gte: from, lte: to },
          },
          _count: { regionId: true },
        }),
        prisma.task.groupBy({
          by: ["regionId"],
          where: {
            regionId: { in: regionIds },
            createdAt: { gte: from, lte: to },
          },
          _count: { regionId: true },
        }),
        prisma.task.groupBy({
          by: ["regionId"],
          where: {
            regionId: { in: regionIds },
            status: TaskStatus.COMPLETED,
            completedAt: { gte: from, lte: to },
          },
          _count: { regionId: true },
        }),
        prisma.gPSSession.groupBy({
          by: ["userId"],
          where: { checkIn: { gte: from, lte: to } },
          _sum: { totalKm: true },
        }),
      ]);

    // Map users to regions for GPS aggregation
    const userIds = Array.from(new Set(gpsByRegion.map((g) => g.userId)));
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, regionId: true },
    });
    const userIdToRegionId = new Map(users.map((u) => [u.id, u.regionId]));
    const gpsByRegionAggregated = new Map<string, number>();
    for (const g of gpsByRegion) {
      const rId = userIdToRegionId.get(g.userId);
      if (rId && regionIds.includes(rId)) {
        const prev = gpsByRegionAggregated.get(rId) || 0;
        gpsByRegionAggregated.set(rId, prev + (g._sum.totalKm || 0));
      }
    }

    const clientsMap = new Map(
      clientsByRegion.map((c) => [c.regionId, c._count.regionId])
    );
    const tasksMap = new Map(
      tasksByRegion.map((t) => [t.regionId, t._count.regionId])
    );
    const completedMap = new Map(
      completedByRegion.map((t) => [t.regionId, t._count.regionId])
    );

    const data = regions.map((r) => {
      const totalTasks = tasksMap.get(r.id) || 0;
      const completedTasks = completedMap.get(r.id) || 0;
      const completionRate =
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      return {
        regionId: r.id,
        regionName: r.name,
        clients: clientsMap.get(r.id) || 0,
        tasks: totalTasks,
        completedTasks,
        completionRate,
        totalKm: Math.round((gpsByRegionAggregated.get(r.id) || 0) * 100) / 100,
      };
    });

    return successResponse({
      data,
      total: data.length,
      dateRange: { from, to },
    });
  } catch (error) {
    logError(error, "GET /api/reports/regional-performance", user?.id);
    return errorResponse(
      "INTERNAL_SERVER_ERROR",
      "Failed to load regional performance report",
      500
    );
  }
}
