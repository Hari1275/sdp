"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  Clock, 
  Building2, 
  FileText, 
  User, 
  Download,
  Eye,
  Calendar
} from "lucide-react";
import { safeApiCall } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatSessionDateTime, formatSessionTimeRange } from "@/lib/session-date-utils";

// Date utility functions
function getDatePreset(preset: string): { from: string; to: string } {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  
  switch (preset) {
    case "today":
      return { from: todayStr, to: todayStr };
    case "thisWeek": {
      const monday = new Date(today);
      monday.setDate(today.getDate() - today.getDay() + 1);
      return { from: monday.toISOString().slice(0, 10), to: todayStr };
    }
    case "thisMonth": {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: firstDay.toISOString().slice(0, 10), to: todayStr };
    }
    case "previousMonth": {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      return {
        from: firstDay.toISOString().slice(0, 10),
        to: lastDay.toISOString().slice(0, 10),
      };
    }
    default:
      return { from: todayStr, to: todayStr };
  }
}

type MRRow = {
  userId: string;
  name: string;
  username: string;
  regionName?: string | null;
  totalKm: number;
  gpsSessions: number;
  businessEntries: number;
  businessAmount: number;
  joinedClientsCount?: number;
  completionRate: number;
  tasksCompleted: number;
  tasksAssigned: number;
};

type Session = {
  id: string;
  checkIn: string;
  checkOut: string | null;
  totalKm: number;
  startName?: string | null;
  endName?: string | null;
  businessEntriesCount: number;
  duration: string;
};

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
});

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

