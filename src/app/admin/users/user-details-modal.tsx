"use client";

import { useEffect, useState, useCallback } from 'react';
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
import { Button } from "@/components/ui/button";
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
  Route,
  Navigation
} from "lucide-react";
import { apiGet } from "@/lib/api-client";
import dynamic from "next/dynamic";

// Dynamically import the map component to avoid SSR issues
const LiveMap = dynamic(() => import("@/components/tracking/live-map"), {
  ssr: false,
  loading: () => <div className="w-full h-96 bg-gray-100 rounded-md flex items-center justify-center">Loading map...</div>
});

// Fallback component when Google Maps is not available
const MapFallback = ({ session }: { session?: GPSSession }) => (
  <div className="w-full h-96 bg-gray-50 rounded-md border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-500">
    <MapPin className="h-12 w-12 mb-4" />
    <h3 className="text-lg font-medium mb-2">Map Visualization</h3>
    <p className="text-sm text-center max-w-xs">
      Google Maps integration is not configured. GPS data is available in the sessions list below.
    </p>
    {session && (
      <div className="mt-4 text-xs bg-white p-3 rounded border">
        <div className="font-medium">Session Details:</div>
        <div>Distance: {session.totalKm.toFixed(1)} km</div>
        <div>Duration: {Math.round(session.duration * 10) / 10} hours</div>
        <div>GPS Points: {session.coordinateCount}</div>
      </div>
    )}
  </div>
);

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

// GPS Session interface for tracking data (matching API response)
interface GPSSession {
  sessionId: string;
  id?: string; // For backwards compatibility
  checkIn: Date | string;
  checkOut?: Date | string | null;
  totalKm: number;
  duration: number;
  user: {
    id: string;
    name: string;
    username: string;
  };
  coordinateCount: number;
  gpsLogs?: Array<{
    latitude: number;
    longitude: number;
    timestamp: Date | string;
    accuracy?: number | null;
    speed?: number | null;
    altitude?: number | null;
  }>;
}

// Map data types
type TeamLocation = {
  userId: string;
  userName: string;
  latitude: number;
  longitude: number;
  timestamp: string | Date;
};

type TrailPoint = { 
  lat: number; 
  lng: number; 
  timestamp: string | Date; 
};

type SessionTrail = { 
  userId: string; 
  userName: string; 
  trail: TrailPoint[]; 
};

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
    case 'ADMIN':
      return 'destructive';
    case 'LEAD_MR':
      return 'secondary';
    case 'MR':
      return 'default';
    default:
      return 'default';
  }
};

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return 'default';
    case 'INACTIVE':
      return 'secondary';
    case 'SUSPENDED':
      return 'destructive';
    default:
      return 'secondary';
  }
};

const getPriorityBadgeVariant = (priority: string) => {
  switch (priority) {
    case 'URGENT':
      return 'destructive';
    case 'HIGH':
      return 'destructive';
    case 'MEDIUM':
      return 'default';
    case 'LOW':
      return 'secondary';
    default:
      return 'secondary';
  }
};

const getPriorityIcon = (priority: string) => {
  switch (priority) {
    case 'URGENT':
      return AlertCircle;
    case 'HIGH':
      return TrendingUp;
    case 'MEDIUM':
      return Activity;
    case 'LOW':
      return Clock;
    default:
      return Clock;
  }
};

