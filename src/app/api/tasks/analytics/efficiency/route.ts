import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAuthenticatedUser,
  errorResponse,
  successResponse,
  rateLimit,
  logError,
} from "@/lib/api-utils";
import { TaskStatus, UserRole } from "@prisma/client";

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

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || undefined;
    const regionId = searchParams.get("regionId") || undefined;
    const period =
      (searchParams.get("period") as "daily" | "weekly" | "monthly") || "daily";

    if (user.role === UserRole.MR && userId && userId !== user.id) {
      return errorResponse(
        "FORBIDDEN",
        "You can only view your own analytics",
        403
      );
    }
    if (
      user.role === UserRole.LEAD_MR &&
      regionId &&
      regionId !== user.regionId
    ) {
      return errorResponse(
        "FORBIDDEN",
        "You can only view your region analytics",
        403
      );
    }

    const where: Record<string, unknown> = {};
    if (userId) where.assigneeId = userId;
    if (regionId) where.regionId = regionId;

    const tasks = await prisma.task.findMany({
      where,
      select: { id: true, createdAt: true, completedAt: true, status: true },
    });

    const completed = tasks.filter(
      (t) => t.status === TaskStatus.COMPLETED && t.completedAt
    );

    // Average completion time in hours
    const completionTimes = completed.map(
      (t) =>
        (t.completedAt!.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)
    );
    const avgCompletionTime = completionTimes.length
      ? Math.round(
          (completionTimes.reduce((a, b) => a + b, 0) /
            completionTimes.length) *
            100
        ) / 100
      : 0;

    // Efficiency heuristic: completed tasks per period
    let trends: Array<{ period: string; completed: number }> = [];

    if (period === "daily") {
      const map = new Map<string, number>();
      for (const t of completed) {
        const key = t.completedAt!.toISOString().slice(0, 10);
        map.set(key, (map.get(key) || 0) + 1);
      }
      trends = Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, v]) => ({ period: k, completed: v }));
    } else if (period === "weekly") {
      const map = new Map<string, number>();
      for (const t of completed) {
        const d = t.completedAt!;
        const first = new Date(d);
        const day = first.getDay() || 7;
        first.setDate(first.getDate() - day + 1);
        const key = first.toISOString().slice(0, 10);
        map.set(key, (map.get(key) || 0) + 1);
      }
      trends = Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, v]) => ({ period: k, completed: v }));
    } else {
      const map = new Map<string, number>();
      for (const t of completed) {
        const d = t.completedAt!;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
          2,
          "0"
        )}`;
        map.set(key, (map.get(key) || 0) + 1);
      }
      trends = Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, v]) => ({ period: k, completed: v }));
    }

    const efficiency = trends.length
      ? Math.round(
          (trends.reduce((a, b) => a + b.completed, 0) / trends.length) * 100
        ) / 100
      : 0;

    return successResponse({ avgCompletionTime, efficiency, trends });
  } catch (error) {
    logError(error, "GET /api/tasks/analytics/efficiency", user?.id);
    return errorResponse("INTERNAL_ERROR", "Failed to compute analytics", 500);
  }
}
