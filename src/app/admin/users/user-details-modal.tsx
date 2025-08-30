"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { DateDisplay } from "@/components/date-display";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Shield,
  Calendar,
  Users,
  Clock,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Building2,
  Activity,
} from "lucide-react";
import { apiGet } from "@/lib/api-client";

// Minimal types for tracking sessions API
interface GpsLogPoint {
  latitude: number;
  longitude: number;
  timestamp: string | Date;
  accuracy?: number | null;
  speed?: number | null;
  altitude?: number | null;
}

interface TrackingSessionsResponse {
  sessions: Array<{
    id: string;
    gpsLogs?: GpsLogPoint[];
    checkIn: string | Date;
    checkOut?: string | Date | null;
    totalKm?: number | null;
    startLat?: number | null;
    startLng?: number | null;
    endLat?: number | null;
    endLng?: number | null;
  }>;
}

// Session detail response for fetching a single session with optional route
type SessionDetailResponse = {
  id: string;
  checkIn: string | Date;
  checkOut?: string | Date | null;
  totalKm?: number | null;
  startLat?: number | null;
  startLng?: number | null;
  endLat?: number | null;
  endLng?: number | null;
  route?: {
    coordinates: Array<{
      latitude: number;
      longitude: number;
      timestamp: string | Date;
    }>;
  };
};

async function fetchTrackingSessions(
  url: string
): Promise<TrackingSessionsResponse | null> {
  try {
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) return null;
    const json = await res.json();
    if (json && Array.isArray(json.sessions)) {
      return json as TrackingSessionsResponse;
    }
    return null;
  } catch {
    return null;
  }
}
import LiveMap from "@/components/tracking/live-map";

// Task interface for pending tasks
interface Task {
  id: string;
  title: string;
  description?: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  region: {
    id: string;
    name: string;
  };
  area?: {
    id: string;
    name: string;
  };
  assignee: {
    id: string;
    name: string;
    username: string;
  };
  createdBy: {
    id: string;
    name: string;
  };
}

// Client interface for client list
interface Client {
  id: string;
  name: string;
  phone?: string;
  businessType: string;
  address?: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  area: {
    id: string;
    name: string;
  };
}

type UserDetailsProps = {
  user: {
    id: string;
    username: string;
    name: string;
    email: string | null;
    phone: string | null;
    role: "MR" | "LEAD_MR" | "ADMIN";
    status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
    regionId: string | null;
    region?: { id: string; name: string } | null;
    leadMrId: string | null;
    leadMr?: { id: string; name: string } | null;
    createdAt: Date;
    updatedAt: Date;
    _count: {
      clients: number;
      assignedTasks: number;
      teamMembers: number;
    };
  } | null;
  open: boolean;
  onClose: () => void;
};

const getRoleBadgeVariant = (role: string) => {
  switch (role) {
    case "ADMIN":
      return "destructive";
    case "LEAD_MR":
      return "secondary";
    case "MR":
      return "default";
    default:
      return "default";
  }
};

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case "ACTIVE":
      return "default";
    case "INACTIVE":
      return "secondary";
    case "SUSPENDED":
      return "destructive";
    default:
      return "secondary";
  }
};

const getPriorityBadgeVariant = (priority: string) => {
  switch (priority) {
    case "URGENT":
      return "destructive";
    case "HIGH":
      return "destructive";
    case "MEDIUM":
      return "default";
    case "LOW":
      return "secondary";
    default:
      return "secondary";
  }
};

const getPriorityIcon = (priority: string) => {
  switch (priority) {
    case "URGENT":
      return AlertCircle;
    case "HIGH":
      return TrendingUp;
    case "MEDIUM":
      return Activity;
    case "LOW":
      return Clock;
    default:
      return Clock;
  }
};

