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
import { bulkAssignTaskSchema, BulkAssignTaskInput } from "@/lib/validations";

export async function POST(request: NextRequest) {
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

    if (user.role !== UserRole.LEAD_MR && user.role !== UserRole.ADMIN) {
      return errorResponse(
        "FORBIDDEN",
        "Only Lead MR and Admin can assign tasks",
        403
      );
    }

    const body = await request.json();
    const validation = validateRequest(bulkAssignTaskSchema, body);
    if (!validation.success) {
      return errorResponse("VALIDATION_ERROR", validation.error);
    }

    const { taskIds, assigneeId, reason } =
      validation.data as BulkAssignTaskInput;

    // verify assignee
    const assignee = await prisma.user.findUnique({
      where: { id: assigneeId },
      select: { id: true, role: true, regionId: true, leadMrId: true },
    });
    if (!assignee)
      return errorResponse("ASSIGNEE_NOT_FOUND", "Assignee not found", 404);
    if (user.role === UserRole.LEAD_MR) {
      if (assignee.role !== UserRole.MR)
        return errorResponse(
          "FORBIDDEN",
          "Lead MR can only assign to MR users",
          403
        );
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
    }

    const results: Array<{ taskId: string; success: boolean; error?: string }> =
      [];

    for (const taskId of taskIds) {
      try {
        const task = await prisma.task.findUnique({
          where: { id: taskId },
          select: { id: true, regionId: true, title: true },
        });
        if (!task) {
          results.push({ taskId, success: false, error: "TASK_NOT_FOUND" });
          continue;
        }
        if (user.role === UserRole.LEAD_MR && task.regionId !== user.regionId) {
          results.push({ taskId, success: false, error: "FORBIDDEN" });
          continue;
        }

        await prisma.task.update({
          where: { id: taskId },
          data: { assigneeId },
        });

        // best-effort notification
        try {
          await prisma.notification.create({
            data: {
              title: `Task assigned: ${task.title}`,
              message: reason
                ? reason
                : `You have been assigned task: ${task.title}`,
              type: "TASK_ASSIGNMENT",
              targetUserId: assigneeId,
            },
          });
        } catch {}

        results.push({ taskId, success: true });
      } catch {
        results.push({ taskId, success: false, error: "INTERNAL_ERROR" });
      }
    }

    return successResponse({ success: true, results });
  } catch (error) {
    logError(error, "POST /api/tasks/assign-bulk", user?.id);
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to perform bulk assignment",
      500
    );
  }
}
