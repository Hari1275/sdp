"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Users,
  Building2,
  CheckSquare,
  MapPin,
  Activity,
  Download,
  RotateCcw,
} from "lucide-react";
import { safeApiCall } from "@/lib/api-client";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import * as Sentry from "@sentry/nextjs";

type OverviewResponse = {
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
};

export default function DashboardOverview() {
  const [dateFrom, setDateFrom] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [dateTo, setDateTo] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OverviewResponse | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await safeApiCall<OverviewResponse>(
        `/api/reports/overview?dateFrom=${dateFrom}&dateTo=${dateTo}`
      );
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error);
        Sentry.captureMessage(`Overview load failed: ${result.error}`);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
      Sentry.captureException(e);
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    const defaultFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const defaultTo = new Date().toISOString().slice(0, 10);
    setDateFrom(defaultFrom);
    setDateTo(defaultTo);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-3">
        {/* Date Filter Section */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3">
          <div className="min-w-0">
            <label className="block text-xs text-gray-500 mb-1">From</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full sm:w-[180px] lg:w-[200px]"
            />
          </div>
          <div className="min-w-0">
            <label className="block text-xs text-gray-500 mb-1">To</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full sm:w-[180px] lg:w-[200px]"
            />
          </div>
        </div>

        {/* Action Buttons Section */}
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-2 lg:ml-auto">
          <div className="flex gap-2">
            <Button
              onClick={loadData}
              className="flex-1 sm:flex-none"
              disabled={loading}
            >
              Apply
            </Button>
            <Button
              variant="outline"
              onClick={resetFilters}
              className="flex-1 sm:flex-none"
              disabled={loading}
            >
              <RotateCcw className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
          </div>
          <Button variant="secondary" className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" />
            <span>Export</span>
          </Button>
        </div>
      </div>

      <Separator />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-24" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="pt-6 text-red-600">{error}</CardContent>
        </Card>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Users
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.kpis.totalUsers}</div>
                <div className="text-xs text-muted-foreground">
                  {data.kpis.activeUsers} active
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Clients
                </CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.kpis.totalClients}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Pending Tasks
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.kpis.pendingTasks}
                </div>
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
                <div className="text-2xl font-bold">
                  {data.kpis.completedTasks}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Kilometers
                </CardTitle>
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.kpis.totalKm}</div>
              </CardContent>
            </Card>
          </div>

          {/* Placeholder for trends table (simple) */}
          <Card>
            <CardHeader>
              <CardTitle>Task Trends (7d)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data.trends}
                    margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="colorTasks"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#10b981"
                          stopOpacity={0.4}
                        />
                        <stop
                          offset="95%"
                          stopColor="#10b981"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} />
                    <YAxis allowDecimals={false} />
                    <Tooltip labelFormatter={(d) => d} />
                    <Area
                      type="monotone"
                      dataKey="tasksCreated"
                      stroke="#10b981"
                      fillOpacity={1}
                      fill="url(#colorTasks)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