function SessionDetailsDialog({ 
  mrData, 
  dateFrom, 
  dateTo 
}: { 
  mrData: MRRow; 
  dateFrom: string; 
  dateTo: string; 
}) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    
    const fetchSessions = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const qs = new URLSearchParams({
          userId: mrData.userId,
          dateFrom,
          dateTo,
          status: "completed",
          limit: "20",
        });
        
        const resp = await fetch(`/api/tracking/sessions?${qs.toString()}`);
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        
        const data = await resp.json();
        const sessionsArr = data.sessions || [];
        
        // Process sessions to include calculated data
        const processedSessions: Session[] = sessionsArr.map((s: {
          id: string;
          checkIn: string;
          checkOut: string | null;
          totalKm?: number;
          startName?: string;
          endName?: string;
          businessEntriesCount?: number;
        }) => {
          const checkIn = new Date(s.checkIn);
          const checkOut = s.checkOut ? new Date(s.checkOut) : new Date();
          const durationMs = checkOut.getTime() - checkIn.getTime();
          const durationMinutes = Math.floor(durationMs / (1000 * 60));
          
          return {
            id: s.id,
            checkIn: s.checkIn,
            checkOut: s.checkOut,
            totalKm: Number((s.totalKm || 0).toFixed(2)),
            startName: s.startName || null,
            endName: s.endName || null,
            businessEntriesCount: s.businessEntriesCount || 0,
            duration: formatDuration(durationMinutes),
          };
        });
        
        setSessions(processedSessions);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load sessions");
      } finally {
        setLoading(false);
      }
    };
    
    fetchSessions();
  }, [open, mrData.userId, dateFrom, dateTo]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Eye className="h-4 w-4 mr-1" />
          View Sessions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            Sessions for {mrData.name} ({mrData.username})
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            Region: {mrData.regionName || "Not assigned"} | 
            Period: {dateFrom} to {dateTo}
          </div>
        </DialogHeader>
        
        <div className="max-h-[60vh] overflow-auto">
          {loading ? (
            <div className="text-center py-4">Loading sessions...</div>
          ) : error ? (
            <div className="text-red-600 text-center py-4">{error}</div>
          ) : sessions.length === 0 ? (
            <div className="text-muted-foreground text-center py-4">
              No sessions found for this period.
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <Card key={session.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="font-medium text-muted-foreground mb-1">
                          Session Date & Duration
                        </div>
                        <div className="font-semibold">
                          {formatSessionDateTime(session.checkIn, { dateFormat: 'medium' })}
                        </div>
                        <div className="flex items-center text-muted-foreground">
                          <Clock className="h-3 w-3 mr-1" />
                          {session.duration}
                        </div>
                      </div>
                      
                      <div>
                        <div className="font-medium text-muted-foreground mb-1">
                          Distance Covered
                        </div>
                        <div className="flex items-center font-semibold text-green-600">
                          <MapPin className="h-3 w-3 mr-1" />
                          {session.totalKm} km
                        </div>
                      </div>
                      
                      <div>
                        <div className="font-medium text-muted-foreground mb-1">
                          Business Entries
                        </div>
                        <div className="flex items-center font-semibold">
                          <FileText className="h-3 w-3 mr-1" />
                          {session.businessEntriesCount}
                        </div>
                      </div>
                      
                      <div>
                        <div className="font-medium text-muted-foreground mb-1">
                          Check-in / Check-out
                        </div>
                        <div className="text-xs">
                          {formatSessionTimeRange(session.checkIn, session.checkOut)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SimplifiedMRPerformance() {
  const [selectedPreset, setSelectedPreset] = useState("today");
  const [dateFrom, setDateFrom] = useState(getDatePreset("today").from);
  const [dateTo, setDateTo] = useState(getDatePreset("today").to);
  const [mrData, setMrData] = useState<MRRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const datePresets = [
    { value: "today", label: "Today" },
    { value: "thisWeek", label: "This Week" },
    { value: "thisMonth", label: "This Month" },
    { value: "previousMonth", label: "Previous Month" },
  ];

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    const dates = getDatePreset(preset);
    setDateFrom(dates.from);
    setDateTo(dates.to);
  };

  const fetchData = async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await safeApiCall<{ data: MRRow[] }>(
        `/api/reports/user-performance?dateFrom=${from}&dateTo=${to}`
      );
      
      if (result.success) {
        const payload = result.data as { data?: MRRow[] } | MRRow[];
        const data = Array.isArray(payload) ? payload : 
                    (payload && 'data' in payload && Array.isArray(payload.data)) ? payload.data : [];
        
        // Filter to only show MRs who have at least 1 GPS session
        const filteredData = data.filter(mr => mr.gpsSessions > 0);
        setMrData(filteredData);
      } else {
        setError(result.error || "Failed to fetch data");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    fetchData(dateFrom, dateTo);
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      
      if (mrData.length === 0) {
        alert("No data available for the selected period.");
        return;
      }
      
      const csvData = mrData.map(mr => ({
        Name: mr.name,
        Username: mr.username,
        Region: mr.regionName || "Not assigned",
        "Total KM": mr.totalKm.toFixed(1),
        "GPS Sessions": mr.gpsSessions,
        "Business Entries": mr.businessEntries,
        "Business Amount": inr.format(mr.businessAmount),
        "Clients Joined": mr.joinedClientsCount || 0,
        "Tasks Completed": mr.tasksCompleted,
        "Tasks Assigned": mr.tasksAssigned,
        "Completion Rate": `${mr.completionRate}%`,
      }));

      const csv = [
        Object.keys(csvData[0]).join(","),
        ...csvData.map(row => Object.values(row).map(v => `"${v}"`).join(","))
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mr-performance-${dateFrom}-to-${dateTo}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export data. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    fetchData(dateFrom, dateTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalStats = mrData.reduce(
    (acc, mr) => ({
      totalMRs: acc.totalMRs + 1,
      totalKm: acc.totalKm + mr.totalKm,
      totalSessions: acc.totalSessions + mr.gpsSessions,
      totalEntries: acc.totalEntries + mr.businessEntries,
      totalAmount: acc.totalAmount + mr.businessAmount,
    }),
    { totalMRs: 0, totalKm: 0, totalSessions: 0, totalEntries: 0, totalAmount: 0 }
  );

  return (
    <div className="space-y-6">
      {/* Date Filter Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Select Date Range
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            {/* Preset Buttons */}
            <div className="flex flex-wrap gap-2">
              {datePresets.map((preset) => (
                <Button
                  key={preset.value}
                  variant={selectedPreset === preset.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePresetChange(preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            
            {/* Custom Date Inputs */}
            <div className="flex gap-2 items-end">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setSelectedPreset("");
                  }}
                  className="px-3 py-2 border border-input bg-background text-sm rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setSelectedPreset("");
                  }}
                  className="px-3 py-2 border border-input bg-background text-sm rounded-md"
                />
              </div>
              <Button onClick={handleApply} disabled={loading}>
                Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center">
              <User className="h-4 w-4 text-blue-600 mr-2" />
              <div>
                <div className="text-2xl font-bold">{totalStats.totalMRs}</div>
                <div className="text-xs text-muted-foreground">Total MRs</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center">
              <MapPin className="h-4 w-4 text-green-600 mr-2" />
              <div>
                <div className="text-2xl font-bold">{totalStats.totalKm.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">Total KM</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center">
              <Clock className="h-4 w-4 text-orange-600 mr-2" />
              <div>
                <div className="text-2xl font-bold">{totalStats.totalSessions}</div>
                <div className="text-xs text-muted-foreground">Sessions</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center">
              <FileText className="h-4 w-4 text-purple-600 mr-2" />
              <div>
                <div className="text-2xl font-bold">{totalStats.totalEntries}</div>
                <div className="text-xs text-muted-foreground">Entries</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center">
              <Building2 className="h-4 w-4 text-indigo-600 mr-2" />
              <div>
                <div className="text-2xl font-bold">{inr.format(totalStats.totalAmount)}</div>
                <div className="text-xs text-muted-foreground">Revenue</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MR Performance Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>MR Performance Details</CardTitle>
          <Button 
            variant="outline" 
            onClick={handleExport} 
            disabled={mrData.length === 0 || exporting}
          >
            {exporting ? (
              <>
                <span className="inline-block animate-spin mr-2">⟳</span>
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading MR data...</div>
          ) : error ? (
            <div className="text-red-600 text-center py-8">{error}</div>
          ) : mrData.length === 0 ? (
            <div className="text-muted-foreground text-center py-8">
              No data found for the selected period.
            </div>
          ) : (
            <div className="space-y-4">
              {mrData.map((mr) => (
                <Card key={mr.userId} className="border-l-4 border-l-primary">
                  <CardContent className="pt-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div>
                            <h3 className="font-semibold text-lg">{mr.name}</h3>
                            <div className="text-sm text-muted-foreground">
                              @{mr.username} • {mr.regionName || "No region"}
                            </div>
                          </div>
                          <Badge 
                            variant={mr.completionRate >= 80 ? "default" : "secondary"}
                            className="ml-2"
                          >
                            {mr.completionRate}% completion
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 text-green-600 mr-2" />
                            <div>
                              <div className="font-semibold">{mr.totalKm.toFixed(1)} km</div>
                              <div className="text-muted-foreground">Distance</div>
                            </div>
                          </div>
                          
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 text-orange-600 mr-2" />
                            <div>
                              <div className="font-semibold">{mr.gpsSessions}</div>
                              <div className="text-muted-foreground">Sessions</div>
                            </div>
                          </div>
                          
                          <div className="flex items-center">
                            <FileText className="h-4 w-4 text-purple-600 mr-2" />
                            <div>
                              <div className="font-semibold">{mr.businessEntries}</div>
                              <div className="text-muted-foreground">Entries</div>
                            </div>
                          </div>
                          
                          <div className="flex items-center">
                            <Building2 className="h-4 w-4 text-indigo-600 mr-2" />
                            <div>
                              <div className="font-semibold">{mr.joinedClientsCount || 0}</div>
                              <div className="text-muted-foreground">Clients</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-2">
                        <SessionDetailsDialog 
                          mrData={mr} 
                          dateFrom={dateFrom} 
                          dateTo={dateTo} 
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}