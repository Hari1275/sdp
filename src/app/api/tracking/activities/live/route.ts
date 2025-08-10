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

type ActivityType =
  | "GPS_UPDATE"
  | "SESSION_CHECKIN"
  | "SESSION_CHECKOUT"
  | "BUSINESS_ENTRY"
  | "TASK_CREATED"
  | "TASK_COMPLETED";

type ActivityItem = {
  type: ActivityType;
  timestamp: string;
  userId: string;
  userName: string;
  message: string;
  meta?: Record<string, unknown>;
};

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

    // RBAC scope
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

    const { searchParams } = new URL(request.url);
    const limitParam = parseInt(searchParams.get("limit") || "50", 10);
    const limit = Math.min(Math.max(limitParam, 1), 200);
    const sinceParam = searchParams.get("since");
    const since = sinceParam
      ? new Date(sinceParam)
      : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const toParam = searchParams.get("to");
    const to = toParam ? new Date(toParam) : undefined;
    const typeParam = searchParams.get("type"); // optional: GPS_UPDATE, SESSION_CHECKIN, ...
    const userIdParam = searchParams.get("userId") || undefined;

    const filteredUserIds = userIdParam
      ? allowedIds.includes(userIdParam)
        ? [userIdParam]
        : []
      : allowedIds;

    // Fetch events
    const includeType = (t: string) => !typeParam || typeParam === t;

    const [
      checkIns,
      checkOuts,
      gpsLogs,
      businessEntries,
      tasksCreated,
      tasksCompleted,
    ] = await Promise.all([
      includeType("SESSION_CHECKIN")
        ? prisma.gPSSession.findMany({
            where: {
              userId: { in: filteredUserIds },
              checkIn: { gte: since, ...(to ? { lte: to } : {}) },
            },
            orderBy: { checkIn: "desc" },
            take: limit,
            select: { userId: true, checkIn: true },
          })
        : Promise.resolve([] as Array<{ userId: string; checkIn: Date }>),
      includeType("SESSION_CHECKOUT")
        ? prisma.gPSSession.findMany({
            where: {
              userId: { in: filteredUserIds },
              checkOut: { not: null, gte: since, ...(to ? { lte: to } : {}) },
            },
            orderBy: { checkOut: "desc" },
            take: limit,
            select: { userId: true, checkOut: true },
          })
        : Promise.resolve(
            [] as Array<{ userId: string; checkOut: Date | null }>
          ),
      includeType("GPS_UPDATE")
        ? prisma.gPSLog.findMany({
            where: {
              timestamp: { gte: since, ...(to ? { lte: to } : {}) },
              session: { userId: { in: filteredUserIds } },
            },
            orderBy: { timestamp: "desc" },
            take: limit,
            select: {
              timestamp: true,
              latitude: true,
              longitude: true,
              session: { select: { userId: true } },
            },
          })
        : Promise.resolve(
            [] as Array<{
              timestamp: Date;
              latitude: number;
              longitude: number;
              session: { userId: string };
            }>
          ),
      includeType("BUSINESS_ENTRY")
        ? prisma.businessEntry.findMany({
            where: {
              mrId: { in: filteredUserIds },
              createdAt: { gte: since, ...(to ? { lte: to } : {}) },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
            select: { mrId: true, amount: true, createdAt: true },
          })
        : Promise.resolve(
            [] as Array<{ mrId: string; amount: number; createdAt: Date }>
          ),
      includeType("TASK_CREATED")
        ? prisma.task.findMany({
            where: {
              OR: [
                { assigneeId: { in: filteredUserIds } },
                { createdById: { in: filteredUserIds } },
              ],
              createdAt: { gte: since, ...(to ? { lte: to } : {}) },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
            select: {
              assigneeId: true,
              createdById: true,
              title: true,
              createdAt: true,
            },
          })
        : Promise.resolve(
            [] as Array<{
              assigneeId: string | null;
              createdById: string | null;
              title: string;
              createdAt: Date;
            }>
          ),
      includeType("TASK_COMPLETED")
        ? prisma.task.findMany({
            where: {
              assigneeId: { in: filteredUserIds },
              completedAt: {
                not: null,
                gte: since,
                ...(to ? { lte: to } : {}),
              },
            },
            orderBy: { completedAt: "desc" },
            take: limit,
            select: { assigneeId: true, title: true, completedAt: true },
          })
        : Promise.resolve(
            [] as Array<{
              assigneeId: string;
              title: string;
              completedAt: Date | null;
            }>
          ),
    ]);

    const getUserName = (id: string) => {
      const u = allowedUsers.find((x) => x.id === id);
      return u?.name || u?.username || "Unknown";
    };

    const activities: ActivityItem[] = [];

    // Sessions
    for (const s of checkIns) {
      activities.push({
        type: "SESSION_CHECKIN",
        timestamp: new Date(s.checkIn).toISOString(),
        userId: s.userId,
        userName: getUserName(s.userId),
        message: "Checked in",
      });
    }
    for (const s of checkOuts) {
      activities.push({
        type: "SESSION_CHECKOUT",
        timestamp: new Date(s.checkOut as Date).toISOString(),
        userId: s.userId,
        userName: getUserName(s.userId),
        message: "Checked out",
      });
    }

    // GPS logs
    for (const g of gpsLogs) {
      const uid = g.session.userId;
      activities.push({
        type: "GPS_UPDATE",
        timestamp: new Date(g.timestamp).toISOString(),
        userId: uid,
        userName: getUserName(uid),
        message: "Location updated",
        meta: { lat: g.latitude, lng: g.longitude },
      });
    }

    // Business entries
    for (const b of businessEntries) {
      activities.push({
        type: "BUSINESS_ENTRY",
        timestamp: new Date(b.createdAt).toISOString(),
        userId: b.mrId,
        userName: getUserName(b.mrId),
        message: `Recorded business amount ₹${b.amount.toFixed(2)}`,
        meta: { amount: b.amount },
      });
    }

    // Tasks
    for (const t of tasksCreated) {
      const uid = (t.assigneeId || t.createdById || "") as string;
      activities.push({
        type: "TASK_CREATED",
        timestamp: new Date(t.createdAt).toISOString(),
        userId: uid,
        userName: getUserName(uid),
        message: `Task created: ${t.title}`,
      });
    }
    for (const t of tasksCompleted) {
      const uid = t.assigneeId;
      activities.push({
        type: "TASK_COMPLETED",
        timestamp: new Date(t.completedAt as Date).toISOString(),
        userId: uid,
        userName: getUserName(uid),
        message: `Task completed: ${t.title}`,
      });
    }

    // Sort and limit
    activities.sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));
    const sliced = activities.slice(0, limit);

    return successResponse({
      activities: sliced,
      lastUpdate: new Date().toISOString(),
    });
  } catch (error) {
    logError(error, "GET /api/tracking/activities/live", user?.id);
    return errorResponse(
      "INTERNAL_SERVER_ERROR",
      "Failed to load live activities",
      500
    );
  }
}
