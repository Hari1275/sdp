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

    let userWhere: Record<string, unknown> = {};
    switch (user.role) {
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

    const allowedUsers = await prisma.user.findMany({
      where: userWhere,
      select: { id: true, name: true, username: true },
    });
    const allowedIds = allowedUsers.map((u) => u.id);

    const sessions = await prisma.gPSSession.findMany({
      where: { userId: { in: allowedIds }, checkOut: null },
      select: {
        id: true,
        userId: true,
        checkIn: true,
        totalKm: true,
        startLat: true,
        startLng: true,
        gpsLogs: {
          orderBy: { timestamp: "desc" },
          take: 20,
          select: { latitude: true, longitude: true, timestamp: true },
        },
      },
      orderBy: { checkIn: "desc" },
      take: 100,
    });

    const now = Date.now();
    const activeSessions = sessions.map((s) => {
      const u = allowedUsers.find((x) => x.id === s.userId);
      const last = s.gpsLogs[0] || null;
      const trail = [...s.gpsLogs]
        .reverse()
        .map((g) => ({
          lat: g.latitude,
          lng: g.longitude,
          timestamp: g.timestamp,
        }));
      const durationMinutes = Math.round(
        (now - new Date(s.checkIn).getTime()) / (1000 * 60)
      );
      return {
        sessionId: s.id,
        userId: s.userId,
        userName: u?.name || u?.username || "Unknown",
        checkIn: s.checkIn,
        start:
          s.startLat && s.startLng
            ? { lat: s.startLat, lng: s.startLng }
            : null,
        last: last
          ? {
              lat: last.latitude,
              lng: last.longitude,
              timestamp: last.timestamp,
            }
          : null,
        totalKm: s.totalKm || 0,
        durationMinutes,
        trail,
      };
    });

    const teamLocations = activeSessions
      .filter((s) => s.last !== null)
      .map((s) => ({
        userId: s.userId,
        userName: s.userName,
        latitude: (s.last as { lat: number }).lat,
        longitude: (s.last as { lng: number }).lng,
        timestamp: (s.last as { timestamp: Date }).timestamp,
      }));

    const totalKmToday = activeSessions.reduce(
      (sum, s) => sum + (s.totalKm || 0),
      0
    );

    return successResponse({
      activeSessions,
      teamLocations,
      summary: {
        activeCount: activeSessions.length,
        totalKmToday: Math.round(totalKmToday * 100) / 100,
        lastUpdate: new Date().toISOString(),
      },
    });
  } catch (error) {
    logError(error, "GET /api/tracking/live", user?.id);
    return errorResponse(
      "INTERNAL_SERVER_ERROR",
      "Failed to load live tracking data",
      500
    );
  }
}
