"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ExportInterface() {
  const [reportType, setReportType] = useState<string>("DASHBOARD_OVERVIEW");
  const [format, setFormat] = useState<string>("CSV");

  const onExport = () => {
    // Placeholder for export flow
    // API endpoint can be added later: POST /api/reports/export
    alert(`Exporting ${reportType} as ${format}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Reports</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Report Type
            </label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger>
                <SelectValue placeholder="Select report type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DASHBOARD_OVERVIEW">
                  Dashboard Overview
                </SelectItem>
                <SelectItem value="USER_PERFORMANCE">
                  User Performance
                </SelectItem>
                <SelectItem value="TASK_COMPLETION">Task Completion</SelectItem>
                <SelectItem value="CLIENT_ACTIVITY">Client Activity</SelectItem>
                <SelectItem value="GPS_TRACKING">GPS Tracking</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Format</label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger>
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CSV">CSV</SelectItem>
                <SelectItem value="XLSX">Excel</SelectItem>
                <SelectItem value="PDF">PDF</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={onExport} className="w-full">
              Export
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
