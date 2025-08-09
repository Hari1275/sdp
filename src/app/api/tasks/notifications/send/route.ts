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
import {
  sendTaskNotificationSchema,
  SendTaskNotificationInput,
} from "@/lib/validations";

export async function POST(request: NextRequest) {
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

    if (user.role !== UserRole.LEAD_MR && user.role !== UserRole.ADMIN) {
      return errorResponse(
        "FORBIDDEN",
        "Only Lead MR and Admin can send notifications",
        403
      );
    }

    const body = await request.json();
    const validation = validateRequest(sendTaskNotificationSchema, body);
    if (!validation.success)
      return errorResponse("VALIDATION_ERROR", validation.error);

    const { userId, type, message, taskId, title } =
      validation.data as SendTaskNotificationInput;

    // verify user exists
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!target)
      return errorResponse("USER_NOT_FOUND", "Target user not found", 404);

    // Optional task check
    let finalTitle = title;
    if (taskId) {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { id: true, title: true },
      });
      if (task) finalTitle = finalTitle || `Task: ${task.title}`;
    }

    await prisma.notification.create({
      data: {
        title: finalTitle || "Task Notification",
        message,
        type,
        targetUserId: userId,
      },
    });

    return successResponse({ success: true });
  } catch (error) {
    logError(error, "POST /api/tasks/notifications/send", user?.id);
    return errorResponse("INTERNAL_ERROR", "Failed to send notification", 500);
  }
}
