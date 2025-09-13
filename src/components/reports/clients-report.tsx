"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  TrendingUp, 
  MapPin, 
  Calendar,
  Download,
  Eye,
  Activity,
  UserPlus,
  FileText
} from "lucide-react";
import { safeApiCall } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

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

type Client = {
  id: string;
  name: string;
  phone: string | null;
  businessType: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  region: { id: string; name: string } | null;
  area: { id: string; name: string } | null;
  mr: { id: string; name: string } | null;
  _count: { businessEntries: number };
};

type ClientStatistics = {
  overview: {
    totalClients: number;
    activeClients: number;
    inactiveClients: number;
    recentClients: number;
    clientsWithBusiness: number;
    clientsWithoutBusiness: number;
    activityRate: string;
  };
  growth: {
    currentPeriodClients: number;
    previousPeriodClients: number;
    growthRate: number;
    growthTrend: 'up' | 'down' | 'stable';
  };
  businessTypes: Array<{
    businessType: string;
    count: number;
    percentage: string;
  }>;
  areas: Array<{
    areaId: string;
    areaName: string;
    regionName: string;
    count: number;
  }>;
  topMRs: Array<{
    mrId: string;
    mrName: string;
    mrUsername: string;
    count: number;
  }>;
};

function ClientDetailsDialog({ 
  client,
}: { 
  client: Client;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Eye className="h-4 w-4 mr-1" />
          View
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Client Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="text-sm text-muted-foreground">Client Name</div>
            <div className="text-lg font-semibold">{client.name}</div>
            <div className="text-sm text-muted-foreground">
              {client.businessType}
            </div>
          </div>
          
          {client.phone && (
            <div>
              <div className="text-sm text-muted-foreground">Phone</div>
              <div className="font-medium">{client.phone}</div>
            </div>
          )}
          
          {client.address && (
            <div>
              <div className="text-sm text-muted-foreground">Address</div>
              <div className="font-medium">{client.address}</div>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Region</div>
              <div className="font-medium">{client.region?.name || "Not assigned"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Area</div>
              <div className="font-medium">{client.area?.name || "Not assigned"}</div>
            </div>
          </div>
          
          <div>
            <div className="text-sm text-muted-foreground">Marketing Representative</div>
            <div className="font-medium">{client.mr?.name || "Not assigned"}</div>
          </div>
          
          <div>
            <div className="text-sm text-muted-foreground">Business Entries</div>
            <div className="font-medium">{client._count.businessEntries} entries</div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Created</div>
              <div className="text-sm">{new Date(client.createdAt).toLocaleDateString()}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Updated</div>
              <div className="text-sm">{new Date(client.updatedAt).toLocaleDateString()}</div>
            </div>
          </div>
          
          {client.notes && (
            <div>
              <div className="text-sm text-muted-foreground">Notes</div>
              <div className="font-medium">{client.notes}</div>
            </div>
          )}
          
          {client.latitude && client.longitude && (
            <div>
              <div className="text-sm text-muted-foreground">Location</div>
              <div className="text-sm">
                {client.latitude.toFixed(6)}, {client.longitude.toFixed(6)}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ClientsReport() {
  const [selectedPreset, setSelectedPreset] = useState("today");
  const [dateFrom, setDateFrom] = useState(getDatePreset("today").from);
  const [dateTo, setDateTo] = useState(getDatePreset("today").to);
  const [clients, setClients] = useState<Client[]>([]);
  const [statistics, setStatistics] = useState<ClientStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      // Fetch clients
      const clientsResult = await safeApiCall<{ data: Client[]; pagination: { page: number; limit: number; total: number } }>(
        `/api/clients?dateFrom=${from}&dateTo=${to}&limit=100`
      );
      
      if (clientsResult.success) {
        setClients(clientsResult.data.data || []);
      } else {
        setError(clientsResult.error || "Failed to fetch clients");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async (from: string, to: string) => {
    setStatsLoading(true);
    
    try {
      const statsResult = await safeApiCall<ClientStatistics>(
        `/api/clients/statistics?dateFrom=${from}&dateTo=${to}`
      );
      
      if (statsResult.success) {
        setStatistics(statsResult.data);
      }
    } catch (e) {
      console.error("Failed to fetch statistics:", e);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleApply = () => {
    fetchData(dateFrom, dateTo);
    fetchStatistics(dateFrom, dateTo);
  };

  const exportData = async () => {
    try {
      // Fetch ALL data for export without pagination limits
      const result = await safeApiCall<{ data: Client[]; pagination: { page: number; limit: number; total: number } }>(
        `/api/clients?dateFrom=${dateFrom}&dateTo=${dateTo}&limit=10000` // High limit to get all data
      );
      
      if (!result.success || !result.data.data) {
        alert("Failed to fetch data for export");
        return;
      }

      const allClients = result.data.data;
      
      const csvData = allClients.map(client => ({
        Name: client.name,
        Phone: client.phone || "",
        "Business Type": client.businessType,
        Address: client.address || "",
        Region: client.region?.name || "Not assigned",
        Area: client.area?.name || "Not assigned",
        "Marketing Rep": client.mr?.name || "Not assigned",
        "Business Entries": client._count.businessEntries,
        "Created Date": new Date(client.createdAt).toLocaleDateString(),
        Notes: client.notes || "",
        Latitude: client.latitude || "",
        Longitude: client.longitude || "",
      }));

      if (csvData.length === 0) {
        alert("No data to export for the selected date range");
        return;
      }

      const csv = [
        Object.keys(csvData[0]).join(","),
        ...csvData.map(row => Object.values(row).map(v => `"${v}"`).join(","))
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clients-${dateFrom}-to-${dateTo}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export data. Please try again.");
    }
  };

  useEffect(() => {
    fetchData(dateFrom, dateTo);
    fetchStatistics(dateFrom, dateTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              <Button onClick={handleApply} disabled={loading || statsLoading}>
                Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center">
                <Users className="h-4 w-4 text-blue-600 mr-2" />
                <div>
                  <div className="text-2xl font-bold">{statistics.overview.totalClients}</div>
                  <div className="text-xs text-muted-foreground">Total Clients</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center">
                <Activity className="h-4 w-4 text-green-600 mr-2" />
                <div>
                  <div className="text-2xl font-bold">{statistics.overview.activeClients}</div>
                  <div className="text-xs text-muted-foreground">Active Clients</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center">
                <UserPlus className="h-4 w-4 text-purple-600 mr-2" />
                <div>
                  <div className="text-2xl font-bold">{statistics.growth.currentPeriodClients}</div>
                  <div className="text-xs text-muted-foreground">New Clients</div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center">
                <TrendingUp className={`h-4 w-4 mr-2 ${
                  statistics.growth.growthTrend === 'up' ? 'text-green-600' : 
                  statistics.growth.growthTrend === 'down' ? 'text-red-600' : 'text-gray-600'
                }`} />
                <div>
                  <div className="text-2xl font-bold">
                    {statistics.growth.growthRate > 0 ? '+' : ''}{statistics.growth.growthRate}%
                  </div>
                  <div className="text-xs text-muted-foreground">Growth Rate</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Business Types Breakdown */}
      {statistics && statistics.businessTypes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Business Types Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {statistics.businessTypes.map((type) => (
                <div key={type.businessType} className="p-4 border rounded-lg">
                  <div className="font-semibold">{type.businessType}</div>
                  <div className="text-sm text-muted-foreground">
                    {type.count} clients • {type.percentage}%
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Areas */}
      {statistics && statistics.areas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Areas by Client Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {statistics.areas.slice(0, 10).map((area) => (
                <div key={area.areaId} className="flex justify-between items-center p-2 border rounded">
                  <div>
                    <div className="font-medium">{area.areaName}</div>
                    <div className="text-sm text-muted-foreground">{area.regionName}</div>
                  </div>
                  <Badge variant="secondary">{area.count} clients</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top MRs */}
      {statistics && statistics.topMRs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Marketing Representatives</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {statistics.topMRs.slice(0, 10).map((mr) => (
                <div key={mr.mrId} className="flex justify-between items-center p-2 border rounded">
                  <div>
                    <div className="font-medium">{mr.mrName}</div>
                    <div className="text-sm text-muted-foreground">@{mr.mrUsername}</div>
                  </div>
                  <Badge variant="default">{mr.count} clients</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clients List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Clients</CardTitle>
          <Button variant="outline" onClick={exportData} disabled={clients.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading clients...</div>
          ) : error ? (
            <div className="text-red-600 text-center py-8">{error}</div>
          ) : clients.length === 0 ? (
            <div className="text-muted-foreground text-center py-8">
              No clients found for the selected period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 font-medium">Client</th>
                    <th className="text-left p-4 font-medium">Business Type</th>
                    <th className="text-left p-4 font-medium">Phone</th>
                    <th className="text-left p-4 font-medium">MR</th>
                    <th className="text-left p-4 font-medium">Entries</th>
                    <th className="text-left p-4 font-medium">Created</th>
                    <th className="text-left p-4 font-medium">Location</th>
                    <th className="text-left p-4 font-medium">Address</th>
                    <th className="text-left p-4 font-medium">Notes</th>
                    <th className="text-left p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id} className="border-b hover:bg-muted/25 transition-colors">
                      <td className="p-4">
                        <div>
                          <div className="font-semibold">{client.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {client.area?.name} • {client.region?.name}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">{client.businessType}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          {client.phone || <span className="text-muted-foreground">No phone</span>}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          {client.mr?.name || "Not assigned"}
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge 
                          variant={client._count.businessEntries > 0 ? "default" : "secondary"}
                        >
                          {client._count.businessEntries} entries
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          {new Date(client.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="p-4">
                        {client.latitude && client.longitude ? (
                          <button
                            onClick={() => {
                              const url = `https://www.google.com/maps?q=${client.latitude},${client.longitude}`;
                              window.open(url, '_blank');
                            }}
                            className="flex items-center text-blue-600 hover:text-blue-800 text-sm underline"
                          >
                            <MapPin className="h-3 w-3 mr-1" />
                            View on Map
                          </button>
                        ) : (
                          <span className="text-muted-foreground text-sm">No location</span>
                        )}
                      </td>
                      <td className="p-4">
                        {client.address ? (
                          <HoverCard>
                            <HoverCardTrigger asChild>
                              <button className="flex items-center text-green-600 hover:text-green-800 text-sm">
                                <MapPin className="h-3 w-3 mr-1" />
                                View Address
                              </button>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-80 p-4">
                              <div className="space-y-2">
                                <div className="font-medium text-green-800">Address</div>
                                <div className="text-sm break-words max-h-40 overflow-y-auto">
                                  {client.address}
                                </div>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(client.address || '');
                                    alert('Address copied to clipboard!');
                                  }}
                                  className="text-xs text-green-600 hover:text-green-800 underline"
                                >
                                  Copy to clipboard
                                </button>
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        ) : (
                          <span className="text-muted-foreground text-sm">No address</span>
                        )}
                      </td>
                      <td className="p-4">
                        {client.notes ? (
                          <HoverCard>
                            <HoverCardTrigger asChild>
                              <button className="flex items-center text-yellow-600 hover:text-yellow-800 text-sm">
                                <FileText className="h-3 w-3 mr-1" />
                                View Notes
                              </button>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-80 p-4">
                              <div className="space-y-2">
                                <div className="font-medium text-yellow-800">Notes</div>
                                <div className="text-sm break-words max-h-40 overflow-y-auto">
                                  {client.notes}
                                </div>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(client.notes || '');
                                    alert('Notes copied to clipboard!');
                                  }}
                                  className="text-xs text-yellow-600 hover:text-yellow-800 underline"
                                >
                                  Copy to clipboard
                                </button>
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        ) : (
                          <span className="text-muted-foreground text-sm">No notes</span>
                        )}
                      </td>
                      <td className="p-4">
                        <ClientDetailsDialog client={client} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}