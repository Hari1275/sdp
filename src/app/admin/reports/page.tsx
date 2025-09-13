"use client";

import SimplifiedMRPerformance from "@/components/reports/simplified-mr-performance";
import BusinessEntriesReport from "@/components/reports/business-entries-report";
import ClientsReport from "@/components/reports/clients-report";
import TasksReport from "@/components/reports/tasks-report";
import ExportInterface from "@/components/reports/export-interface";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ReportsPage() {
  return (
    <div className="min-h-screen">
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-2">Comprehensive Reports</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Complete analytics for Marketing Representatives, Business Entries, Clients, and Tasks.
        </p>
        <Tabs defaultValue="performance" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="performance">MR Performance</TabsTrigger>
            <TabsTrigger value="business">Business Entries</TabsTrigger>
            <TabsTrigger value="clients">Clients</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>
          <TabsContent value="performance">
            <SimplifiedMRPerformance />
          </TabsContent>
          <TabsContent value="business">
            <BusinessEntriesReport />
          </TabsContent>
          <TabsContent value="clients">
            <ClientsReport />
          </TabsContent>
          <TabsContent value="tasks">
            <TasksReport />
          </TabsContent>
          <TabsContent value="export">
            <ExportInterface />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
