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
    const userId = searchParams.get("userId");
    const regionId = searchParams.get("region");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const from = dateFrom
      ? new Date(dateFrom)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = dateTo ? new Date(dateTo) : new Date();

    // Build role-based access for tasks
    let where: Record<string, unknown> = { createdAt: { gte: from, lte: to } };
    switch (user.role as UserRole) {
      case UserRole.MR:
        where = { ...where, assigneeId: user.id };
        break;
      case UserRole.LEAD_MR:
        where = {
          ...where,
          OR: [
            { regionId: user.regionId || undefined },
            { assignee: { leadMrId: user.id } },
            { assigneeId: user.id },
            { createdById: user.id },
          ],
        };
        break;
      case UserRole.ADMIN:
      default:
        break;
    }

    if (userId) {
      // Only admin can filter arbitrary user; others must match scope
      if (user.role !== UserRole.ADMIN && user.id !== userId) {
        return errorResponse(
          "FORBIDDEN",
          "Cannot access other users tasks",
          403
        );
      }
      where.assigneeId = userId;
    }

    if (regionId) {
      if (user.role !== UserRole.ADMIN && user.regionId !== regionId) {
        return errorResponse(
          "FORBIDDEN",
          "You can only access your region data",
          403
        );
      }
      where.regionId = regionId;
    }

    const [total, pending, completed, cancelled] =
      await Promise.all([
        prisma.task.count({ where }),
        prisma.task.count({ where: { ...where, status: TaskStatus.PENDING } }),
        prisma.task.count({
          where: { ...where, status: TaskStatus.COMPLETED },
        }),
        prisma.task.count({
          where: { ...where, status: TaskStatus.CANCELLED },
        }),
      ]);

    const completionRate =
      total > 0 ? Math.round((completed / total) * 100) : 0;

    // Group by assignee for ranking (top 10)
    const byAssignee = await prisma.task.groupBy({
      by: ["assigneeId"],
      where,
      _count: { assigneeId: true },
      orderBy: { _count: { assigneeId: "desc" } },
      take: 10,
    });

    const completedByAssignee = await prisma.task.groupBy({
      by: ["assigneeId"],
      where: { ...where, status: TaskStatus.COMPLETED },
      _count: { assigneeId: true },
    });

    const mapCompleted = new Map(
      completedByAssignee.map((r) => [r.assigneeId, r._count.assigneeId])
    );
    const assigneeIds = byAssignee.map((r) => r.assigneeId);
    const users = await prisma.user.findMany({
      where: { id: { in: assigneeIds } },
      select: { id: true, name: true, username: true },
    });

    const topAssignees = byAssignee.map((r) => {
      const userInfo = users.find((u) => u.id === r.assigneeId);
      const comp = mapCompleted.get(r.assigneeId) || 0;
      const rate =
        r._count.assigneeId > 0
          ? Math.round((comp / r._count.assigneeId) * 100)
          : 0;
      return {
        assigneeId: r.assigneeId,
        name: userInfo?.name || "Unknown",
        username: userInfo?.username || "",
        tasksAssigned: r._count.assigneeId,
        tasksCompleted: comp,
        completionRate: rate,
      };
    });

    return successResponse({
      summary: {
        total,
        pending,
        completed,
        cancelled,
        completionRate,
      },
      topAssignees,
      dateRange: { from, to },
    });
  } catch (error) {
    logError(error, "GET /api/reports/task-completion", user?.id);
    return errorResponse(
      "INTERNAL_SERVER_ERROR",
      "Failed to load task completion report",
      500
    );
  }
}
