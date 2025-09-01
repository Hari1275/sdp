"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { safeApiCall } from "@/lib/api-client";
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
  const [modalOpen, setModalOpen] = useState(false);
  const [modalText, setModalText] = useState<string>("");
  const [downloading, setDownloading] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const onExport = async () => {
    try {
      setDownloading(true);
      const res = await safeApiCall<{ downloadUrl: string }>(
        "/api/reports/export",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportType,
            format,
            parameters: {
              since: dateFrom ? new Date(dateFrom).toISOString() : undefined,
              to: dateTo ? new Date(dateTo).toISOString() : undefined,
            },
          }),
        }
      );
      if (res.success && res.data?.downloadUrl) {
        setModalText("Export generated. Your download will start shortly.");
        setModalOpen(true);
        setTimeout(() => {
          try {
            window.open(res.data.downloadUrl, "_blank");
          } catch {}
        }, 300);
      } else {
        const errMsg =
          (res as unknown as { success: false; error?: string }).error ||
          "Failed to export";
        setModalText(errMsg);
        setModalOpen(true);
      }
    } catch {
      setModalText("Unexpected error during export");
      setModalOpen(true);
    } finally {
      setDownloading(false);
    }
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
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input
                type="date"
                className="w-full border rounded-md h-9 px-2"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input
                type="date"
                className="w-full border rounded-md h-9 px-2"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
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
            <Button
              onClick={onExport}
              className="w-full"
              disabled={downloading}
            >
              {downloading ? (
                <span className="inline-flex items-center">
                  <svg
                    className="mr-2 h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    ></path>
                  </svg>
                  Preparing…
                </span>
              ) : (
                <>Export</>
              )}
            </Button>
          </div>
        </div>
        <AlertDialog
          open={modalOpen}
          onOpenChange={setModalOpen}
          title="Export"
          description={modalText}
          footer={<Button onClick={() => setModalOpen(false)}>Close</Button>}
        />
      </CardContent>
    </Card>
  );
}
