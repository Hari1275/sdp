"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Users, Clock, Route, Radio } from "lucide-react";
import { safeApiCall } from "@/lib/api-client";
import SimpleLiveMap from "@/components/tracking/simple-live-map";
import LiveActivityTable, { type Activity } from "@/components/tracking/live-activity-table";

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

type TeamLocation = {
  userId: string;
  userName: string;
  latitude: number;
  longitude: number;
  timestamp: string;
};

export default function TrackingPage() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [locations, setLocations] = useState<TeamLocation[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [followedUserId, setFollowedUserId] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    activeCount: number;
    totalKmToday: number;
    lastUpdate: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const REFRESH_MS = 10000;

  const uniqueUsers = useMemo(() => {
    const userMap = new Map<string, string>();
    locations.forEach(loc => userMap.set(loc.userId, loc.userName));
    sessions.forEach(session => userMap.set(session.userId, session.userName));
    return Array.from(userMap.entries()).map(([id, name]) => ({ id, name }));
  }, [locations, sessions]);

  const locationsWithStatus = useMemo(() => {
    const now = Date.now();
    return locations.map(loc => {
      const lastUpdate = new Date(loc.timestamp).getTime();
      const minutesAgo = (now - lastUpdate) / (1000 * 60);
      
      let status: 'active' | 'idle' | 'offline';
      if (minutesAgo < 5) status = 'active';
      else if (minutesAgo < 30) status = 'idle';
      else status = 'offline';
      
      return { ...loc, status };
    });
  }, [locations]);

  const loadLiveData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [liveRes, activityRes] = await Promise.all([
        safeApiCall<{
          activeSessions: LiveSession[];
          teamLocations: TeamLocation[];
          summary: {
            activeCount: number;
            totalKmToday: number;
            lastUpdate: string;
          };
        }>("/api/tracking/live"),
        safeApiCall<{
          activities: Activity[];
          lastUpdate: string;
        }>("/api/tracking/activities/live?limit=100")
      ]);

      if (liveRes.success) {
        setSessions(liveRes.data.activeSessions);
        setLocations(liveRes.data.teamLocations);
        setSummary(liveRes.data.summary);
      } else {
        setError(liveRes.error);
      }

      if (activityRes.success) {
        setActivities(activityRes.data.activities);
      }
    } catch {
      setError("Failed to load tracking data");
    }

    setLoading(false);
  };

  const refreshData = async () => {
    try {
      const [liveRes, activityRes] = await Promise.all([
        safeApiCall<{
          activeSessions: LiveSession[];
          teamLocations: TeamLocation[];
          summary: {
            activeCount: number;
            totalKmToday: number;
            lastUpdate: string;
          };
        }>("/api/tracking/live"),
        safeApiCall<{
          activities: Activity[];
          lastUpdate: string;
        }>("/api/tracking/activities/live?limit=100")
      ]);

      if (liveRes.success) {
        setSessions(liveRes.data.activeSessions);
        setLocations(liveRes.data.teamLocations);
        setSummary(liveRes.data.summary);
      }

      if (activityRes.success) {
        setActivities(activityRes.data.activities);
      }
    } catch (err) {
      console.error("Refresh failed:", err);
    }
  };

  useEffect(() => {
    loadLiveData();
    const interval = setInterval(refreshData, REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    const activeCount = locationsWithStatus.filter(loc => loc.status === 'active').length;
    const idleCount = locationsWithStatus.filter(loc => loc.status === 'idle').length;
    const offlineCount = locationsWithStatus.filter(loc => loc.status === 'offline').length;
    const totalDistance = sessions.reduce((sum, s) => sum + s.totalKm, 0);
    
    return { activeCount, idleCount, offlineCount, totalDistance };
  }, [locationsWithStatus, sessions]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
              <div className="text-lg font-medium">Loading Live Tracking...</div>
              <div className="text-sm text-muted-foreground">Connecting to real-time data</div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                <Radio className="w-8 h-8 text-destructive" />
              </div>
              <div className="text-lg font-medium text-destructive">Connection Error</div>
              <p className="text-muted-foreground max-w-md">{error}</p>
              <Button onClick={loadLiveData} className="mt-4">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">
            Real-Time Tracking
          </h1>
          <p className="text-sm text-muted-foreground">Live view of active GPS sessions and field team activities</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-card rounded-lg border">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-muted-foreground">Live</span>
          </div>
          <Select value={followedUserId || "all"} onValueChange={(v) => setFollowedUserId(v === "all" ? null : v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Follow MR" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All MRs</SelectItem>
              {uniqueUsers.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={loadLiveData} variant="outline">
            <Radio className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center p-4">
            <div className="p-2 bg-muted rounded-lg mr-3">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.activeCount}</div>
              <div className="text-sm text-muted-foreground">Active MRs</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-4">
            <div className="p-2 bg-muted rounded-lg mr-3">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.idleCount}</div>
              <div className="text-sm text-muted-foreground">Idle MRs</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-4">
            <div className="p-2 bg-muted rounded-lg mr-3">
              <Radio className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.offlineCount}</div>
              <div className="text-sm text-muted-foreground">Offline MRs</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-4">
            <div className="p-2 bg-muted rounded-lg mr-3">
              <Route className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.totalDistance.toFixed(1)}</div>
              <div className="text-sm text-muted-foreground">km Today</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Live Map
                {followedUserId && (
                  <Badge variant="secondary" className="ml-2">
                    Following: {uniqueUsers.find(u => u.id === followedUserId)?.name}
                  </Badge>
                )}
              </CardTitle>
              {summary && (
                <div className="text-xs text-muted-foreground">
                  Last update: {new Date(summary.lastUpdate).toLocaleTimeString()}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-96">
              <SimpleLiveMap
                locations={locationsWithStatus}
                followedUserId={followedUserId}
                onMarkerClick={(userId) => setFollowedUserId(userId)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="w-5 h-5" />
              Live Activity Feed
              {followedUserId && (
                <Badge variant="secondary" className="ml-2">
                  {uniqueUsers.find(u => u.id === followedUserId)?.name} Only
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <LiveActivityTable
              activities={activities}
              followedUserId={followedUserId}
              onUserClick={(userId) => setFollowedUserId(userId)}
              maxItems={50}
            />
          </CardContent>
        </Card>
      </div>

      {followedUserId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Session Details - {uniqueUsers.find(u => u.id === followedUserId)?.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const session = sessions.find(s => s.userId === followedUserId);
              const location = locationsWithStatus.find(l => l.userId === followedUserId);
              
              if (!session && !location) {
                return (
                  <div className="text-center py-8 text-muted-foreground">
                    No active session found for this user
                  </div>
                );
              }
              
              return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {session && (
                    <>
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <div className="text-2xl font-bold">{session.durationMinutes}</div>
                        <div className="text-sm text-muted-foreground">Minutes Active</div>
                      </div>
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <div className="text-2xl font-bold">{session.totalKm.toFixed(1)}</div>
                        <div className="text-sm text-muted-foreground">km Traveled</div>
                      </div>
                    </>
                  )}
                  {location && (
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold">
                        {location.status.toUpperCase()}
                      </div>
                      <div className="text-sm text-muted-foreground">Status</div>
                    </div>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
