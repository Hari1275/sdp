"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Building2,
  MapPin,
  CheckSquare,
  TrendingUp,
  Activity,
  AlertCircle,
} from "lucide-react";
import { apiGet } from "@/lib/api-client";

interface LeadMRStats {
  teamMRs: number;
  activeMRs: number;
  totalClients: number;
  totalRegions: number;
  pendingTasks: number;
  completedTasks: number;
  totalAreas: number;
}

export default function LeadMRDashboard() {
  const [stats, setStats] = useState<LeadMRStats>({
    teamMRs: 0,
    activeMRs: 0,
    totalClients: 0,
    totalRegions: 0,
    pendingTasks: 0,
    completedTasks: 0,
    totalAreas: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardStats = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch team-specific stats concurrently
        const [
          teamResponse,
          clientsResponse,
          tasksResponse,
        ] = await Promise.allSettled([
          apiGet<{ id: string; status: string }>("/api/users?role=MR"), // Only fetch MRs
          apiGet<{ id: string }>("/api/clients"),
          apiGet<{ id: string; status: string }>("/api/tasks"),
        ]);

        let teamMRs = 0;
        let activeMRs = 0;
        if (teamResponse.status === "fulfilled") {
          const team = teamResponse.value;
          teamMRs = team.length;
          activeMRs = team.filter((mr) => mr.status === "ACTIVE").length;
        }

        let totalClients = 0;
        if (clientsResponse.status === "fulfilled") {
          totalClients = clientsResponse.value.length;
        }

        let pendingTasks = 0;
        let completedTasks = 0;
        if (tasksResponse.status === "fulfilled") {
          const tasks = tasksResponse.value;
          pendingTasks = tasks.filter(
            (task) => task.status === "PENDING"
          ).length;
          completedTasks = tasks.filter(
            (task) => task.status === "COMPLETED"
          ).length;
        }

        setStats({
          teamMRs,
          activeMRs,
          totalClients,
          totalRegions: 1, // Lead MR has access to their own region
          totalAreas: 0,  // Will be updated when region info is available
          pendingTasks,
          completedTasks,
        });

      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to load dashboard data"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardStats();

    // Set up periodic refresh every 5 minutes
    const interval = setInterval(fetchDashboardStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

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
          Team Overview
        </h1>
        <p className="text-gray-500 mt-2">
          Lead MR Dashboard - Team Performance and Status
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.teamMRs}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">{stats.activeMRs}</span> active
              MRs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Clients</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalClients}</div>
            <p className="text-xs text-muted-foreground">
              Healthcare facilities managed by team
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Coverage</CardTitle>
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
            <CardTitle className="text-sm font-medium">Team Tasks</CardTitle>
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
              Team Performance
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(
                (stats.completedTasks /
                  (stats.completedTasks + stats.pendingTasks)) *
                  100
              )}
              %
            </div>
            <p className="text-xs text-muted-foreground">Task completion rate</p>
          </CardContent>
        </Card>
      </div>

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