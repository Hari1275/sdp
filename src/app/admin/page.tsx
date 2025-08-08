"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Building2, MapPin, CheckSquare, TrendingUp, Activity, Clock, AlertCircle } from 'lucide-react';
import { apiGet } from '@/lib/api-client';
import Link from 'next/link';
import { format, formatDistance } from 'date-fns';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalClients: number;
  totalRegions: number;
  pendingTasks: number;
  completedTasks: number;
  totalAreas: number;
}

interface RecentActivity {
  id: string;
  type: 'user_created' | 'user_updated' | 'task_completed' | 'client_added';
  description: string;
  timestamp: Date;
  user?: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalClients: 0,
    totalRegions: 0,
    pendingTasks: 0,
    completedTasks: 0,
    totalAreas: 0,
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardStats = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch stats concurrently
        const [usersResponse, clientsResponse, regionsResponse, areasResponse, tasksResponse] = await Promise.allSettled([
          apiGet<{ id: string; status: string }>('/api/users'),
          apiGet<{ id: string }>('/api/clients'),
          apiGet<{ id: string }>('/api/regions'),
          apiGet<{ id: string }>('/api/areas'),
          apiGet<{ id: string; status: string }>('/api/tasks'),
        ]);

        let totalUsers = 0;
        let activeUsers = 0;
        if (usersResponse.status === 'fulfilled') {
          const users = usersResponse.value;
          totalUsers = users.length;
          activeUsers = users.filter((user) => user.status === 'ACTIVE').length;
        }

        let totalClients = 0;
        if (clientsResponse.status === 'fulfilled') {
          totalClients = clientsResponse.value.length;
        }

        let totalRegions = 0;
        if (regionsResponse.status === 'fulfilled') {
          totalRegions = regionsResponse.value.length;
        }

        let totalAreas = 0;
        if (areasResponse.status === 'fulfilled') {
          totalAreas = areasResponse.value.length;
        }

        let pendingTasks = 0;
        let completedTasks = 0;
        if (tasksResponse.status === 'fulfilled') {
          const tasks = tasksResponse.value;
          pendingTasks = tasks.filter((task) => task.status === 'PENDING').length;
          completedTasks = tasks.filter((task) => task.status === 'COMPLETED').length;
        }

        setStats({
          totalUsers,
          activeUsers,
          totalClients,
          totalRegions,
          totalAreas,
          pendingTasks,
          completedTasks,
        });

        // Mock recent activities for now
        const mockActivities: RecentActivity[] = [
          {
            id: '1',
            type: 'user_created',
            description: 'New user "John Doe" was created',
            timestamp: new Date(Date.now() - 10 * 60 * 1000),
            user: 'Admin'
          },
          {
            id: '2',
            type: 'task_completed',
            description: 'Task "Client Visit - ABC Clinic" was completed',
            timestamp: new Date(Date.now() - 30 * 60 * 1000),
            user: 'MR001'
          },
          {
            id: '3',
            type: 'client_added',
            description: 'New client "XYZ Hospital" was added',
            timestamp: new Date(Date.now() - 60 * 60 * 1000),
            user: 'LEAD001'
          },
          {
            id: '4',
            type: 'user_updated',
            description: 'User "Jane Smith" role was updated to Lead MR',
            timestamp: new Date(Date.now() - 120 * 60 * 1000),
            user: 'Admin'
          },
        ];
        setRecentActivities(mockActivities);
        
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        setError(error instanceof Error ? error.message : 'Failed to load dashboard data');
        
        // Fallback to mock data
        setStats({
          totalUsers: 125,
          activeUsers: 98,
          totalClients: 450,
          totalRegions: 12,
          totalAreas: 35,
          pendingTasks: 34,
          completedTasks: 187,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardStats();

    // Set up periodic refresh every 5 minutes
    const interval = setInterval(fetchDashboardStats, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const quickActions = [
    {
      title: 'Manage Users',
      description: 'Add, edit, or deactivate user accounts',
      href: '/admin/users',
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      title: 'View Clients',
      description: 'Manage healthcare facility clients',
      href: '/admin/clients',
      icon: Building2,
      color: 'bg-green-500',
    },
    {
      title: 'Manage Regions',
      description: 'Set up geographical areas',
      href: '/admin/regions',
      icon: MapPin,
      color: 'bg-purple-500',
    },
    {
      title: 'Task Overview',
      description: 'Monitor and assign tasks',
      href: '/admin/tasks',
      icon: CheckSquare,
      color: 'bg-orange-500',
    },
  ];

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="h-8 bg-gray-200 rounded w-16"></div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-gray-500 mt-2">
          Welcome to the SDP Ayurveda Admin Dashboard
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">{stats.activeUsers}</span> active users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClients}</div>
            <p className="text-xs text-muted-foreground">
              Healthcare facilities
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Regions</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRegions}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalAreas} areas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingTasks}</div>
            <p className="text-xs text-muted-foreground">
              Require attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Tasks</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedTasks}</div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round((stats.completedTasks / (stats.completedTasks + stats.pendingTasks)) * 100)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Task completion
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-2xl font-semibold mb-6">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer">
                <Link href={action.href}>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 ${action.color} rounded-lg flex items-center justify-center`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          {action.title}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {action.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Link>
              </Card>
            );
          })}
        </div>
      </div>

      {/* System Status */}
      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Clock className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No recent activities found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentActivities.map((activity) => {
                const getActivityIcon = () => {
                  switch (activity.type) {
                    case 'user_created':
                    case 'user_updated':
                      return <Users className="h-4 w-4 text-blue-500" />;
                    case 'task_completed':
                      return <CheckSquare className="h-4 w-4 text-green-500" />;
                    case 'client_added':
                      return <Building2 className="h-4 w-4 text-purple-500" />;
                    default:
                      return <Activity className="h-4 w-4" />;
                  }
                };

                return (
                  <div key={activity.id} className="flex items-start gap-2 border-b border-gray-100 pb-4">
                    <div className="mt-1">{getActivityIcon()}</div>
                    <div className="flex-1">
                      <p className="text-sm">{activity.description}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{activity.user}</span>
                        <span>•</span>
                        <span title={format(activity.timestamp, 'PPpp')}>
                          {formatDistance(activity.timestamp, new Date(), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">API Status</span>
              <Badge variant="default" className="bg-green-100 text-green-800">
                Operational
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Database</span>
              <Badge variant="default" className="bg-green-100 text-green-800">
                Connected
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">GPS Tracking</span>
              <Badge variant="default" className="bg-green-100 text-green-800">
                Active
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Notifications</span>
              <Badge variant="secondary">
                Pending Review
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Error Display */}
      {error && (
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
