"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatSessionTime } from "@/lib/session-date-utils";

type TrailPoint = { lat: number; lng: number; timestamp: string | Date };

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) {
  const R = 6371; // km
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const aa =
    sinDLat * sinDLat + Math.cos(la1) * Math.cos(la2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return R * c;
}

export default function LiveMovementChart({ trail }: { trail: TrailPoint[] }) {
  const data = useMemo(() => {
    if (!trail || trail.length < 2)
      return [] as Array<{ t: string; speed: number }>;
    const rows: Array<{ t: string; speed: number }> = [];
    for (let i = 1; i < trail.length; i++) {
      const prev = trail[i - 1];
      const curr = trail[i];
      const dtHrs =
        (new Date(curr.timestamp).getTime() -
          new Date(prev.timestamp).getTime()) /
        (1000 * 60 * 60);
      if (dtHrs <= 0) continue;
      const distKm = haversineKm(
        { lat: prev.lat, lng: prev.lng },
        { lat: curr.lat, lng: curr.lng }
      );
      const speed = distKm / dtHrs; // km/h
      rows.push({
        t: formatSessionTime(curr.timestamp),
        speed: Math.round(speed * 10) / 10,
      });
    }
    return rows;
  }, [trail]);

  return (
    <div className="w-full h-56 md:h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="t" tick={{ fontSize: 12 }} />
          <YAxis
            tick={{ fontSize: 12 }}
            domain={[0, "auto"]}
            label={{
              value: "km/h",
              angle: -90,
              position: "insideLeft",
              offset: 10,
            }}
          />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="speed"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
