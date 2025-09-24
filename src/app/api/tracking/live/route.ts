import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import * as Sentry from "@sentry/nextjs";
import {
  errorResponse,
  getAuthenticatedUser,
  logError,
  rateLimit,
  successResponse,
} from "@/lib/api-utils";
import type { AuthenticatedUser } from "@/types/api";
import { getGPSSessionFilter } from "@/lib/role-filters";

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

    // Get session filters based on role
    const sessionWhere = getGPSSessionFilter(user);

    // Query recent sessions for allowed users; filter active in memory
    console.log('[TrackingLive] sessionWhere:', sessionWhere);

    const sessions = await prisma.gPSSession.findMany({
      where: sessionWhere,
      select: {
        id: true,
        userId: true,
        checkIn: true,
        checkOut: true,
        totalKm: true,
        startLat: true,
        startLng: true,
        user: { select: { id: true, name: true, username: true } },
        gpsLogs: {
          orderBy: { timestamp: "desc" },
          take: 20,
          select: { latitude: true, longitude: true, timestamp: true },
        },
      },
      orderBy: { checkIn: "desc" },
      take: 300,
    });

    // Guard against any null comparison issues by filtering active now
    const sessionsActive = sessions.filter(s => s.checkOut === null);

    const now = Date.now();
    const activeSessions = sessionsActive.map((s) => {
      const u = s.user;
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

    // If no active sessions were found, capture a diagnostic message in Sentry
    if (activeSessions.length === 0) {
      Sentry.captureMessage("Live tracking: no active sessions found", {
        level: "warning",
        extra: {
          userId: user.id,
          userRole: user.role,
          sessionWhere: sessionWhere,
        },
      });
    }

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