export function UserDetailsModal({ user, open, onClose }: UserDetailsProps) {
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  // Map state
  const [isLoadingMap, setIsLoadingMap] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [trailPoints, setTrailPoints] = useState<
    Array<{ lat: number; lng: number; timestamp: string | Date }>
  >([]);
  const [lastLocation, setLastLocation] = useState<{
    lat: number;
    lng: number;
    timestamp: string | Date;
  } | null>(null);
  const [completedSessions, setCompletedSessions] = useState<
    TrackingSessionsResponse["sessions"]
  >([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null
  );
  const [historySessions, setHistorySessions] = useState<
    TrackingSessionsResponse["sessions"]
  >([]);
  const [historyTotalKm, setHistoryTotalKm] = useState<number>(0);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  const fetchPendingTasks = useCallback(async () => {
    if (!user) return;

    setIsLoadingTasks(true);
    setTaskError(null);

    try {
      // Fetch tasks assigned to this user with PENDING status
      const tasksData = await apiGet<Task>(
        `/api/tasks?assignedTo=${user.id}&status=PENDING&limit=10`
      );
      setPendingTasks(Array.isArray(tasksData) ? tasksData : []);
    } catch (error) {
      console.error("Error fetching pending tasks:", error);
      setTaskError("Failed to load pending tasks");
      setPendingTasks([]);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [user?.id]);

  const fetchUserClients = useCallback(async () => {
    if (!user) return;

    setIsLoadingClients(true);
    setClientError(null);

    try {
      // Fetch clients assigned to this user
      const clientsData = await apiGet<Client>(
        `/api/clients?mrId=${user.id}&limit=10`
      );
      setClients(Array.isArray(clientsData) ? clientsData : []);
    } catch (error) {
      console.error("Error fetching clients:", error);
      setClientError("Failed to load clients");
      setClients([]);
    } finally {
      setIsLoadingClients(false);
    }
  }, [user?.id]);

  // Fetch latest GPS session (active if exists), including logs, to build trail
  const fetchUserTrail = useCallback(async () => {
    if (!user) return;
    setIsLoadingMap(true);
    setMapError(null);
    try {
      // Try active session first
      const activeRes = await fetchTrackingSessions(
        `/api/tracking/sessions?userId=${user.id}&limit=1&includeLogs=true&status=active`
      );
      let sessions: TrackingSessionsResponse["sessions"] =
        activeRes?.sessions || [];

      // If no active session, get the latest session regardless of status
      if (sessions.length === 0) {
        const latestRes = await fetchTrackingSessions(
          `/api/tracking/sessions?userId=${user.id}&limit=1&includeLogs=true`
        );
        sessions = latestRes?.sessions || [];
      }

      if (sessions.length === 0) {
        setTrailPoints([]);
        setLastLocation(null);
        setIsLoadingMap(false);
        return;
      }

      const session = sessions[0];
      const logs: GpsLogPoint[] = Array.isArray(session?.gpsLogs)
        ? session.gpsLogs
        : [];

      const trail = logs.map((l) => ({
        lat: l.latitude,
        lng: l.longitude,
        timestamp: l.timestamp,
      }));
      setTrailPoints(trail);

      const last = trail.length > 0 ? trail[trail.length - 1] : null;
      setLastLocation(last);
    } catch {
      setMapError("Failed to load map data");
      setTrailPoints([]);
      setLastLocation(null);
    } finally {
      setIsLoadingMap(false);
    }
  }, [user?.id]);

  // Fetch recent completed sessions (with logs) for historical routes
  const fetchCompletedSessions = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetchTrackingSessions(
        `/api/tracking/sessions?userId=${user.id}&status=completed&limit=5&includeLogs=true`
      );
      if (res && Array.isArray(res.sessions)) {
        setCompletedSessions(res.sessions);
        // Only set initial session if we have sessions
        if (res.sessions.length > 0) {
          const first = res.sessions[0];
          setSelectedSessionId(first.id);
          // Apply first session data immediately
          const logs: GpsLogPoint[] = Array.isArray(first.gpsLogs)
            ? first.gpsLogs
            : [];
          const trail =
            logs.length > 0
              ? logs.map((l) => ({
                  lat: l.latitude,
                  lng: l.longitude,
                  timestamp: l.timestamp,
                }))
              : first.startLat != null &&
                first.startLng != null &&
                first.endLat != null &&
                first.endLng != null
              ? [
                  {
                    lat: first.startLat,
                    lng: first.startLng,
                    timestamp: first.checkIn,
                  },
                  {
                    lat: first.endLat,
                    lng: first.endLng,
                    timestamp: first.checkOut || first.checkIn,
                  },
                ]
              : [];
          setTrailPoints(trail);
          const last = trail.length > 0 ? trail[trail.length - 1] : null;
          setLastLocation(last);
        }
      }
    } catch {
      // ignore silently; mapError will reflect primary trail fetch if needed
    }
  }, [user?.id]);

  // Fetch user's completed sessions (summary only) for history totals and quick access
  const fetchHistorySessions = useCallback(async () => {
    if (!user) return;
    setIsLoadingHistory(true);
    try {
      const res = await fetchTrackingSessions(
        `/api/tracking/sessions?userId=${user.id}&status=completed&limit=50`
      );
      if (res && Array.isArray(res.sessions)) {
        setHistorySessions(res.sessions);
        const total = res.sessions.reduce(
          (sum, s) => sum + (typeof s.totalKm === "number" ? s.totalKm : 0),
          0
        );
        setHistoryTotalKm(Math.round(total * 100) / 100);
      }
    } finally {
      setIsLoadingHistory(false);
    }
  }, [user?.id]);

  // Ensure a selected session has logs by fetching details when needed
  const ensureSessionWithLogs = useCallback(
    async (sessionId: string) => {
      const existing = completedSessions.find((s) => s.id === sessionId);
      if (
        existing &&
        Array.isArray(existing.gpsLogs) &&
        existing.gpsLogs.length > 0
      ) {
        return existing;
      }
      try {
        const r = await fetch(
          `/api/tracking/sessions/${sessionId}?includeRoute=true`,
          { credentials: "same-origin" }
        );
        if (!r.ok) return existing || null;
        const json: SessionDetailResponse = await r.json();
        const coords: GpsLogPoint[] = Array.isArray(json.route?.coordinates)
          ? json.route!.coordinates.map((c) => ({
              latitude: c.latitude,
              longitude: c.longitude,
              timestamp: c.timestamp,
            }))
          : [];
        const merged = {
          id: json.id,
          checkIn: json.checkIn,
          checkOut: json.checkOut,
          totalKm: json.totalKm || 0,
          startLat: json.startLat ?? null,
          startLng: json.startLng ?? null,
          endLat: json.endLat ?? null,
          endLng: json.endLng ?? null,
          gpsLogs: coords,
        } as TrackingSessionsResponse["sessions"][number];
        setCompletedSessions((prev) => {
          const others = prev.filter((s) => s.id !== merged.id);
          return [merged, ...others];
        });
        return merged;
      } catch {
        return existing || null;
      }
    },
    [completedSessions]
  );

  // Reset session state when modal opens or user changes
  useEffect(() => {
    if (open && user) {
      // Reset map state when switching users or opening modal
      setSelectedSessionId(null);
      setTrailPoints([]);
      setLastLocation(null);
      setCompletedSessions([]);
      setHistorySessions([]);
      setMapError(null);
      setHistoryTotalKm(0);
    }
  }, [open, user?.id]);

  // Fetch data when modal opens
  useEffect(() => {
    if (open && user) {
      fetchPendingTasks();
      fetchUserClients();
      fetchUserTrail();
      fetchCompletedSessions();
      fetchHistorySessions();
    }
  }, [
    open,
    user?.id,
    fetchPendingTasks,
    fetchUserClients,
    fetchUserTrail,
    fetchCompletedSessions,
    fetchHistorySessions,
  ]);

  // Handle session selection changes for historical routes
  const handleSessionChange = useCallback(
    (sessionId: string) => {
      setSelectedSessionId(sessionId);
      const local = completedSessions.find((x) => x.id === sessionId) || null;
      const applySession = (
        s: TrackingSessionsResponse["sessions"][number] | null
      ) => {
        if (!s) return;
        const logs: GpsLogPoint[] = Array.isArray(s.gpsLogs) ? s.gpsLogs : [];
        const trail =
          logs.length > 0
            ? logs.map((l) => ({
                lat: l.latitude,
                lng: l.longitude,
                timestamp: l.timestamp,
              }))
            : s.startLat != null &&
              s.startLng != null &&
              s.endLat != null &&
              s.endLng != null
            ? [
                { lat: s.startLat, lng: s.startLng, timestamp: s.checkIn },
                {
                  lat: s.endLat,
                  lng: s.endLng,
                  timestamp: s.checkOut || s.checkIn,
                },
              ]
            : [];
        setTrailPoints(trail);
        const last = trail.length > 0 ? trail[trail.length - 1] : null;
        setLastLocation(last);
      };
      if (local) {
        applySession(local);
      } else {
        ensureSessionWithLogs(sessionId).then(applySession);
      }
    },
    [completedSessions, ensureSessionWithLogs]
  );

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback>
                {user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{user.name}</div>
              <div className="text-sm text-muted-foreground">
                @{user.username}
              </div>
            </div>
          </DialogTitle>
          <DialogDescription>
            Comprehensive view of user information, tasks, and performance.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="flex-1">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tasks">
              Pending Tasks
              {pendingTasks.length > 0 && (
                <Badge
                  variant="destructive"
                  className="ml-2 h-5 w-5 rounded-full p-0 text-xs"
                >
                  {pendingTasks.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="clients">Clients</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="map">Map</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[500px] pr-4">
            <TabsContent value="overview" className="space-y-4 mt-4">
              {/* Status and Role */}
              <div className="flex items-center gap-2">
                <Badge variant={getStatusBadgeVariant(user.status)}>
                  {user.status}
                </Badge>
                <Badge variant={getRoleBadgeVariant(user.role)}>
                  {user.role.replace("_", " ")}
                </Badge>
              </div>

              {/* Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4 text-blue-500" />
                      <div>
                        <p className="text-2xl font-bold text-blue-600">
                          {user._count.clients}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Total Clients
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-orange-500" />
                      <div>
                        <p className="text-2xl font-bold text-orange-600">
                          {user._count.assignedTasks}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Assigned Tasks
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {user.role === "LEAD_MR" && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-purple-500" />
                        <div>
                          <p className="text-2xl font-bold text-purple-600">
                            {user._count.teamMembers}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Team Members
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Contact Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {user.email || "No email provided"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {user.phone || "No phone provided"}
                      </span>
                    </div>
                    {user.region && (
                      <div className="flex items-center gap-3">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{user.region.name}</span>
                      </div>
                    )}
                    {user.leadMr && (
                      <div className="flex items-center gap-3">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          Lead MR: {user.leadMr.name}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tasks" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Pending Tasks ({pendingTasks.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingTasks ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-pulse text-sm text-muted-foreground">
                        Loading tasks...
                      </div>
                    </div>
                  ) : taskError ? (
                    <div className="text-center py-4 text-sm text-destructive">
                      {taskError}
                    </div>
                  ) : pendingTasks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p>No pending tasks! 🎉</p>
                      <p className="text-xs">All caught up!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pendingTasks.map((task) => {
                        const PriorityIcon = getPriorityIcon(task.priority);
                        return (
                          <div
                            key={task.id}
                            className="border rounded-lg p-3 space-y-2"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium text-sm">
                                  {task.title}
                                </h4>
                                {task.description && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {task.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={getPriorityBadgeVariant(
                                    task.priority
                                  )}
                                  className="text-xs"
                                >
                                  <PriorityIcon className="h-3 w-3 mr-1" />
                                  {task.priority}
                                </Badge>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {task.region.name}
                                  {task.area && `, ${task.area.name}`}
                                </span>
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {task.createdBy.name}
                                </span>
                              </div>
                              {task.dueDate && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <DateDisplay
                                    date={new Date(task.dueDate)}
                                    format="MMM dd"
                                  />
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="clients" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Assigned Clients ({clients.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingClients ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-pulse text-sm text-muted-foreground">
                        Loading clients...
                      </div>
                    </div>
                  ) : clientError ? (
                    <div className="text-center py-4 text-sm text-destructive">
                      {clientError}
                    </div>
                  ) : clients.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Building2 className="h-8 w-8 mx-auto mb-2" />
                      <p>No clients assigned</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {clients.map((client) => (
                        <div key={client.id} className="border rounded-lg p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-sm">
                                {client.name}
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                {client.businessType}
                              </p>
                              {client.address && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {client.address}
                                </p>
                              )}
                            </div>
                            <Badge
                              variant={
                                client.status === "ACTIVE"
                                  ? "default"
                                  : "secondary"
                              }
                              className="text-xs"
                            >
                              {client.status}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {client.area.name}
                            </span>
                            {client.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {client.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="details" className="space-y-4 mt-4">
              {/* Account Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Account Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Created:</span>
                      <div className="mt-1">
                        <DateDisplay
                          date={user.createdAt}
                          format="PPP 'at' HH:mm"
                          className="text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Last Updated:
                      </span>
                      <div className="mt-1">
                        <DateDisplay
                          date={user.updatedAt}
                          format="PPP 'at' HH:mm"
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Role-specific Information */}
              {user.role === "LEAD_MR" && user._count.teamMembers > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Team Leadership
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      This Lead MR manages {user._count.teamMembers} team member
                      {user._count.teamMembers !== 1 ? "s" : ""}.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="map" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    User Route
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {completedSessions.length > 0 && (
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">
                          Completed sessions:
                        </span>
                        <select
                          className="border rounded px-2 py-1 text-sm"
                          value={selectedSessionId || ""}
                          onChange={(e) => handleSessionChange(e.target.value)}
                        >
                          {completedSessions.map((s, idx) => (
                            <option
                              key={`${s.id ?? "noid"}-${String(
                                s.checkIn
                              )}-${idx}`}
                              value={s.id}
                            >
                              {new Date(s.checkIn).toLocaleString('en-GB', {
                                day: '2-digit', month: '2-digit', year: 'numeric',
                                hour: '2-digit', minute: '2-digit', hour12: false
                              })}{" "}
                              {s.checkOut
                                ? "→ " +
                                  new Date(s.checkOut).toLocaleTimeString('en-GB', {
                                    hour: '2-digit', minute: '2-digit', hour12: false
                                  })
                                : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      {(() => {
                        const s =
                          completedSessions.find(
                            (x) => x.id === selectedSessionId
                          ) || completedSessions[0];
                        // Derive start/end from session fields or currently loaded trail
                        let startLat: number | null = s.startLat ?? null;
                        let startLng: number | null = s.startLng ?? null;
                        let endLat: number | null = s.endLat ?? null;
                        let endLng: number | null = s.endLng ?? null;
                        if (
                          (!startLat || !startLng || !endLat || !endLng) &&
                          selectedSessionId === s.id &&
                          trailPoints.length > 1
                        ) {
                          const first = trailPoints[0];
                          const last = trailPoints[trailPoints.length - 1];
                          startLat = startLat ?? first.lat;
                          startLng = startLng ?? first.lng;
                          endLat = endLat ?? last.lat;
                          endLng = endLng ?? last.lng;
                        }
                        const hasStart = startLat != null && startLng != null;
                        const hasEnd = endLat != null && endLng != null;
                        return (
                          <div className="text-xs text-muted-foreground">
                            {hasStart && hasEnd ? (
                              <span>
                                From {startLat!.toFixed(4)},{" "}
                                {startLng!.toFixed(4)} to {endLat!.toFixed(4)},{" "}
                                {endLng!.toFixed(4)}
                              </span>
                            ) : (
                              <span>Route summary unavailable</span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  {/* History summary */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <div>
                      History:{" "}
                      {isLoadingHistory
                        ? "loading..."
                        : `${historyTotalKm.toFixed(2)} km`}{" "}
                      • Sessions: {historySessions.length}
                    </div>
                  </div>

                  {/* History list for quick map view */}
                  {historySessions.length > 0 && (
                    <div className="max-h-40 overflow-y-auto mb-2 border rounded">
                      <div className="divide-y">
                        {historySessions.map((hs, idx) => (
                          <div
                            key={`${hs.id ?? "noid"}-${idx}`}
                            className="p-2 flex items-center justify-between text-xs"
                          >
                            <div className="flex-1 pr-2">
                              <div className="font-medium">
                                {new Date(
                                  hs.checkIn as string
                                ).toLocaleString('en-GB', {
                                  day: '2-digit', month: '2-digit', year: 'numeric',
                                  hour: '2-digit', minute: '2-digit', hour12: false
                                })}{" "}
                                {hs.checkOut
                                  ? `→ ${new Date(
                                      hs.checkOut as string
                                    ).toLocaleTimeString('en-GB', {
                                      hour: '2-digit', minute: '2-digit', hour12: false
                                    })}`
                                  : ""}
                              </div>
                              <div className="text-muted-foreground">
                                {typeof hs.totalKm === "number"
                                  ? `${hs.totalKm.toFixed(2)} km`
                                  : "-"}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="px-2 py-1 border rounded"
                              onClick={() => handleSessionChange(hs.id)}
                            >
                              Map
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isLoadingMap ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-pulse text-sm text-muted-foreground">
                        Loading map...
                      </div>
                    </div>
                  ) : mapError ? (
                    <div className="text-center py-4 text-sm text-destructive">
                      {mapError}
                    </div>
                  ) : (!lastLocation || trailPoints.length === 0) &&
                    completedSessions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MapPin className="h-8 w-8 mx-auto mb-2" />
                      <p>No GPS data available for this user.</p>
                      <p className="text-xs">
                        Once the user tracks a session, their route will appear
                        here.
                      </p>
                    </div>
                  ) : lastLocation ? (
                    <LiveMap
                      locations={[
                        {
                          userId: user.id,
                          userName: user.name,
                          latitude: lastLocation.lat,
                          longitude: lastLocation.lng,
                          timestamp: lastLocation.timestamp,
                        },
                      ]}
                      trails={[
                        {
                          userId: user.id,
                          userName: user.name,
                          trail: trailPoints,
                        },
                      ]}
                      focus={{ lat: lastLocation.lat, lng: lastLocation.lng }}
                      selectedUserId={user.id}
                    />
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