export function UserDetailsModal({ user, open, onClose }: UserDetailsProps) {
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [gpsSessions, setGpsSessions] = useState<GPSSession[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [isLoadingGPS, setIsLoadingGPS] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [mapView, setMapView] = useState<'overview' | 'session'>('overview');

  const fetchPendingTasks = useCallback(async () => {
    if (!user) return;
    
    setIsLoadingTasks(true);
    setTaskError(null);
    
    try {
      // Fetch tasks assigned to this user with PENDING status
      const tasksData = await apiGet<Task>(`/api/tasks?assignedTo=${user.id}&status=PENDING&limit=10`);
      setPendingTasks(Array.isArray(tasksData) ? tasksData : []);
    } catch (error) {
      console.error('Error fetching pending tasks:', error);
      setTaskError('Failed to load pending tasks');
      setPendingTasks([]);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [user]);

  const fetchUserClients = useCallback(async () => {
    if (!user) return;
    
    setIsLoadingClients(true);
    setClientError(null);
    
    try {
      // Fetch clients assigned to this user
      const clientsData = await apiGet<Client>(`/api/clients?mrId=${user.id}&limit=10`);
      setClients(Array.isArray(clientsData) ? clientsData : []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      setClientError('Failed to load clients');
      setClients([]);
    } finally {
      setIsLoadingClients(false);
    }
  }, [user]);

  const fetchGPSSessions = useCallback(async () => {
    if (!user) return;
    
    setIsLoadingGPS(true);
    setGpsError(null);
    
    try {
      // Fetch GPS sessions for this user (last 10 sessions)
      const sessionsResponse = await apiGet<{ sessions: GPSSession[] }>(`/api/tracking/sessions?userId=${user.id}&limit=10&includeLogs=true`);
      console.log('GPS Sessions API Response:', sessionsResponse);
      const sessionsData = sessionsResponse.sessions || [];
      console.log('GPS Sessions Data:', sessionsData);
      setGpsSessions(Array.isArray(sessionsData) ? sessionsData : []);
    } catch (error) {
      console.error('Error fetching GPS sessions:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load GPS tracking data';
      setGpsError(`Failed to load GPS tracking data: ${errorMessage}`);
      setGpsSessions([]);
    } finally {
      setIsLoadingGPS(false);
    }
  }, [user]);

  // Fetch data when modal opens
  useEffect(() => {
    if (open && user) {
      fetchPendingTasks();
      fetchUserClients();
      fetchGPSSessions();
    }
  }, [open, user, fetchPendingTasks, fetchUserClients, fetchGPSSessions]);

  // Prepare map data from GPS sessions
  const getMapData = useCallback(() => {
    if (mapView === 'session' && selectedSessionId) {
      // Show specific session trail
      const session = gpsSessions.find(s => s.sessionId === selectedSessionId || s.id === selectedSessionId);
      if (session && session.gpsLogs) {
        const trail: TrailPoint[] = session.gpsLogs.map(log => ({
          lat: log.latitude,
          lng: log.longitude,
          timestamp: log.timestamp
        }));
        
        const trails: SessionTrail[] = [{
          userId: user.id,
          userName: user.name,
          trail
        }];

        // Get latest location for marker
        const latestLocation: TeamLocation[] = session.gpsLogs.length > 0 ? [{
          userId: user.id,
          userName: user.name,
          latitude: session.gpsLogs[session.gpsLogs.length - 1].latitude,
          longitude: session.gpsLogs[session.gpsLogs.length - 1].longitude,
          timestamp: session.gpsLogs[session.gpsLogs.length - 1].timestamp
        }] : [];

        return { locations: latestLocation, trails, selectedUserId: user.id };
      }
    }
    
    // Overview: show all recent locations
    const locations: TeamLocation[] = [];
    const trails: SessionTrail[] = [];
    
    // Get latest positions from each session
    gpsSessions.slice(0, 5).forEach(session => {
      if (session.gpsLogs && session.gpsLogs.length > 0) {
        const latestLog = session.gpsLogs[session.gpsLogs.length - 1];
        locations.push({
          userId: user.id,
          userName: user.name,
          latitude: latestLog.latitude,
          longitude: latestLog.longitude,
          timestamp: latestLog.timestamp
        });
        
        // Add simplified trail (every 10th point for performance)
        const simplifiedTrail: TrailPoint[] = session.gpsLogs
          .filter((_, index) => index % 10 === 0)
          .map(log => ({
            lat: log.latitude,
            lng: log.longitude,
            timestamp: log.timestamp
          }));
          
        if (simplifiedTrail.length > 0) {
          trails.push({
            userId: user.id + '_' + (session.sessionId || session.id),
            userName: user.name,
            trail: simplifiedTrail
          });
        }
      }
    });

    return { locations, trails, selectedUserId: null };
  }, [gpsSessions, mapView, selectedSessionId, user]);

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback>
                {user.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{user.name}</div>
              <div className="text-sm text-muted-foreground">@{user.username}</div>
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
                <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
                  {pendingTasks.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="clients">Clients</TabsTrigger>
            <TabsTrigger value="map">
              <Route className="h-4 w-4 mr-1" />
              Map
            </TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[500px] pr-4">
            <TabsContent value="overview" className="space-y-4 mt-4">
              {/* Status and Role */}
              <div className="flex items-center gap-2">
                <Badge variant={getStatusBadgeVariant(user.status)}>
                  {user.status}
                </Badge>
                <Badge variant={getRoleBadgeVariant(user.role)}>
                  {user.role.replace('_', ' ')}
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
                        <p className="text-xs text-muted-foreground">Total Clients</p>
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
                        <p className="text-xs text-muted-foreground">Assigned Tasks</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {user.role === 'LEAD_MR' && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-purple-500" />
                        <div>
                          <p className="text-2xl font-bold text-purple-600">
                            {user._count.teamMembers}
                          </p>
                          <p className="text-xs text-muted-foreground">Team Members</p>
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
                        {user.email || 'No email provided'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {user.phone || 'No phone provided'}
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
                        <span className="text-sm">Lead MR: {user.leadMr.name}</span>
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
                      <div className="animate-pulse text-sm text-muted-foreground">Loading tasks...</div>
                    </div>
                  ) : taskError ? (
                    <div className="text-center py-4 text-sm text-destructive">{taskError}</div>
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
                          <div key={task.id} className="border rounded-lg p-3 space-y-2">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium text-sm">{task.title}</h4>
                                {task.description && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {task.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={getPriorityBadgeVariant(task.priority)} className="text-xs">
                                  <PriorityIcon className="h-3 w-3 mr-1" />
                                  {task.priority}
                                </Badge>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {task.region.name}{task.area && `, ${task.area.name}`}
                                </span>
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {task.createdBy.name}
                                </span>
                              </div>
                              {task.dueDate && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <DateDisplay date={new Date(task.dueDate)} format="MMM dd" />
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
                      <div className="animate-pulse text-sm text-muted-foreground">Loading clients...</div>
                    </div>
                  ) : clientError ? (
                    <div className="text-center py-4 text-sm text-destructive">{clientError}</div>
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
                              <h4 className="font-medium text-sm">{client.name}</h4>
                              <p className="text-xs text-muted-foreground">
                                {client.businessType}
                              </p>
                              {client.address && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {client.address}
                                </p>
                              )}
                            </div>
                            <Badge variant={client.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-xs">
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

            <TabsContent value="map" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Route className="h-4 w-4" />
                    User Route & GPS Tracking
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={mapView === 'overview' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setMapView('overview')}
                    >
                      Overview
                    </Button>
                    <Button
                      variant={mapView === 'session' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setMapView('session')}
                      disabled={gpsSessions.length === 0}
                    >
                      Session Details
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingGPS ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-pulse text-sm text-muted-foreground">Loading GPS data...</div>
                    </div>
                  ) : gpsError ? (
                    <div className="text-center py-8 text-sm text-destructive">{gpsError}</div>
                  ) : gpsSessions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Navigation className="h-8 w-8 mx-auto mb-2" />
                      <p>No GPS tracking data available</p>
                      <p className="text-xs">User hasn't started any tracking sessions yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Map Component */}
                      {(() => {
                        const mapData = getMapData();
                        const hasGoogleMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.length > 0;
                        const selectedSession = selectedSessionId ? gpsSessions.find(s => s.sessionId === selectedSessionId || s.id === selectedSessionId) : undefined;
                        
                        if (!hasGoogleMapsKey) {
                          return <MapFallback session={selectedSession} />;
                        }
                        
                        return (
                          <LiveMap
                            locations={mapData.locations}
                            trails={mapData.trails}
                            selectedUserId={mapData.selectedUserId}
                            follow={mapView === 'session'}
                          />
                        );
                      })()}
                      
                      {/* GPS Sessions List */}
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Recent Sessions ({gpsSessions.length})
                        </h4>
                        <div className="max-h-60 overflow-y-auto space-y-2">
                          {gpsSessions.map((session) => (
                            <div 
                              key={session.sessionId || session.id} 
                              className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                                selectedSessionId === (session.sessionId || session.id) 
                                  ? 'border-blue-500 bg-blue-50' 
                                  : 'hover:bg-gray-50'
                              }`}
                              onClick={() => {
                                setSelectedSessionId(session.sessionId || session.id);
                                setMapView('session');
                              }}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <DateDisplay 
                                      date={new Date(session.checkIn)} 
                                      format="MMM dd, yyyy" 
                                      className="font-medium text-sm"
                                    />
                                    {!session.checkOut && (
                                      <Badge variant="default" className="text-xs">Active</Badge>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    <DateDisplay 
                                      date={new Date(session.checkIn)} 
                                      format="h:mm a" 
                                    />
                                    {session.checkOut && (
                                      <>
                                        {' - '}
                                        <DateDisplay 
                                          date={new Date(session.checkOut)} 
                                          format="h:mm a" 
                                        />
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right text-xs">
                                  <div className="font-medium">{session.totalKm.toFixed(1)} km</div>
                                  <div className="text-muted-foreground">
                                    {Math.round(session.duration * 10) / 10}h
                                  </div>
                                  <div className="text-muted-foreground">
                                    {session.coordinateCount} points
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
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
                  <div className="flex items-center gap-3">
                    <div className="text-sm">
                      <span className="text-muted-foreground">User ID:</span>
                      <span className="ml-2 font-mono text-xs">{user.id}</span>
                    </div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Created:</span>
                      <div className="mt-1">
                        <DateDisplay 
                          date={user.createdAt} 
                          format="PPP 'at' p"
                          className="text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Last Updated:</span>
                      <div className="mt-1">
                        <DateDisplay 
                          date={user.updatedAt} 
                          format="PPP 'at' p"
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Role-specific Information */}
              {user.role === 'LEAD_MR' && user._count.teamMembers > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Team Leadership
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      This Lead MR manages {user._count.teamMembers} team member{user._count.teamMembers !== 1 ? 's' : ''}.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
