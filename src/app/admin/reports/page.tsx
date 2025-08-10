"use client";

import DashboardOverview from "@/components/reports/dashboard-overview";
import UserPerformance from "@/components/reports/user-performance";
import ExportInterface from "@/components/reports/export-interface";
import RegionalPerformance from "@/components/reports/regional-performance";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ReportsPage() {
  return (
    <div className="min-h-screen">
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-2">Reports</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Basic reporting dashboard with KPIs and trends.
        </p>
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="user">User Performance</TabsTrigger>
            <TabsTrigger value="regional">Regional</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <DashboardOverview />
          </TabsContent>
          <TabsContent value="user">
            <UserPerformance />
          </TabsContent>
          <TabsContent value="regional">
            <RegionalPerformance />
          </TabsContent>
          <TabsContent value="export">
            <ExportInterface />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
