import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthenticatedUser,
  errorResponse,
  successResponse,
  rateLimit,
  logError,
  parseQueryParams,
} from "@/lib/api-utils";

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

    const { page, limit } = parseQueryParams(request);
    const { searchParams } = new URL(request.url);
    const isReadParam = searchParams.get("isRead");
    const type = searchParams.get("type") || undefined;

    const where: Record<string, unknown> = { targetUserId: user.id };
    if (typeof isReadParam === "string") where.isRead = isReadParam === "true";
    if (type) where.type = type;

    const total = await prisma.notification.count({ where });
    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        message: true,
        type: true,
        isRead: true,
        createdAt: true,
      },
    });

    return successResponse({
      data: notifications,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logError(error, "GET /api/tasks/notifications", user?.id);
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to fetch notifications",
      500
    );
  }
}
