"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { safeApiCall } from "@/lib/api-client";
import LiveMap from "@/components/tracking/live-map";
import LiveMovementChart from "@/components/tracking/live-movement-chart";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { calculateTotalDistance } from "@/lib/gps-utils";

type LiveSession = {
  sessionId: string;
  userId: string;
  userName: string;
  checkIn: string;
  start: { lat: number; lng: number } | null;
  last: { lat: number; lng: number; timestamp: string } | null;
  totalKm: number;
  durationMinutes: number;
};

export default function TrackingPage() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [locations, setLocations] = useState<
    {
      userId: string;
      userName: string;
      latitude: number;
      longitude: number;
      timestamp: string;
    }[]
  >([]);
  const [trails, setTrails] = useState<
    {
      userId: string;
      userName: string;
      trail: { lat: number; lng: number; timestamp: string }[];
    }[]
  >([]);
  const [selectedTrailUserId, setSelectedTrailUserId] = useState<string | null>(
    null
  );
  const [summary, setSummary] = useState<{
    activeCount: number;
    totalKmToday: number;
    lastUpdate: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<
    {
      type:
        | "GPS_UPDATE"
        | "SESSION_CHECKIN"
        | "SESSION_CHECKOUT"
        | "BUSINESS_ENTRY"
        | "TASK_CREATED"
        | "TASK_COMPLETED";
      timestamp: string;
      userId: string;
      userName: string;
      message: string;
      meta?: Record<string, unknown>;
    }[]
  >([]);

  // Filters and pagination for activities
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterUser, setFilterUser] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;
  const [mapFocus, setMapFocus] = useState<
    { lat: number; lng: number } | undefined
  >(undefined);
  const [follow, setFollow] = useState<boolean>(true);
  const mapSectionRef = useRef<HTMLDivElement | null>(null);
  // Configurable refresh interval (defaults to 30s). Can be overridden via env.
  const REFRESH_MS = useMemo(() => {
    const v = Number(process.env.NEXT_PUBLIC_LIVE_REFRESH_MS ?? 30000);
    return Number.isFinite(v) && v > 0 ? v : 30000;
  }, []);

  const uniqueUsers = useMemo(() => {
    const ids = new Map<string, string>();
    activities.forEach((a) => ids.set(a.userId, a.userName));
    locations.forEach((l) => ids.set(l.userId, l.userName));
    return Array.from(ids.entries()).map(([id, name]) => ({ id, name }));
  }, [activities, locations]);

  const filteredActivities = useMemo(() => {
    const from = dateFrom ? new Date(dateFrom) : undefined;
    const to = dateTo ? new Date(dateTo) : undefined;
    return activities.filter((a) => {
      if (filterType !== "ALL" && a.type !== filterType) return false;
      if (filterUser !== "ALL" && a.userId !== filterUser) return false;
      const ts = new Date(a.timestamp).getTime();
      if (from && ts < from.getTime()) return false;
      if (to && ts > to.getTime()) return false;
      return true;
    });
  }, [activities, filterType, filterUser, dateFrom, dateTo]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredActivities.length / pageSize)
  );
  const pagedActivities = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredActivities.slice(start, start + pageSize);
  }, [filteredActivities, page]);

  const load = async () => {
    // Initial load with skeleton
    setLoading(true);
    setError(null);
    const res = await safeApiCall<{
      activeSessions: LiveSession[];
      summary: {
        activeCount: number;
        totalKmToday: number;
        lastUpdate: string;
      };
      teamLocations: typeof locations;
    }>("/api/tracking/live");
    if (res.success) {
      // console.log('--->', res.data.activeSessions);
      setSessions(res.data.activeSessions);
      setSummary(res.data.summary);
      setLocations(res.data.teamLocations || []);
      setTrails(
        (
          res.data.activeSessions as unknown as {
            userId: string;
            userName: string;
            trail?: { lat: number; lng: number; timestamp: string }[];
          }[]
        )
          .filter((s) => Array.isArray(s.trail) && s.trail.length > 1)
          .map((s) => ({
            userId: s.userId,
            userName: s.userName,
            trail: s.trail!,
          }))
      );
    } else {
      setError(res.error);
    }
    setLoading(false);
  };

  // Lightweight refresh that avoids skeleton flicker and only updates data
  const refreshLive = async () => {
    const res = await safeApiCall<{
      activeSessions: LiveSession[];
      summary: {
        activeCount: number;
        totalKmToday: number;
        lastUpdate: string;
      };
      teamLocations: typeof locations;
    }>("/api/tracking/live");
    if (!res.success) return;

    // Update without toggling loading; preserve UI stability
    setSessions(res.data.activeSessions);
    setSummary(res.data.summary);
    setLocations(res.data.teamLocations || []);
    setTrails(
      (
        res.data.activeSessions as unknown as {
          userId: string;
          userName: string;
          trail?: { lat: number; lng: number; timestamp: string }[];
        }[]
      )
        .filter((s) => Array.isArray(s.trail) && s.trail.length > 1)
        .map((s) => ({
          userId: s.userId,
          userName: s.userName,
          trail: s.trail!,
        }))
    );
  };

  const loadActivities = async () => {
    const params = new URLSearchParams();
    params.set("limit", "200");
    if (dateFrom) params.set("since", new Date(dateFrom).toISOString());
    if (dateTo) params.set("to", new Date(dateTo).toISOString());
    if (filterType !== "ALL") params.set("type", filterType);
    if (filterUser !== "ALL") params.set("userId", filterUser);
    const res = await safeApiCall<{
      activities: typeof activities;
      lastUpdate: string;
    }>(`/api/tracking/activities/live?${params.toString()}`);
    if (res.success) {
      setActivities(res.data.activities);
      setPage(1);
    }
  };

  useEffect(() => {
    // Initial load shows skeleton once
    load();
    // Subsequent refreshes update only map-related data and counters
    const id = setInterval(refreshLive, REFRESH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [REFRESH_MS]);

  useEffect(() => {
    loadActivities();
    const id = setInterval(loadActivities, REFRESH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, REFRESH_MS]);

  return (
    <div className="p-6 space-y-6" suppressHydrationWarning>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">
            Real-Time Tracking
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Live view of active GPS sessions
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto justify-start sm:justify-end mt-2 sm:mt-0">
          {summary && (
            <>
              <Badge
                variant="secondary"
                className="text-xs"
                suppressHydrationWarning
              >
                Active: {summary.activeCount}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                <span suppressHydrationWarning>
                  Total Km: {summary.totalKmToday}
                </span>
              </Badge>
              <span
                className="text-[11px] sm:text-xs text-muted-foreground"
                suppressHydrationWarning
              >
                Updated: {new Date(summary.lastUpdate).toLocaleTimeString()}
              </span>
            </>
          )}
          <Button onClick={load} size="sm" className="w-full sm:w-auto">
            Refresh
          </Button>
        </div>
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
        <>
          <div ref={mapSectionRef}>
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <CardTitle className="text-base sm:text-lg">
                    Live Map
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    {selectedTrailUserId && (
                      <span className="text-[11px] sm:text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700">
                        Selected:{" "}
                        {sessions.find((s) => s.userId === selectedTrailUserId)
                          ?.userName || "User"}
                      </span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => setSelectedTrailUserId(null)}
                      disabled={!selectedTrailUserId}
                    >
                      Clear selection
                    </Button>
                    <span className="text-[11px] sm:text-xs text-muted-foreground">
                      Follow selected
                    </span>
                    <Button
                      variant={follow ? "default" : "outline"}
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => setFollow((v) => !v)}
                    >
                      {follow ? "On" : "Off"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <LiveMap
                  locations={locations}
                  trails={trails}
                  focus={mapFocus}
                  selectedUserId={selectedTrailUserId}
                  follow={follow}
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="p-2">User</th>
                      <th className="p-2">Check-In</th>
                      <th className="p-2">Duration (min)</th>
                      <th className="p-2">Total Km</th>
                      <th className="p-2">Last Location</th>
                      <th className="p-2">Last Update</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr
                        key={s.sessionId}
                        className={`border-t hover:bg-muted/30 cursor-pointer ${
                          selectedTrailUserId === s.userId ? "bg-muted/30" : ""
                        }`}
                        onClick={() => setSelectedTrailUserId(s.userId)}
                      >
                        <td className="p-2">{s.userName}</td>
                        <td className="p-2" suppressHydrationWarning>
                          {new Date(s.checkIn).toLocaleString()}
                        </td>
                        <td className="p-2">{s.durationMinutes}</td>
                        <td className="p-2">{s.totalKm}</td>
                        <td className="p-2">
                          {s.last
                            ? `${s.last.lat.toFixed(4)}, ${s.last.lng.toFixed(
                                4
                              )}`
                            : "-"}
                        </td>
                        <td className="p-2" suppressHydrationWarning>
                          {s.last
                            ? new Date(s.last.timestamp).toLocaleTimeString()
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {selectedTrailUserId && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Live Movement (Speed) ·{" "}
                  {sessions.find((s) => s.userId === selectedTrailUserId)
                    ?.userName || "User"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LiveMovementChart
                  trail={(
                    trails.find((t) => t.userId === selectedTrailUserId)
                      ?.trail || []
                  ).slice(-20)}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Live Activity Feed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-2 grid grid-cols-1 md:grid-cols-4 gap-3">
                <Select
                  value={filterType}
                  onValueChange={(v) => {
                    setFilterType(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Types</SelectItem>
                    <SelectItem value="GPS_UPDATE">GPS Update</SelectItem>
                    <SelectItem value="SESSION_CHECKIN">
                      Session Check-in
                    </SelectItem>
                    <SelectItem value="SESSION_CHECKOUT">
                      Session Check-out
                    </SelectItem>
                    <SelectItem value="BUSINESS_ENTRY">
                      Business Entry
                    </SelectItem>
                    <SelectItem value="TASK_CREATED">Task Created</SelectItem>
                    <SelectItem value="TASK_COMPLETED">
                      Task Completed
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filterUser}
                  onValueChange={(v) => {
                    setFilterUser(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="User" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Users</SelectItem>
                    {uniqueUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  {filterUser !== "ALL" ? (
                    (() => {
                      const session =
                        sessions.find((s) => s.userId === filterUser) || null;
                      const userTrail =
                        trails.find((t) => t.userId === filterUser) || null;
                      const last =
                        locations
                          .filter((l) => l.userId === filterUser)
                          .slice(-1)[0] || null;
                      return (
                        <span>
                          {session ? (
                            <>
                              {session.userName}: {session.totalKm.toFixed(2)}{" "}
                              km today • last update{" "}
                              {session.last
                                ? new Date(
                                    session.last.timestamp
                                  ).toLocaleTimeString()
                                : "-"}
                            </>
                          ) : userTrail ? (
                            <>
                              {userTrail.userName}:{" "}
                              {(() => {
                                const km = calculateTotalDistance(
                                  userTrail.trail.map((p) => ({
                                    latitude: p.lat,
                                    longitude: p.lng,
                                  }))
                                );
                                return `${km.toFixed(2)} km`;
                              })()}{" "}
                              • points {userTrail.trail.length}
                            </>
                          ) : last ? (
                            <>
                              {last.userName}: {last.latitude.toFixed(4)},{" "}
                              {last.longitude.toFixed(4)}
                            </>
                          ) : (
                            <>No live data for selected user</>
                          )}
                        </span>
                      );
                    })()
                  ) : (
                    <span>Select a user to see a concise route summary</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={filterUser === "ALL"}
                    onClick={() => {
                      if (filterUser === "ALL") return;
                      setSelectedTrailUserId(filterUser);
                      setFollow(true);
                      // Focus map on last known location for the user if available
                      const last = locations
                        .filter((l) => l.userId === filterUser)
                        .slice(-1)[0];
                      if (last)
                        setMapFocus({
                          lat: last.latitude,
                          lng: last.longitude,
                        });
                      // Smooth scroll to the map section
                      mapSectionRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }}
                  >
                    Map view
                  </Button>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto space-y-3">
                {pagedActivities.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No recent activity
                  </div>
                ) : (
                  pagedActivities.map((a, idx) => (
                    <button
                      type="button"
                      key={`${a.timestamp}-${a.userId}-${idx}`}
                      className="w-full text-left text-sm flex items-start gap-3 hover:bg-muted/30 p-2 rounded"
                      onClick={() => {
                        const { lat, lng } = (a.meta || {}) as {
                          lat?: number;
                          lng?: number;
                        };
                        if (
                          a.type === "GPS_UPDATE" &&
                          typeof lat === "number" &&
                          typeof lng === "number"
                        ) {
                          setMapFocus({ lat, lng });
                        }
                      }}
                    >
                      <div className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                      <div>
                        <div className="font-medium">{a.userName}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(a.timestamp).toLocaleString()} •{" "}
                          {a.type.replace("_", " ")}
                        </div>
                        <div className="text-sm">{a.message}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="text-xs text-muted-foreground">
                  Page {page} / {totalPages}
                </div>
                <div className="space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
