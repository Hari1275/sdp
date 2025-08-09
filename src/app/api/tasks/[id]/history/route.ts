import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthenticatedUser,
  errorResponse,
  successResponse,
  rateLimit,
  logError,
} from "@/lib/api-utils";
import { UserRole } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    if (!rateLimit(request)) {
      return errorResponse(
        "RATE_LIMIT_EXCEEDED",
        "Too many requests. Please try again later.",
        429
      );
    }

    user = await getAuthenticatedUser(request);
    if (!user)
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);

    const { id } = await params;

    const task = await prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
        status: true,
        regionId: true,
        assigneeId: true,
        createdById: true,
        assignee: { select: { leadMrId: true } },
      },
    });

    if (!task) return errorResponse("TASK_NOT_FOUND", "Task not found", 404);

    // Access control similar to other endpoints
    switch (user.role) {
      case UserRole.MR:
        if (task.assigneeId !== user.id)
          return errorResponse(
            "FORBIDDEN",
            "You can only access tasks assigned to you",
            403
          );
        break;
      case UserRole.LEAD_MR:
        if (
          task.regionId !== user.regionId &&
          task.assignee?.leadMrId !== user.id &&
          task.createdById !== user.id
        ) {
          return errorResponse(
            "FORBIDDEN",
            "You can only access tasks in your region or team",
            403
          );
        }
        break;
      case UserRole.ADMIN:
        break;
      default:
        return errorResponse("FORBIDDEN", "Insufficient permissions", 403);
    }

    // Synthetic minimal history
    const history: Array<{
      action: string;
      timestamp: Date;
      details?: string;
    }> = [];
    history.push({ action: "CREATED", timestamp: task.createdAt });
    if (task.completedAt)
      history.push({ action: "COMPLETED", timestamp: task.completedAt });
    if (
      task.updatedAt &&
      task.updatedAt.getTime() !== task.createdAt.getTime()
    ) {
      history.push({ action: "UPDATED", timestamp: task.updatedAt });
    }

    return successResponse(history);
  } catch (error) {
    logError(error, `GET /api/tasks/${(await params).id}/history`, user?.id);
    return errorResponse("INTERNAL_ERROR", "Failed to fetch task history", 500);
  }
}
