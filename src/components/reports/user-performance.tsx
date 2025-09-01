"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import * as Sentry from "@sentry/nextjs";
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
} from "recharts";
import { safeApiCall } from "@/lib/api-client";
import { Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Sanitize text for CSV: strip non-ASCII and control chars, collapse whitespace
function sanitizeText(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7E]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

type Row = {
  userId: string;
  name: string;
  username: string;
  regionId: string | null;
  regionName?: string | null;
  tasksAssigned: number;
  tasksCompleted: number;
  completionRate: number;
  totalKm: number;
  gpsSessions: number;
  businessEntries: number;
  businessAmount: number;
  joinedClientsCount?: number;
  joinedClients?: Array<{ id: string; name: string; date: string }>;
};

type Session = {
  id: string;
  checkIn: string;
  checkOut: string | null;
  totalKm: number;
  startLat?: number | null;
  startLng?: number | null;
  endLat?: number | null;
  endLng?: number | null;
  startName?: string | null;
  endName?: string | null;
};

function exportCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => {
          const v = r[h];
          if (v === null || v === undefined) return "";
          const s = typeof v === "string" ? v : JSON.stringify(v);
          return '"' + s.replaceAll('"', '""') + '"';
        })
        .join(",")
    ),
  ].join("\n");
  // Prepend UTF-8 BOM so Excel interprets Unicode correctly (₹, diacritics)
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
});

interface SessionData {
  checkIn: string;
  startLat?: number;
  startLng?: number;
  endLat?: number;
  endLng?: number;
  startLocation?: { latitude: number; longitude: number };
  endLocation?: { latitude: number; longitude: number };
}

async function summarizeRecentSessions(
  userId: string,
  dateFrom: string,
  dateTo: string
): Promise<string> {
  try {
    const qs = new URLSearchParams({
      userId,
      dateFrom,
      dateTo,
      status: "completed",
      limit: "3",
    });
    const resp = await fetch(`/api/tracking/sessions?${qs.toString()}`);
    if (!resp.ok) return "";
    const data = (await resp.json()) as { sessions?: SessionData[] };
    const sessions = data.sessions || [];
    const parts: string[] = [];
    for (const s of sessions) {
      const date = new Date(s.checkIn).toISOString().slice(0, 10);
      const startLat = s.startLat ?? s.startLocation?.latitude ?? null;
      const startLng = s.startLng ?? s.startLocation?.longitude ?? null;
      const endLat = s.endLat ?? s.endLocation?.latitude ?? null;
      const endLng = s.endLng ?? s.endLocation?.longitude ?? null;
      let startName: string | null = null;
      let endName: string | null = null;
      try {
        if (startLat && startLng) {
          const r1 = await fetch(
            `/api/geocode/reverse?lat=${startLat}&lon=${startLng}`
          );
          if (r1.ok) startName = (await r1.json()).name || null;
        }
        if (endLat && endLng) {
          const r2 = await fetch(
            `/api/geocode/reverse?lat=${endLat}&lon=${endLng}`
          );
          if (r2.ok) endName = (await r2.json()).name || null;
        }
      } catch {
        // ignore
      }
      const startText =
        startName ||
        (startLat && startLng
          ? `${startLat.toFixed(4)}, ${startLng.toFixed(4)}`
          : "-");
      const endText =
        endName ||
        (endLat && endLng ? `${endLat.toFixed(4)}, ${endLng.toFixed(4)}` : "-");
      const km = Number((s.totalKm ?? 0).toFixed(2));
      parts.push(`${date}: ${startText} -> ${endText} (${km} km)`);
    }
    return sanitizeText(parts.join("; "));
  } catch {
    return "";
  }
}

