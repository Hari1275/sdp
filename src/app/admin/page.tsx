"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Building2,
  MapPin,
  CheckSquare,
  TrendingUp,
  Activity,
  AlertCircle,
} from "lucide-react";
import { safeApiCall } from "@/lib/api-client";
// import Link from 'next/link';
// import { format, formatDistance } from 'date-fns';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalClients: number;
  totalRegions: number;
  pendingTasks: number;
  completedTasks: number;
  totalAreas: number;
  totalKm: number;
}

interface RecentActivity {
  id: string;
  type: "user_created" | "user_updated" | "task_completed" | "client_added";
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
    totalKm: 0,
  });
  // Recent activity removed; keep setter no-op to avoid unused var
  const [, setRecentActivities] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardStats = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Use the specialized overview report API that provides role-based filtered data
        const overviewResult = await safeApiCall<{
          kpis: {
            totalUsers: number;
            activeUsers: number;
            totalClients: number;
            pendingTasks: number;
            completedTasks: number;
            totalKm: number;
          };
          trends: Array<{ date: string; tasksCreated: number }>;
          dateRange: { from: string; to: string };
        }>("/api/reports/overview");

        // Debug logging to understand the response structure
        console.log("Overview API Response:", overviewResult);

        if (overviewResult.success && overviewResult.data?.kpis) {
          const kpis = overviewResult.data.kpis;
          setStats({
            totalUsers: kpis.totalUsers,
            activeUsers: kpis.activeUsers,
            totalClients: kpis.totalClients,
            totalRegions: 0, // Not provided by overview API
            totalAreas: 0, // Not provided by overview API
            pendingTasks: kpis.pendingTasks,
            completedTasks: kpis.completedTasks,
            totalKm: kpis.totalKm,
          });
        } else {
          console.error("Invalid response format:", {
            success: overviewResult.success,
            hasData: overviewResult.success ? !!overviewResult.data : false,
            hasKpis: overviewResult.success ? !!overviewResult.data?.kpis : false,
            response: overviewResult
          });
          throw new Error(`Invalid response format from overview API. Success: ${overviewResult.success}, Has Data: ${overviewResult.success ? !!overviewResult.data : false}, Has KPIs: ${overviewResult.success ? !!overviewResult.data?.kpis : false}, Error: ${!overviewResult.success ? overviewResult.error : 'Unknown error'}`);
        }

        // Remove hardcoded Recent Activity; leave empty until real data is wired
        setRecentActivities([]);
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        setError(
          error instanceof Error
            ? error.message
            : "Failed to load dashboard data"
        );

        // Set stats to zero on error - no fallback data
        setStats({
          totalUsers: 0,
          activeUsers: 0,
          totalClients: 0,
          totalRegions: 0,
          totalAreas: 0,
          pendingTasks: 0,
          completedTasks: 0,
          totalKm: 0,
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

  // Quick Actions removed to avoid duplication with sidebar Quick Access

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
    <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          Dashboard Overview
        </h1>
        <p className="text-gray-500 mt-2">
          Welcome to the SDP Ayurveda Admin Dashboard
        </p>
        <p className="text-sm text-gray-400 mt-1">
          Showing data based on your role and permissions
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">{stats.activeUsers}</span> active
              users
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
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Completed Tasks
            </CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedTasks}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Completion Rate
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.completedTasks + stats.pendingTasks > 0
                ? Math.round(
                (stats.completedTasks /
                  (stats.completedTasks + stats.pendingTasks)) *
                  100
                  )
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground">Task completion</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">GPS Tracking</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalKm.toFixed(1)} km</div>
            <p className="text-xs text-muted-foreground">Total distance covered</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions removed; use sidebar Quick Access */}

      {/* System Status */}
      {/* Recent Activity removed (placeholder until real data is wired) */}

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
              <Badge variant="secondary">Pending Review</Badge>
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
