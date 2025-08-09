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
    const dateFromStr = searchParams.get("dateFrom") || undefined;
    const dateToStr = searchParams.get("dateTo") || undefined;

    // Access control: MR can only view own; Lead MR can view team or region; Admin all
    if (user.role === UserRole.MR) {
      if (userId && userId !== user.id)
        return errorResponse(
          "FORBIDDEN",
          "You can only view your own analytics",
          403
        );
    }
    if (user.role === UserRole.LEAD_MR) {
      if (regionId && regionId !== user.regionId)
        return errorResponse(
          "FORBIDDEN",
          "You can only view your region analytics",
          403
        );
    }

    const whereBase: Record<string, unknown> = {};
    if (userId) whereBase.assigneeId = userId;
    if (regionId) whereBase.regionId = regionId;

    // Date filtering by createdAt
    const createdAt: Record<string, Date> = {};
    if (dateFromStr) createdAt.gte = new Date(dateFromStr);
    if (dateToStr) createdAt.lte = new Date(dateToStr);
    if (Object.keys(createdAt).length) whereBase.createdAt = createdAt;

    const total = await prisma.task.count({ where: whereBase });
    const completed = await prisma.task.count({
      where: { ...whereBase, status: TaskStatus.COMPLETED },
    });

    const completionRate =
      total > 0 ? Math.round((completed / total) * 10000) / 100 : 0;

    return successResponse({
      completionRate,
      totalTasks: total,
      completedTasks: completed,
    });
  } catch (error) {
    logError(error, "GET /api/tasks/analytics/completion-rate", user?.id);
    return errorResponse("INTERNAL_ERROR", "Failed to compute analytics", 500);
  }
}