function ViewUserDialog({
  r,
  dateFrom,
  dateTo,
}: {
  r: Row;
  dateFrom: string;
  dateTo: string;
}) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setSessionsLoading(true);
      setSessionsError(null);
      const qs = new URLSearchParams({
        userId: r.userId,
        dateFrom,
        dateTo,
        status: "completed",
        limit: "10",
      });
      try {
        const resp = await fetch(`/api/tracking/sessions?${qs.toString()}`);
        if (!resp.ok) {
          const err = (await resp.json().catch(() => ({ message: "" }))) as {
            message?: string;
          };
          throw new Error(err?.message || `HTTP ${resp.status}`);
        }
        const data = (await resp.json()) as {
          sessions?: Array<{
            id: string;
            checkIn: string;
            checkOut: string | null;
            totalKm: number;
            startLat?: number | null;
            startLng?: number | null;
            endLat?: number | null;
            endLng?: number | null;
            startLocation?: { latitude: number; longitude: number } | null;
            endLocation?: { latitude: number; longitude: number } | null;
          }>;
        };
        const sessionsArr = (data.sessions || []) as Array<{
          id: string;
          checkIn: string;
          checkOut: string | null;
          totalKm: number;
          startLat?: number | null;
          startLng?: number | null;
          endLat?: number | null;
          endLng?: number | null;
          startLocation?: { latitude: number; longitude: number } | null;
          endLocation?: { latitude: number; longitude: number } | null;
        }>;
        const mapped: Session[] = sessionsArr.map((s) => ({
          id: s.id,
          checkIn: s.checkIn,
          checkOut: s.checkOut,
          totalKm: Number((s.totalKm ?? 0).toFixed(2)),
          startLat: s.startLat ?? s.startLocation?.latitude ?? null,
          startLng: s.startLng ?? s.startLocation?.longitude ?? null,
          endLat: s.endLat ?? s.endLocation?.latitude ?? null,
          endLng: s.endLng ?? s.endLocation?.longitude ?? null,
        }));

        // Resolve names for start/end coordinates (best-effort, sequential with cache on server)
        const withNames: Session[] = await Promise.all(
          mapped.map(async (s) => {
            let startName: string | null = null;
            let endName: string | null = null;
            try {
              if (s.startLat && s.startLng) {
                const r1 = await fetch(
                  `/api/geocode/reverse?lat=${s.startLat}&lon=${s.startLng}`
                );
                if (r1.ok) {
                  const j = (await r1.json()) as { name?: string };
                  startName = j.name || null;
                }
              }
              if (s.endLat && s.endLng) {
                const r2 = await fetch(
                  `/api/geocode/reverse?lat=${s.endLat}&lon=${s.endLng}`
                );
                if (r2.ok) {
                  const j = (await r2.json()) as { name?: string };
                  endName = j.name || null;
                }
              }
            } catch {
              // ignore geocode errors
            }
            return { ...s, startName, endName };
          })
        );

        setSessions(withNames);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load sessions";
        setSessionsError(msg);
      } finally {
        setSessionsLoading(false);
      }
    })();
  }, [open, r.userId, dateFrom, dateTo]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          View
        </Button>
      </DialogTrigger>
      <DialogContent>
        <div className="max-h-[70vh] overflow-auto pr-2">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm">
              <div className="font-medium">
                {r.name} ({r.username})
              </div>
              <div className="text-muted-foreground">
                Region: {r.regionName || "-"}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Assigned</div>
                <div className="font-medium">{r.tasksAssigned}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Completed</div>
                <div className="font-medium">{r.tasksCompleted}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Completion</div>
                <div className="font-medium">{r.completionRate}%</div>
              </div>
              <div>
                <div className="text-muted-foreground">Total KM</div>
                <div className="font-medium">{r.totalKm.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">GPS Sessions</div>
                <div className="font-medium">{r.gpsSessions}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Business Entries</div>
                <div className="font-medium">{r.businessEntries}</div>
              </div>
              <div className="col-span-2">
                <div className="text-muted-foreground">Business Amount</div>
                <div className="font-medium">
                  {inr.format(r.businessAmount)}
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">
                Joined Clients ({r.joinedClientsCount ?? 0})
              </div>
              {r.joinedClients && r.joinedClients.length > 0 ? (
                <div className="max-h-56 overflow-auto border rounded">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="p-2">Client</th>
                        <th className="p-2">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.joinedClients.map((j, i) => (
                        <tr key={j.id || i} className="border-t">
                          <td className="p-2">{j.name}</td>
                          <td className="p-2">
                            {new Date(j.date).toISOString().slice(0, 10)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No clients joined in range.
                </div>
              )}
            </div>

            <div>
              <div className="text-sm font-medium mb-2">
                Recent GPS Sessions ({r.gpsSessions})
              </div>
              {sessionsLoading ? (
                <div className="text-sm text-muted-foreground">
                  Loading sessions…
                </div>
              ) : sessionsError ? (
                <div className="text-sm text-red-600">{sessionsError}</div>
              ) : sessions.length > 0 ? (
                <div className="max-h-56 overflow-auto border rounded">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="p-2">Date</th>
                        <th className="p-2">Start</th>
                        <th className="p-2">End</th>
                        <th className="p-2">KM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((s, i) => (
                        <tr key={s.id || i} className="border-t">
                          <td className="p-2">
                            {new Date(s.checkIn).toISOString().slice(0, 10)}
                          </td>
                          <td className="p-2">
                            {s.startLat && s.startLng
                              ? s.startName ||
                                `${s.startLat.toFixed(4)}, ${s.startLng.toFixed(
                                  4
                                )}`
                              : "-"}
                          </td>
                          <td className="p-2">
                            {s.endLat && s.endLng
                              ? s.endName ||
                                `${s.endLat.toFixed(4)}, ${s.endLng.toFixed(4)}`
                              : "-"}
                          </td>
                          <td className="p-2">{s.totalKm.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No sessions in range.
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function UserPerformance() {
  const [dateFrom, setDateFrom] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [dateTo, setDateTo] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetchRows = async (from: string, to: string): Promise<Row[]> => {
    const res = await safeApiCall<{ data: Row[] }>(
      `/api/reports/user-performance?dateFrom=${from}&dateTo=${to}`
    );
    if (res.success) {
      const payload = res.data as unknown;
      const maybe = payload as { data?: Row[] };
      const data = Array.isArray(maybe?.data)
        ? maybe.data!
        : Array.isArray(payload)
        ? (payload as Row[])
        : [];
      return data;
    }
    return [];
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRows(dateFrom, dateTo);
      setRows(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      Sentry.captureException(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportRows = rows.map((r) => ({
    user: `${r.name} (${r.username})`,
    region: r.regionName || "-",
    tasksAssigned: r.tasksAssigned,
    tasksCompleted: r.tasksCompleted,
    completionRate: r.completionRate,
    totalKm: Number(r.totalKm.toFixed(2)),
    gpsSessions: r.gpsSessions,
    businessEntries: r.businessEntries,
    businessAmount: inr.format(r.businessAmount),
    joinedClientsCount: r.joinedClientsCount ?? 0,
    joinedClients: (r.joinedClients || [])
      .map((j) => `${j.name} (${new Date(j.date).toISOString().slice(0, 10)})`)
      .join("; "),
  }));

  // exportRows is used as a base to visualize current columns; keep to avoid unused warning
  void exportRows;

  const handleExport = async () => {
    setExporting(true);
    try {
      const baseRows =
        rows.length > 0 ? rows : await fetchRows(dateFrom, dateTo);
      if (baseRows.length === 0) {
        // No data: export headers only to avoid empty file confusion
        exportCsv("user-performance.csv", [
          { notice: "No data in selected range" },
        ]);
        return;
      }
      // Enrich with recent session summaries (up to 3) for each user
      const enriched = await Promise.all(
        baseRows.map(async (r) => {
          const recentSessions = await summarizeRecentSessions(
            r.userId,
            dateFrom,
            dateTo
          );
          const joinedClients = (r.joinedClients || [])
            .map(
              (j) =>
                `${j.name} (${new Date(j.date).toISOString().slice(0, 10)})`
            )
            .join("; ");
          return {
            user: `${r.name} (${r.username})`,
            region: r.regionName || "-",
            tasksAssigned: r.tasksAssigned,
            tasksCompleted: r.tasksCompleted,
            completionRate: r.completionRate,
            totalKm: Number(r.totalKm.toFixed(2)),
            gpsSessions: r.gpsSessions,
            businessEntries: r.businessEntries,
            // Export numeric amount only
            businessAmount: Number(r.businessAmount.toFixed(2)),
            joinedClientsCount: r.joinedClientsCount ?? 0,
            joinedClients: sanitizeText(joinedClients),
            recentSessions: sanitizeText(recentSessions),
          } as Record<string, unknown>;
        })
      );
      exportCsv("user-performance.csv", enriched);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[200px]"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[200px]"
          />
        </div>
        <Button onClick={load}>Apply</Button>
        <Button variant="outline" onClick={handleExport} disabled={exporting}>
          {exporting ? (
            <span className="inline-flex items-center">
              <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                ></path>
              </svg>
              Exporting…
            </span>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </>
          )}
        </Button>
      </div>

      {loading ? (
        <Card className="animate-pulse">
          <CardContent className="pt-6">Loading...</CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="pt-6 text-red-600">{error}</CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>User Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {rows.length > 0 && (
              <div className="h-72 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rows.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="username" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar
                      dataKey="tasksCompleted"
                      fill="#3b82f6"
                      name="Completed"
                    />
                    <Bar
                      dataKey="tasksAssigned"
                      fill="#93c5fd"
                      name="Assigned"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="p-2">User</th>
                    <th className="p-2">Assigned</th>
                    <th className="p-2">Completed</th>
                    <th className="p-2">Completion</th>
                    <th className="p-2">Total Km</th>
                    <th className="p-2">GPS Sessions</th>
                    <th className="p-2">Business Entries</th>
                    <th className="p-2">Business Amount</th>
                    <th className="p-2">Joined Clients</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.userId} className="border-t">
                      <td className="p-2">
                        {r.name}{" "}
                        <span className="text-xs text-gray-500">
                          ({r.username})
                        </span>
                      </td>
                      <td className="p-2">{r.tasksAssigned}</td>
                      <td className="p-2">{r.tasksCompleted}</td>
                      <td className="p-2">{r.completionRate}%</td>
                      <td className="p-2">{r.totalKm.toFixed(2)}</td>
                      <td className="p-2">{r.gpsSessions}</td>
                      <td className="p-2">{r.businessEntries}</td>
                      <td className="p-2">{inr.format(r.businessAmount)}</td>
                      <td className="p-2">
                        {r.joinedClientsCount ?? 0}
                        {r.joinedClients && r.joinedClients.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {r.joinedClients
                              .slice(0, 3)
                              .map(
                                (j) =>
                                  `${j.name} (${new Date(j.date)
                                    .toISOString()
                                    .slice(0, 10)})`
                              )
                              .join(", ")}
                            {r.joinedClients.length > 3 && " …"}
                          </div>
                        )}
                      </td>
                      <td className="p-2">
                        <ViewUserDialog
                          r={r}
                          dateFrom={dateFrom}
                          dateTo={dateTo}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
