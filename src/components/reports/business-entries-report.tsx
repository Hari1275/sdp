"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DocumentPreview } from "@/components/ui/DocumentPreview";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  TrendingUp, 
  MapPin, 
  Calendar, 
  Building2,
  Download,
  Eye,
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

type BusinessEntry = {
  id: string;
  amount: number;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  documentLink: string | null;
  createdAt: string;
  client: {
    id: string;
    name: string;
    businessType: string;
    region: { id: string; name: string } | null;
    area: { id: string; name: string } | null;
    mr: { id: string; name: string } | null;
  };
};

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
});

function BusinessEntryDetailsDialog({ 
  entry,
}: { 
  entry: BusinessEntry;
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
          <DialogTitle>Business Entry Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Amount</div>
              <div className="text-lg font-semibold text-green-600">
                {inr.format(entry.amount)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Date</div>
              <div className="font-medium">
                {new Date(entry.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
          
          <div>
            <div className="text-sm text-muted-foreground">Client</div>
            <div className="font-medium">{entry.client.name}</div>
            <div className="text-sm text-muted-foreground">
              {entry.client.businessType} • {entry.client.area?.name} • {entry.client.region?.name}
            </div>
          </div>
          
          <div>
            <div className="text-sm text-muted-foreground">Marketing Representative</div>
            <div className="font-medium">{entry.client.mr?.name || "Not assigned"}</div>
          </div>
          
            {entry.notes && (
            <div>
              <div className="text-sm text-muted-foreground">Notes</div>
              <div className="font-medium">{entry.notes}</div>
            </div>
          )}

          {entry.documentLink && (
            <div>
              <div className="text-sm text-muted-foreground">Document</div>
              <DocumentPreview documentLink={entry.documentLink} className="mt-2" />
            </div>
          )}
          
          {entry.latitude && entry.longitude && (
            <div>
              <div className="text-sm text-muted-foreground">Location</div>
              <div className="text-sm">
                {entry.latitude.toFixed(6)}, {entry.longitude.toFixed(6)}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function BusinessEntriesReport() {
  const [selectedPreset, setSelectedPreset] = useState("today");
  const [dateFrom, setDateFrom] = useState(getDatePreset("today").from);
  const [dateTo, setDateTo] = useState(getDatePreset("today").to);
  const [entries, setEntries] = useState<BusinessEntry[]>([]);
  const [loading, setLoading] = useState(true);
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
      const result = await safeApiCall<{ data: BusinessEntry[]; pagination: { page: number; limit: number; total: number } }>(
        `/api/business?dateFrom=${from}&dateTo=${to}&limit=100`
      );
      
      if (result.success) {
        setEntries(result.data.data || []);
      } else {
        setError(result.error || "Failed to fetch business entries");
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

  const exportData = async () => {
    try {
      // Fetch ALL data for export without pagination limits
      const result = await safeApiCall<{ data: BusinessEntry[]; pagination: { page: number; limit: number; total: number } }>(
        `/api/business?dateFrom=${dateFrom}&dateTo=${dateTo}&limit=10000` // High limit to get all data
      );
      
      if (!result.success || !result.data.data) {
        alert("Failed to fetch data for export");
        return;
      }

      const allEntries = result.data.data;
      
      const csvData = allEntries.map(entry => ({
        Date: new Date(entry.createdAt).toLocaleDateString(),
        Client: entry.client.name,
        "Business Type": entry.client.businessType,
        Amount: entry.amount,
        "Marketing Rep": entry.client.mr?.name || "Not assigned",
        Region: entry.client.region?.name || "Not assigned",
        Area: entry.client.area?.name || "Not assigned",
        Notes: entry.notes || "",
        Latitude: entry.latitude || "",
        Longitude: entry.longitude || "",
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
      a.download = `business-entries-${dateFrom}-to-${dateTo}.csv`;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calculate statistics
  const totalAmount = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const averageAmount = entries.length > 0 ? totalAmount / entries.length : 0;
  const uniqueClients = new Set(entries.map(e => e.client.id)).size;
  // const uniqueMRs = new Set(entries.map(e => e.client.mr?.id).filter(Boolean)).size;
  
  // Group by business type
  const byBusinessType = entries.reduce((acc, entry) => {
    const type = entry.client.businessType;
    if (!acc[type]) {
      acc[type] = { count: 0, amount: 0 };
    }
    acc[type].count++;
    acc[type].amount += entry.amount;
    return acc;
  }, {} as Record<string, { count: number; amount: number }>);

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
              <Button onClick={handleApply} disabled={loading}>
                Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center">
              <FileText className="h-4 w-4 text-blue-600 mr-2" />
              <div>
                <div className="text-2xl font-bold">{entries.length}</div>
                <div className="text-xs text-muted-foreground">Total Entries</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center">
              <DollarSign className="h-4 w-4 text-green-600 mr-2" />
              <div>
                <div className="text-2xl font-bold">{inr.format(totalAmount)}</div>
                <div className="text-xs text-muted-foreground">Total Amount</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center">
              <Building2 className="h-4 w-4 text-purple-600 mr-2" />
              <div>
                <div className="text-2xl font-bold">{uniqueClients}</div>
                <div className="text-xs text-muted-foreground">Unique Clients</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center">
              <TrendingUp className="h-4 w-4 text-orange-600 mr-2" />
              <div>
                <div className="text-2xl font-bold">{inr.format(averageAmount)}</div>
                <div className="text-xs text-muted-foreground">Average Entry</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Business Types Breakdown */}
      {Object.keys(byBusinessType).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Business Types Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(byBusinessType).map(([type, data]) => (
                <div key={type} className="p-4 border rounded-lg">
                  <div className="font-semibold">{type}</div>
                  <div className="text-sm text-muted-foreground">
                    {data.count} entries • {inr.format(data.amount)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Avg: {inr.format(data.amount / data.count)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Business Entries List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Business Entries</CardTitle>
          <Button variant="outline" onClick={exportData} disabled={entries.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading business entries...</div>
          ) : error ? (
            <div className="text-red-600 text-center py-8">{error}</div>
          ) : entries.length === 0 ? (
            <div className="text-muted-foreground text-center py-8">
              No business entries found for the selected period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 font-medium">Client</th>
                    <th className="text-left p-4 font-medium">Amount</th>
                    <th className="text-left p-4 font-medium">Date</th>
                    <th className="text-left p-4 font-medium">MR</th>
                    <th className="text-left p-4 font-medium">Location</th>
                    <th className="text-left p-4 font-medium">Document</th>
                    <th className="text-left p-4 font-medium">Notes</th>
                    <th className="text-left p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b hover:bg-muted/25 transition-colors">
                      <td className="p-4">
                        <div>
                          <div className="font-semibold">{entry.client.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {entry.client.businessType} • {entry.client.area?.name}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant="default" className="bg-green-100 text-green-800">
                          {inr.format(entry.amount)}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm">
                          {entry.client.mr?.name || "Not assigned"}
                        </div>
                      </td>
                      <td className="p-4">
                        {entry.latitude && entry.longitude ? (
                          <button
                            onClick={() => {
                              const url = `https://www.google.com/maps?q=${entry.latitude},${entry.longitude}`;
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
                        <DocumentPreview documentLink={entry.documentLink} />
                      </td>
                      <td className="p-4">
                        {entry.notes ? (
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
                                  {entry.notes}
                                </div>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(entry.notes || '');
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
                        <BusinessEntryDetailsDialog entry={entry} />
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