import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import {
  errorResponse,
  getAuthenticatedUser,
  logError,
  rateLimit,
  successResponse,
} from "@/lib/api-utils";
import { calculateGPSPerformanceMetrics } from "@/lib/gps-analytics";
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

    // Determine allowed userIds
    let userWhere: Record<string, unknown> = {};
    switch (user.role as UserRole) {
      case UserRole.MR:
        userWhere = { id: user.id };
        break;
      case UserRole.LEAD_MR:
        userWhere = {
          OR: [{ regionId: user.regionId || undefined }, { leadMrId: user.id }],
        };
        break;
      case UserRole.ADMIN:
      default:
        userWhere = {};
        break;
    }

    if (regionId) {
      if (user.role !== UserRole.ADMIN && user.regionId !== regionId) {
        return errorResponse(
          "FORBIDDEN",
          "You can only access your region data",
          403
        );
      }
      userWhere = { ...userWhere, regionId };
    }

    if (userId) {
      if (user.role !== UserRole.ADMIN && user.id !== userId) {
        return errorResponse(
          "FORBIDDEN",
          "Cannot access other users GPS data",
          403
        );
      }
      userWhere = { ...userWhere, id: userId };
    }

    const allowedUsers = await prisma.user.findMany({
      where: userWhere,
      select: { id: true, name: true, username: true },
    });
    const allowedIds = allowedUsers.map((u) => u.id);

    const sessions = await prisma.gPSSession.findMany({
      where: { userId: { in: allowedIds }, checkIn: { gte: from, lte: to } },
      select: {
        id: true,
        userId: true,
        checkIn: true,
        checkOut: true,
        totalKm: true,
        gpsLogs: {
          select: {
            latitude: true,
            longitude: true,
            timestamp: true,
            speed: true,
          },
        },
      },
    });

    // Group sessions by user and compute metrics
    const sessionsByUser = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const arr = sessionsByUser.get(s.userId) || [];
      arr.push(s);
      sessionsByUser.set(s.userId, arr);
    }

    const report = allowedUsers.map((u) => {
      const userSessions = sessionsByUser.get(u.id) || [];
      const metrics = calculateGPSPerformanceMetrics(
        userSessions.map((s) => ({
          id: s.id,
          checkIn: s.checkIn,
          checkOut: s.checkOut ?? null,
          totalKm: s.totalKm || 0,
          gpsLogs: s.gpsLogs.map((g) => ({
            latitude: g.latitude,
            longitude: g.longitude,
            timestamp: g.timestamp,
            speed: g.speed ?? null,
          })),
        }))
      );
      return {
        userId: u.id,
        name: u.name,
        username: u.username,
        metrics,
      };
    });

    return successResponse({
      data: report,
      total: report.length,
      dateRange: { from, to },
    });
  } catch (error) {
    logError(error, "GET /api/reports/gps-tracking", user?.id);
    return errorResponse(
      "INTERNAL_SERVER_ERROR",
      "Failed to load GPS tracking report",
      500
    );
  }
}
