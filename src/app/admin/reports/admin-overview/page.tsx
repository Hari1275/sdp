"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download } from "lucide-react";

interface JoinedClient {
  id: string;
  name: string;
  date: string;
}
interface MRRow {
  userId: string;
  name: string;
  employeeId: string;
  designation: string;
  totalKm: number;
  businessEntries: number;
  businessAmount: number;
  joinedClients: JoinedClient[];
}
interface LeadRow {
  userId: string;
  name: string;
  employeeId: string;
  teamMembers: MRRow[];
  totalKm: number;
  businessEntries: number;
  businessAmount: number;
  joinedClients: JoinedClient[];
}

function exportCsv(filename: string, rows: Array<Record<string, unknown>>) {
  const headers = Object.keys(rows[0] || {});
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => {
          const v = r[h];
          if (v === null || v === undefined) return "";
          const s = typeof v === "string" ? v : JSON.stringify(v);
          return '"' + s.replaceAll('"', '""') + '"';
        })
        .join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminOverviewReportPage() {
  const [mrs, setMrs] = useState<MRRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      const data = await apiGet<{ mrs: MRRow[]; leads: LeadRow[] }>(
        "/api/reports/admin-overview"
      );
      if (!mounted) return;
      if (Array.isArray(data) && (data as unknown as any).mrs === undefined) {
        // apiGet returns [] if unexpected; do nothing
        setMrs([]);
        setLeads([]);
      } else {
        const payload = data as unknown as any;
        setMrs(payload.mrs || []);
        setLeads(payload.leads || []);
      }
      setLoading(false);
    })().catch((e) => {
      if (!mounted) return;
      setError(e?.message || "Failed to load report");
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const mrExportRows = useMemo(
    () =>
      mrs.map((m) => ({
        userId: m.userId,
        name: m.name,
        employeeId: m.employeeId,
        designation: m.designation,
        totalKm: m.totalKm,
        businessEntries: m.businessEntries,
        businessAmount: m.businessAmount,
        joinedClients: m.joinedClients
          .map(
            (j) => `${j.name} (${new Date(j.date).toISOString().slice(0, 10)})`
          )
          .join("; "),
      })),
    [mrs]
  );

  const leadExportRows = useMemo(
    () =>
      leads.map((l) => ({
        userId: l.userId,
        name: l.name,
        employeeId: l.employeeId,
        teamMembers: l.teamMembers.map((t) => `${t.name}`).join("; "),
        totalKm: l.totalKm,
        businessEntries: l.businessEntries,
        businessAmount: l.businessAmount,
        joinedClients: l.joinedClients
          .map(
            (j) => `${j.name} (${new Date(j.date).toISOString().slice(0, 10)})`
          )
          .join("; "),
      })),
    [leads]
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            Admin Overview Report
          </h1>
          <p className="text-muted-foreground">
            MR and Lead MR performance summary with travel, business, and client
            metrics.
          </p>
        </div>
      </div>

      {error && (
        <Card className="border-red-200">
          <CardContent className="pt-6 text-red-600">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>MR Details</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              mrExportRows.length && exportCsv("mr-details.csv", mrExportRows)
            }
          >
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Total KM</TableHead>
                    <TableHead>Business Entries</TableHead>
                    <TableHead>Business Amount</TableHead>
                    <TableHead>Joined Clients</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mrs.map((m) => (
                    <TableRow key={m.userId}>
                      <TableCell>{m.name}</TableCell>
                      <TableCell>{m.employeeId}</TableCell>
                      <TableCell>{m.designation}</TableCell>
                      <TableCell>{m.totalKm.toFixed(2)}</TableCell>
                      <TableCell>{m.businessEntries}</TableCell>
                      <TableCell>{m.businessAmount.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {m.joinedClients.map((j) => (
                            <span key={j.id}>
                              {j.name} (
                              {new Date(j.date).toISOString().slice(0, 10)})
                            </span>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Lead MR Details</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              leadExportRows.length &&
              exportCsv("lead-mr-details.csv", leadExportRows)
            }
          >
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Team Members</TableHead>
                    <TableHead>Total KM (combined)</TableHead>
                    <TableHead>Business Entries</TableHead>
                    <TableHead>Business Amount</TableHead>
                    <TableHead>Joined Clients</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((l) => (
                    <TableRow key={l.userId}>
                      <TableCell>{l.name}</TableCell>
                      <TableCell>{l.employeeId}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {l.teamMembers.map((m) => (
                            <span key={m.userId}>
                              {m.name} ({m.totalKm.toFixed(2)} km,{" "}
                              {m.businessEntries} entries)
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{l.totalKm.toFixed(2)}</TableCell>
                      <TableCell>{l.businessEntries}</TableCell>
                      <TableCell>{l.businessAmount.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {l.joinedClients.map((j) => (
                            <span key={j.id}>
                              {j.name} (
                              {new Date(j.date).toISOString().slice(0, 10)})
                            </span>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
