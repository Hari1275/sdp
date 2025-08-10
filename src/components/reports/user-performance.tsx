"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import * as Sentry from "@sentry/nextjs";
import { safeApiCall } from "@/lib/api-client";

type Row = {
  userId: string;
  name: string;
  username: string;
  regionId: string | null;
  tasksAssigned: number;
  tasksCompleted: number;
  completionRate: number;
  totalKm: number;
  gpsSessions: number;
  businessEntries: number;
  businessAmount: number;
};

export default function UserPerformance() {
  const [dateFrom, setDateFrom] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [dateTo, setDateTo] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await safeApiCall<{ data: Row[] }>(
        `/api/reports/user-performance?dateFrom=${dateFrom}&dateTo=${dateTo}`
      );
      if (res.success) {
        const payload = res.data as unknown;
        const maybe = payload as { data?: Row[] };
        const data = Array.isArray(maybe?.data)
          ? maybe.data!
          : Array.isArray(payload)
          ? (payload as Row[])
          : [];
        setRows(data);
      } else {
        setError(res.error);
        Sentry.captureMessage(`User performance load failed: ${res.error}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      Sentry.captureException(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[200px]"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[200px]"
          />
        </div>
        <Button onClick={load}>Apply</Button>
      </div>

      {loading ? (
        <Card className="animate-pulse">
          <CardContent className="pt-6">Loading...</CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="pt-6 text-red-600">{error}</CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>User Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="p-2">User</th>
                    <th className="p-2">Assigned</th>
                    <th className="p-2">Completed</th>
                    <th className="p-2">Completion</th>
                    <th className="p-2">Total Km</th>
                    <th className="p-2">GPS Sessions</th>
                    <th className="p-2">Business Entries</th>
                    <th className="p-2">Business Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.userId} className="border-t">
                      <td className="p-2">
                        {r.name}{" "}
                        <span className="text-xs text-gray-500">
                          ({r.username})
                        </span>
                      </td>
                      <td className="p-2">{r.tasksAssigned}</td>
                      <td className="p-2">{r.tasksCompleted}</td>
                      <td className="p-2">{r.completionRate}%</td>
                      <td className="p-2">{r.totalKm}</td>
                      <td className="p-2">{r.gpsSessions}</td>
                      <td className="p-2">{r.businessEntries}</td>
                      <td className="p-2">{r.businessAmount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
