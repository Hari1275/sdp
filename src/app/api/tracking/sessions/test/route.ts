import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  errorResponse,
  getAuthenticatedUser,
  logError,
  rateLimit,
  successResponse,
} from "@/lib/api-utils";
import { UserRole } from "@prisma/client";
import type { AuthenticatedUser } from "@/types/api";

export async function POST(request: NextRequest) {
  let user: AuthenticatedUser | null = null;
  try {
    if (!rateLimit(request)) {
      return errorResponse("RATE_LIMIT_EXCEEDED", "Too many requests", 429);
    }

    user = await getAuthenticatedUser(request);
    if (!user)
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);

    // Pick a target MR that current user is allowed to see
    let targetUserId: string | null = null;
    if (user.role === UserRole.MR) {
      targetUserId = user.id;
    } else if (user.role === UserRole.LEAD_MR) {
      const teamMr = await prisma.user.findFirst({
        where: { leadMrId: user.id },
        select: { id: true },
      });
      targetUserId = teamMr?.id || user.id;
    } else {
      const anyMr = await prisma.user.findFirst({
        where: { role: UserRole.MR },
        select: { id: true },
      });
      targetUserId = anyMr?.id || user.id;
    }

    if (!targetUserId)
      return errorResponse("NO_TARGET", "No target user found", 400);

    // If an active session exists, add more logs; else create one
    const existing = await prisma.gPSSession.findFirst({
      where: { userId: targetUserId, checkOut: null },
    });

    const baseLat = 19.076; // Mumbai approx
    const baseLng = 72.8777;
    const now = Date.now();

    let sessionId: string;
    if (existing) {
      sessionId = existing.id;
    } else {
      const created = await prisma.gPSSession.create({
        data: {
          userId: targetUserId,
          checkIn: new Date(now - 20 * 60 * 1000),
          startLat: baseLat,
          startLng: baseLng,
          totalKm: 1.2,
        },
        select: { id: true },
      });
      sessionId = created.id;
    }

    // Add ~10 recent GPS points to form a small trail
    const points: Array<{ lat: number; lng: number; ts: Date }> = Array.from(
      { length: 10 },
      (_, i) => ({
        lat: baseLat + i * 0.001,
        lng: baseLng + i * 0.0012,
        ts: new Date(now - (10 - i) * 60 * 1000), // 1-minute intervals
      })
    );

    await Promise.all(
      points.map((p) =>
        prisma.gPSLog.create({
          data: {
            sessionId,
            latitude: p.lat,
            longitude: p.lng,
            timestamp: p.ts,
            speed: 10 + Math.random() * 6,
            accuracy: 5 + Math.random() * 5,
          },
        })
      )
    );

    return successResponse({
      message: "Created/updated a test active session",
      userId: targetUserId,
      sessionId,
    });
  } catch (error) {
    logError(error, "POST /api/tracking/sessions/test", user?.id);
    return errorResponse(
      "INTERNAL_SERVER_ERROR",
      "Failed to create test session",
      500
    );
  }
}
