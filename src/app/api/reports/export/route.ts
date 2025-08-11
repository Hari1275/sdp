import { NextRequest } from "next/server";
import {
  errorResponse,
  getAuthenticatedUser,
  logError,
  rateLimit,
  successResponse,
} from "@/lib/api-utils";
import type { AuthenticatedUser } from "@/types/api";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

// Simple in-memory store for pre-signed download tokens for demo.
// In production, use a persistent store or sign URLs w/ short TTL.
const tokenStore = new Map<
  string,
  { content: string; contentType: string; expiresAt: number; filename: string }
>();

function createToken(
  data: { content: string; contentType: string; filename: string },
  ttlMs = 5 * 60 * 1000
) {
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  tokenStore.set(token, { ...data, expiresAt: Date.now() + ttlMs });
  return token;
}

export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => ({}));
    const { reportType, parameters, format } = body as {
      reportType?: string;
      parameters?: Record<string, unknown>;
      format?: "CSV" | "XLSX" | "PDF";
    };

    if (!reportType) {
      return errorResponse("BAD_REQUEST", "reportType is required", 400);
    }

    // For now, generate CSV only; others can be implemented later.
    const fmt = format || "CSV";
    if (fmt !== "CSV") {
      return errorResponse("UNSUPPORTED", "Only CSV export implemented", 400);
    }

    const sinceStr = (parameters as { since?: string })?.since;
    const toStr = (parameters as { to?: string })?.to;
    const since = sinceStr ? new Date(sinceStr) : undefined;
    const to = toStr ? new Date(toStr) : undefined;

    // RBAC: compute allowed users
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
      select: { id: true, name: true, username: true, regionId: true },
    });
    const allowedIds = allowedUsers.map((u) => u.id);

    let rows: Array<Record<string, unknown>> = [];
    if (reportType === "CLIENT_ACTIVITY") {
      const entries = await prisma.businessEntry.findMany({
        where: {
          mrId: { in: allowedIds },
          ...(since || to
            ? {
                createdAt: {
                  ...(since ? { gte: since } : {}),
                  ...(to ? { lte: to } : {}),
                },
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        include: {
          client: {
            select: {
              name: true,
              area: { select: { name: true } },
              region: { select: { name: true } },
            },
          },
          mr: { select: { name: true, username: true } },
        },
      });
      rows = entries.map((e) => ({
        createdAt: e.createdAt.toISOString(),
        mr: e.mr?.name || e.mr?.username || "",
        client: e.client?.name || "",
        region: e.client?.region?.name || "",
        area: e.client?.area?.name || "",
        amount: e.amount,
        latitude: e.latitude,
        longitude: e.longitude,
        notes: e.notes || "",
      }));
    } else if (reportType === "TASK_COMPLETION") {
      const tasks = await prisma.task.findMany({
        where: {
          OR: [
            { assigneeId: { in: allowedIds } },
            { createdById: { in: allowedIds } },
          ],
          ...(since || to
            ? {
                createdAt: {
                  ...(since ? { gte: since } : {}),
                  ...(to ? { lte: to } : {}),
                },
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        include: {
          assignee: { select: { name: true, username: true } },
          region: { select: { name: true } },
          area: { select: { name: true } },
        },
      });
      rows = tasks.map((t) => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
        assignee: t.assignee?.name || t.assignee?.username || "",
        region: t.region?.name || "",
        area: t.area?.name || "",
        dueDate: t.dueDate ? t.dueDate.toISOString() : "",
        createdAt: t.createdAt.toISOString(),
        completedAt: t.completedAt ? t.completedAt.toISOString() : "",
      }));
    } else if (reportType === "GPS_TRACKING") {
      const sessions = await prisma.gPSSession.findMany({
        where: {
          userId: { in: allowedIds },
          ...(since || to
            ? {
                checkIn: {
                  ...(since ? { gte: since } : {}),
                  ...(to ? { lte: to } : {}),
                },
              }
            : {}),
        },
        orderBy: { checkIn: "desc" },
        include: { user: { select: { name: true, username: true } } },
      });
      rows = sessions.map((s) => ({
        user: s.user?.name || s.user?.username || "",
        checkIn: s.checkIn.toISOString(),
        checkOut: s.checkOut ? s.checkOut.toISOString() : "",
        totalKm: s.totalKm ?? 0,
        startLat: s.startLat ?? "",
        startLng: s.startLng ?? "",
        endLat: s.endLat ?? "",
        endLng: s.endLng ?? "",
      }));
    } else if (reportType === "USER_PERFORMANCE") {
      // Aggregate simple metrics per user in scope
      const userIdToName = new Map<string, string>();
      allowedUsers.forEach((u) => userIdToName.set(u.id, u.name || u.username));

      const [assigned, completed, sessions] = await Promise.all([
        prisma.task.findMany({
          where: {
            assigneeId: { in: allowedIds },
            ...(since || to
              ? {
                  createdAt: {
                    ...(since ? { gte: since } : {}),
                    ...(to ? { lte: to } : {}),
                  },
                }
              : {}),
          },
          select: { assigneeId: true },
        }),
        prisma.task.findMany({
          where: {
            assigneeId: { in: allowedIds },
            completedAt: {
              not: null,
              ...(since ? { gte: since } : {}),
              ...(to ? { lte: to } : {}),
            },
          },
          select: { assigneeId: true },
        }),
        prisma.gPSSession.findMany({
          where: {
            userId: { in: allowedIds },
            ...(since || to
              ? {
                  checkIn: {
                    ...(since ? { gte: since } : {}),
                    ...(to ? { lte: to } : {}),
                  },
                }
              : {}),
          },
          select: { userId: true, totalKm: true },
        }),
      ]);

      const stats = new Map<
        string,
        { assigned: number; completed: number; totalKm: number }
      >();
      allowedIds.forEach((id) =>
        stats.set(id, { assigned: 0, completed: 0, totalKm: 0 })
      );
      assigned.forEach((t) => {
        if (!t.assigneeId) return;
        const s = stats.get(t.assigneeId);
        if (s) s.assigned += 1;
      });
      completed.forEach((t) => {
        if (!t.assigneeId) return;
        const s = stats.get(t.assigneeId);
        if (s) s.completed += 1;
      });
      sessions.forEach((s) => {
        const st = stats.get(s.userId);
        if (st) st.totalKm += s.totalKm ?? 0;
      });

      rows = Array.from(stats.entries()).map(([userId, s]) => ({
        user: userIdToName.get(userId) || userId,
        tasksAssigned: s.assigned,
        tasksCompleted: s.completed,
        completionRate: s.assigned
          ? Math.round((s.completed / s.assigned) * 100) + "%"
          : "0%",
        totalKm: Math.round(s.totalKm * 100) / 100,
        since: since ? since.toISOString().slice(0, 10) : "",
        to: to ? to.toISOString().slice(0, 10) : "",
      }));
    } else {
      // Fallback metadata
      rows = [
        {
          reportType,
          generatedAt: new Date().toISOString(),
          requestedBy: user.username,
          since: sinceStr || "",
          to: toStr || "",
        },
      ];
    }
    const headers = Object.keys(rows[0] || {});
    const csv = [headers.join(",")]
      .concat(
        rows.map((r) =>
          headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")
        )
      )
      .join("\n");

    const filename = `${reportType.toLowerCase()}-${Date.now()}.csv`;
    const token = createToken({
      content: csv,
      contentType: "text/csv",
      filename,
    });

    return successResponse({
      downloadUrl: `/api/reports/export?token=${token}`,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });
  } catch (error) {
    logError(error, "POST /api/reports/export", user?.id);
    return errorResponse(
      "INTERNAL_SERVER_ERROR",
      "Failed to generate export",
      500
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    if (!token) {
      return errorResponse("BAD_REQUEST", "token is required", 400);
    }
    const entry = tokenStore.get(token);
    if (!entry) {
      return errorResponse("NOT_FOUND", "Invalid or expired token", 404);
    }
    if (Date.now() > entry.expiresAt) {
      tokenStore.delete(token);
      return errorResponse("EXPIRED", "Token expired", 410);
    }

    // Return the file
    const res = new Response(entry.content, {
      status: 200,
      headers: {
        "Content-Type": entry.contentType,
        "Content-Disposition": `attachment; filename=${entry.filename}`,
        "Cache-Control": "no-store",
      },
    });
    return res;
  } catch {
    // No user context here; don't log user id
    return errorResponse(
      "INTERNAL_SERVER_ERROR",
      "Failed to download export",
      500
    );
  }
}
