import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthenticatedUser,
  errorResponse,
  successResponse,
  rateLimit,
  logError,
} from "@/lib/api-utils";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const notification = await prisma.notification.findUnique({
      where: { id },
      select: { id: true, targetUserId: true },
    });
    if (!notification)
      return errorResponse("NOT_FOUND", "Notification not found", 404);

    if (notification.targetUserId !== user.id) {
      return errorResponse(
        "FORBIDDEN",
        "You can only modify your own notifications",
        403
      );
    }

    await prisma.notification.update({ where: { id }, data: { isRead: true } });

    return successResponse({ success: true });
  } catch (error) {
    logError(
      error,
      `PUT /api/tasks/notifications/${(await params).id}/read`,
      user?.id
    );
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to update notification",
      500
    );
  }
}
