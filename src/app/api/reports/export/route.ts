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

function sanitizeText(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7E]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
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
      select: {
        id: true,
        name: true,
        username: true,
        regionId: true,
        region: { select: { name: true } },
      },
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
      // Aggregate richer metrics per user in scope (match UI export semantics)
      const users = allowedUsers;
      const userIds = users.map((u) => u.id);

      const [tasksAssigned, tasksCompleted, gpsAgg, bizAgg, clients] =
        await Promise.all([
          prisma.task.groupBy({
            by: ["assigneeId"],
            where: {
              assigneeId: { in: userIds },
              ...(since || to
                ? {
                    createdAt: {
                      ...(since ? { gte: since } : {}),
                      ...(to ? { lte: to } : {}),
                    },
                  }
                : {}),
            },
            _count: { assigneeId: true },
          }),
          prisma.task.groupBy({
            by: ["assigneeId"],
            where: {
              assigneeId: { in: userIds },
              status: "COMPLETED",
              ...(since || to
                ? {
                    completedAt: {
                      ...(since ? { gte: since } : {}),
                      ...(to ? { lte: to } : {}),
                    },
                  }
                : {}),
            },
            _count: { assigneeId: true },
          }),
          prisma.gPSSession.groupBy({
            by: ["userId"],
            where: {
              userId: { in: userIds },
              ...(since || to
                ? {
                    checkIn: {
                      ...(since ? { gte: since } : {}),
                      ...(to ? { lte: to } : {}),
                    },
                  }
                : {}),
            },
            _sum: { totalKm: true },
            _count: { userId: true },
          }),
          prisma.businessEntry.groupBy({
            by: ["mrId"],
            where: {
              mrId: { in: userIds },
              ...(since || to
                ? {
                    createdAt: {
                      ...(since ? { gte: since } : {}),
                      ...(to ? { lte: to } : {}),
                    },
                  }
                : {}),
            },
            _sum: { amount: true },
            _count: { mrId: true },
          }),
          prisma.client.findMany({
            where: {
              mrId: { in: userIds },
              ...(since || to
                ? {
                    createdAt: {
                      ...(since ? { gte: since } : {}),
                      ...(to ? { lte: to } : {}),
                    },
                  }
                : {}),
            },
            select: { id: true, name: true, createdAt: true, mrId: true },
          }),
        ]);

      // Preload up to 3 recent completed sessions per user for summary strings
      const recentSessionsByUser = new Map<string, string>();
      for (const u of users) {
        const recent = await prisma.gPSSession.findMany({
          where: {
            userId: u.id,
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
          take: 3,
          select: {
            checkIn: true,
            totalKm: true,
            startLat: true,
            startLng: true,
            endLat: true,
            endLng: true,
          },
        });
        const parts = recent.map((s) => {
          const date = s.checkIn.toISOString().slice(0, 10);
          const start =
            s.startLat && s.startLng
              ? `${s.startLat.toFixed(4)}, ${s.startLng.toFixed(4)}`
              : "-";
          const end =
            s.endLat && s.endLng
              ? `${s.endLat.toFixed(4)}, ${s.endLng.toFixed(4)}`
              : "-";
          const km = Number((s.totalKm ?? 0).toFixed(2));
          return `${date}: ${start} -> ${end} (${km} km)`;
        });
        recentSessionsByUser.set(u.id, sanitizeText(parts.join("; ")));
      }

      const mapAssigned = new Map(
        tasksAssigned.map((t) => [t.assigneeId, t._count.assigneeId])
      );
      const mapCompleted = new Map(
        tasksCompleted.map((t) => [t.assigneeId, t._count.assigneeId])
      );
      const mapGps = new Map(
        gpsAgg.map((g) => [
          g.userId,
          { totalKm: g._sum.totalKm || 0, totalSessions: g._count.userId },
        ])
      );
      const mapBiz = new Map(
        bizAgg.map((b) => [
          b.mrId,
          { totalAmount: b._sum.amount || 0, entries: b._count.mrId },
        ])
      );
      const mapClients = new Map<
        string,
        Array<{ id: string; name: string; date: string }>
      >();
      for (const c of clients) {
        const arr = mapClients.get(c.mrId) || [];
        arr.push({
          id: c.id,
          name: c.name,
          date: c.createdAt.toISOString().slice(0, 10),
        });
        mapClients.set(c.mrId, arr);
      }

      rows = users.map((u) => {
        const assigned = mapAssigned.get(u.id) || 0;
        const completed = mapCompleted.get(u.id) || 0;
        const completionRate =
          assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
        const gps = mapGps.get(u.id) || { totalKm: 0, totalSessions: 0 };
        const biz = mapBiz.get(u.id) || { totalAmount: 0, entries: 0 };
        const joined = mapClients.get(u.id) || [];
        return {
          user: u.name || u.username,
          region: u.region?.name || "-",
          tasksAssigned: assigned,
          tasksCompleted: completed,
          completionRate,
          totalKm: Math.round((gps.totalKm || 0) * 100) / 100,
          gpsSessions: gps.totalSessions || 0,
          businessEntries: biz.entries || 0,
          businessAmount: Math.round((biz.totalAmount || 0) * 100) / 100,
          joinedClientsCount: joined.length,
          joinedClients: sanitizeText(
            joined.map((j) => `${j.name} (${j.date})`).join("; ")
          ),
          recentSessions: recentSessionsByUser.get(u.id) || "",
        } as Record<string, unknown>;
      });
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
    const csvCore = [headers.join(",")]
      .concat(
        rows.map((r) =>
          headers
            .map((h) => {
              const v = r[h as keyof typeof r] ?? "";
              return JSON.stringify(v);
            })
            .join(",")
        )
      )
      .join("\n");
    // Prepend BOM for Excel compatibility
    const csv = "\uFEFF" + csvCore;

    const filename = `${reportType.toLowerCase()}-${Date.now()}.csv`;
    const token = createToken({
      content: csv,
      contentType: "text/csv; charset=utf-8",
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
