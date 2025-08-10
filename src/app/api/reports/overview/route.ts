import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole, TaskStatus, UserStatus } from "@prisma/client";
import {
  errorResponse,
  getAuthenticatedUser,
  rateLimit,
  successResponse,
  logError,
} from "@/lib/api-utils";
import type { AuthenticatedUser } from "@/types/api";

function parseDateRange(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const from = dateFrom
    ? new Date(dateFrom)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = dateTo ? new Date(dateTo) : new Date();
  return { from, to };
}

// Build role-constrained filters per model
function getUserWhereByRole(user: {
  id: string;
  role: UserRole;
  regionId: string | null | undefined;
  leadMrId: string | null | undefined;
}) {
  switch (user.role) {
    case UserRole.MR:
      return { id: user.id };
    case UserRole.LEAD_MR:
      return {
        OR: [{ regionId: user.regionId || undefined }, { leadMrId: user.id }],
      } as Record<string, unknown>;
    case UserRole.ADMIN:
    default:
      return {};
  }
}

function getClientWhereByRole(user: {
  id: string;
  role: UserRole;
  regionId: string | null | undefined;
}) {
  switch (user.role) {
    case UserRole.MR:
      return { mrId: user.id };
    case UserRole.LEAD_MR:
      return {
        OR: [
          { regionId: user.regionId || undefined },
          { mr: { leadMrId: user.id } },
        ],
      } as Record<string, unknown>;
    case UserRole.ADMIN:
    default:
      return {};
  }
}

function getTaskWhereByRole(user: {
  id: string;
  role: UserRole;
  regionId: string | null | undefined;
}) {
  switch (user.role) {
    case UserRole.MR:
      return { assigneeId: user.id };
    case UserRole.LEAD_MR:
      return {
        OR: [
          { regionId: user.regionId || undefined },
          { assignee: { leadMrId: user.id } },
          { assigneeId: user.id },
          { createdById: user.id },
        ],
      } as Record<string, unknown>;
    case UserRole.ADMIN:
    default:
      return {};
  }
}

// Intentionally omitted helper for session where; using derived allowed userIds instead

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

    const { from, to } = parseDateRange(request);

    // Build filters
    const userWhere = getUserWhereByRole({
      id: user.id,
      role: user.role,
      regionId: user.regionId ?? null,
      leadMrId: user.leadMrId ?? null,
    });
    const clientWhere = {
      ...getClientWhereByRole({
        id: user.id,
        role: user.role,
        regionId: user.regionId ?? null,
      }),
      createdAt: { gte: from, lte: to },
    } as Record<string, unknown>;
    const taskBaseWhere = getTaskWhereByRole({
      id: user.id,
      role: user.role,
      regionId: user.regionId ?? null,
    });
    const taskWhere = {
      ...taskBaseWhere,
      createdAt: { gte: from, lte: to },
    } as Record<string, unknown>;

    // Resolve allowed userIds for LEAD_MR session scoping
    let allowedUserIds: string[] | undefined = undefined;
    if (user.role !== UserRole.ADMIN) {
      const users = await prisma.user.findMany({
        where: userWhere,
        select: { id: true },
      });
      allowedUserIds = users.map((u) => u.id);
    }

    const sessionWhere: Record<string, unknown> = {
      ...(user.role === UserRole.MR ? { userId: user.id } : {}),
      ...(user.role === UserRole.LEAD_MR && allowedUserIds
        ? { userId: { in: allowedUserIds } }
        : {}),
      checkIn: { gte: from, lte: to },
    };

    // Compute KPIs concurrently
    const [totalUsers, activeUsers, totalClients, tasksRaw, sessions] =
      await Promise.all([
        prisma.user.count({ where: userWhere as Record<string, unknown> }),
        prisma.user.count({
          where: {
            status: UserStatus.ACTIVE,
            ...(user.role === UserRole.MR
              ? { id: user.id }
              : user.role === UserRole.LEAD_MR
              ? {
                  OR: [
                    { regionId: user.regionId || undefined },
                    { leadMrId: user.id },
                  ],
                }
              : {}),
          },
        }),
        prisma.client.count({ where: clientWhere }),
        prisma.task.findMany({
          where: taskWhere,
          select: {
            id: true,
            status: true,
            completedAt: true,
            createdAt: true,
          },
        }),
        prisma.gPSSession.findMany({
          where: sessionWhere,
          select: {
            id: true,
            totalKm: true,
            checkIn: true,
            checkOut: true,
            userId: true,
          },
        }),
      ]);

    const tasks = tasksRaw as Array<{
      createdAt: Date;
      status: TaskStatus;
      completedAt: Date | null;
    }>;
    const pendingTasks = tasks.filter(
      (t) => t.status === TaskStatus.PENDING
    ).length;
    const completedTasks = tasks.filter(
      (t) => t.status === TaskStatus.COMPLETED
    ).length;

    const totalKm = sessions.reduce((sum, s) => sum + (s.totalKm || 0), 0);

    // Build trend for tasks created per day over last up to 14 days within range
    const dayCount = Math.min(
      14,
      Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) || 1
    );
    const trends: Array<{ date: string; tasksCreated: number }> = [];
    const trendStart = new Date(to);
    trendStart.setDate(to.getDate() - (dayCount - 1));
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(trendStart);
      d.setDate(trendStart.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const count = tasks.filter(
        (t) => new Date(t.createdAt).toISOString().slice(0, 10) === key
      ).length;
      trends.push({ date: key, tasksCreated: count });
    }

    return successResponse({
      kpis: {
        totalUsers,
        activeUsers,
        totalClients,
        pendingTasks,
        completedTasks,
        totalKm: Math.round(totalKm * 100) / 100,
      },
      trends,
      dateRange: { from, to },
    });
  } catch (error) {
    logError(error, "GET /api/reports/overview", user?.id);
    return errorResponse(
      "INTERNAL_SERVER_ERROR",
      "Failed to load overview report",
      500
    );
  }
}
