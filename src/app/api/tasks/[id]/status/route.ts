import { NextRequest } from "next/server";
import { UserRole, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getAuthenticatedUser,
  errorResponse,
  successResponse,
  rateLimit,
  logError,
  validateRequest,
} from "@/lib/api-utils";
import {
  updateTaskStatusSchema,
  UpdateTaskStatusInput,
} from "@/lib/validations";

export async function PUT(
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
    if (!user) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const { id } = await params;
    const body = await request.json();

    const validation = validateRequest(updateTaskStatusSchema, body);
    if (!validation.success) {
      return errorResponse("VALIDATION_ERROR", validation.error);
    }

    const { status } = validation.data as UpdateTaskStatusInput;

    // Find task with access context
    const existing = await prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        regionId: true,
        assigneeId: true,
        createdById: true,
        status: true,
        assignee: { select: { leadMrId: true } },
      },
    });

    if (!existing) {
      return errorResponse("TASK_NOT_FOUND", "Task not found", 404);
    }

    // Permissions
    switch (user.role) {
      case UserRole.MR:
        if (existing.assigneeId !== user.id) {
          return errorResponse(
            "FORBIDDEN",
            "You can only update status of tasks assigned to you",
            403
          );
        }
        break;
      case UserRole.LEAD_MR:
        if (
          existing.regionId !== user.regionId &&
          existing.assignee?.leadMrId !== user.id &&
          existing.createdById !== user.id
        ) {
          return errorResponse(
            "FORBIDDEN",
            "You can only update tasks in your region or team",
            403
          );
        }
        break;
      case UserRole.ADMIN:
        break;
      default:
        return errorResponse("FORBIDDEN", "Insufficient permissions", 403);
    }

    // Redirect users to completion endpoint if trying to set COMPLETED
    if (status === TaskStatus.COMPLETED) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Use the completion endpoint to mark tasks as completed"
      );
    }

    const updated = await prisma.task.update({
      where: { id },
      data: {
        status,
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        completedAt: true,
        updatedAt: true,
        assignee: { select: { id: true, name: true, username: true } },
        region: { select: { id: true, name: true } },
        area: { select: { id: true, name: true } },
      },
    });

    // Best-effort notification
    try {
      await prisma.notification.create({
        data: {
          title: `Task status updated: ${updated.title}`,
          message: `Status changed to ${status}`,
          type: "TASK_UPDATE",
          targetUserId: updated.assignee?.id || undefined,
        },
      });
    } catch {}

    return successResponse(
      { success: true, task: updated },
      "Task status updated successfully"
    );
  } catch (error) {
    logError(error, `PUT /api/tasks/${(await params).id}/status`, user?.id);
    return errorResponse("INTERNAL_ERROR", "Failed to update task status", 500);
  }
}
