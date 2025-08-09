import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getAuthenticatedUser,
  errorResponse,
  successResponse,
  rateLimit,
  logError,
  validateRequest,
} from "@/lib/api-utils";
import { assignTaskSchema, AssignTaskInput } from "@/lib/validations";

export async function POST(
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

    // Only Lead MR and Admin can assign/reassign tasks
    if (user.role !== UserRole.LEAD_MR && user.role !== UserRole.ADMIN) {
      return errorResponse(
        "FORBIDDEN",
        "Only Lead MR and Admin can assign tasks",
        403
      );
    }

    const { id } = await params;
    const body = await request.json();

    const validation = validateRequest(assignTaskSchema, body);
    if (!validation.success) {
      return errorResponse("VALIDATION_ERROR", validation.error);
    }

    const { assigneeId, reason } = validation.data as AssignTaskInput;

    // Verify task exists and fetch region/assignee
    const task = await prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        regionId: true,
        assigneeId: true,
        createdById: true,
      },
    });

    if (!task) {
      return errorResponse("TASK_NOT_FOUND", "Task not found", 404);
    }

    // Verify new assignee exists
    const assignee = await prisma.user.findUnique({
      where: { id: assigneeId },
      select: {
        id: true,
        role: true,
        regionId: true,
        leadMrId: true,
        name: true,
        username: true,
      },
    });

    if (!assignee) {
      return errorResponse("ASSIGNEE_NOT_FOUND", "Assignee not found", 404);
    }

    // Lead MR can only assign to MR in their region or direct team
    if (user.role === UserRole.LEAD_MR) {
      if (assignee.role !== UserRole.MR) {
        return errorResponse(
          "FORBIDDEN",
          "Lead MR can only assign tasks to MR users",
          403
        );
      }
      if (
        assignee.regionId !== user.regionId &&
        assignee.leadMrId !== user.id
      ) {
        return errorResponse(
          "FORBIDDEN",
          "You can only assign tasks to MRs in your region or team",
          403
        );
      }
      // Also ensure the task is within their region
      if (task.regionId !== user.regionId) {
        return errorResponse(
          "FORBIDDEN",
          "You can only assign tasks within your region",
          403
        );
      }
    }

    // Update assignment
    const updated = await prisma.task.update({
      where: { id },
      data: { assigneeId },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        assignee: { select: { id: true, name: true, username: true } },
        createdBy: { select: { id: true, name: true, username: true } },
        region: { select: { id: true, name: true } },
        area: { select: { id: true, name: true } },
        updatedAt: true,
      },
    });

    // Create a notification for the new assignee (best effort)
    try {
      await prisma.notification.create({
        data: {
          title: `Task assigned: ${updated.title}`,
          message: reason
            ? `${reason}`
            : `You have been assigned task: ${updated.title}`,
          type: "TASK_ASSIGNMENT",
          targetUserId: assignee.id,
        },
      });
    } catch (e) {
      // non-fatal
      console.warn("Failed to create assignment notification", e);
    }

    return successResponse(
      { success: true, task: updated },
      "Task assigned successfully"
    );
  } catch (error) {
    logError(error, `POST /api/tasks/${(await params).id}/assign`, user?.id);
    return errorResponse("INTERNAL_ERROR", "Failed to assign task", 500);
  }
}
