import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthenticatedUser,
  errorResponse,
  successResponse,
  rateLimit,
  logError,
} from "@/lib/api-utils";
import { TaskStatus, UserRole } from "@prisma/client";

export async function GET(request: NextRequest) {
  let user;
  try {
    if (!rateLimit(request))
      return errorResponse(
        "RATE_LIMIT_EXCEEDED",
        "Too many requests. Please try again later.",
        429
      );

    user = await getAuthenticatedUser(request);
    if (!user)
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || undefined;
    const regionId = searchParams.get("regionId") || undefined;

    if (user.role === UserRole.MR && userId && userId !== user.id) {
      return errorResponse(
        "FORBIDDEN",
        "You can only view your own analytics",
        403
      );
    }
    if (
      user.role === UserRole.LEAD_MR &&
      regionId &&
      regionId !== user.regionId
    ) {
      return errorResponse(
        "FORBIDDEN",
        "You can only view your region analytics",
        403
      );
    }

    const now = new Date();
    const where: Record<string, unknown> = {
      status: { not: TaskStatus.COMPLETED },
      dueDate: { lt: now },
    };
    if (userId) where.assigneeId = userId;
    if (regionId) where.regionId = regionId;

    const tasks = await prisma.task.findMany({
      where,
      select: {
        id: true,
        title: true,
        dueDate: true,
        status: true,
        assignee: { select: { id: true, name: true } },
      },
    });

    return successResponse({
      overdueTasks: tasks.length,
      overdueRate: 0,
      tasks,
    });
  } catch (error) {
    logError(error, "GET /api/tasks/analytics/overdue", user?.id);
    return errorResponse("INTERNAL_ERROR", "Failed to compute analytics", 500);
  }
}
