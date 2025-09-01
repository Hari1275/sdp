import { NextRequest, NextResponse } from "next/server";

// Simple in-memory cache for reverse geocoding results
// Key: `${lat.toFixed(5)},${lon.toFixed(5)}`
// Value: { name: string, expires: number }
const cache = new Map<string, { name: string; expires: number }>();
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function makeKey(lat: number, lon: number): string {
  return `${lat.toFixed(5)},${lon.toFixed(5)}`;
}

function compactName(payload: any): string | null {
  if (!payload) return null;
  const addr = payload.address || {};
  // Prefer neighborhood/suburb/locality, then city/town/village, then state
  const primary =
    addr.neighbourhood ||
    addr.suburb ||
    addr.locality ||
    addr.road ||
    addr.village ||
    addr.town ||
    addr.city ||
    addr.county;
  const secondary = addr.state || addr.county || addr.region;
  const country = addr.country;
  const display = payload.display_name as string | undefined;
  if (primary && secondary) return `${primary}, ${secondary}`;
  if (primary && country) return `${primary}, ${country}`;
  if (display) return display.split(",").slice(0, 2).join(", ").trim();
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const latStr = searchParams.get("lat");
    const lonStr = searchParams.get("lon") || searchParams.get("lng");

    if (!latStr || !lonStr) {
      return NextResponse.json({ error: "Missing lat/lon" }, { status: 400 });
    }

    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);
    if (!isFinite(lat) || !isFinite(lon)) {
      return NextResponse.json(
        { error: "Invalid coordinates" },
        { status: 400 }
      );
    }

    const key = makeKey(lat, lon);
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && cached.expires > now) {
      return NextResponse.json({ name: cached.name, source: "cache" });
    }

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lon)}&zoom=14&addressdetails=1`;

    const resp = await fetch(url, {
      headers: {
        // Nominatim requires a valid User-Agent identifying the application
        "User-Agent": "SDP-Ayurveda-Dashboard/1.0 (admin@sdp.local)",
        Accept: "application/json",
      },
    });

    if (!resp.ok) {
      return NextResponse.json(
        { error: `Geocoding failed: ${resp.status}` },
        { status: 502 }
      );
    }

    const data = await resp.json();
    const name = compactName(data) || "Unknown location";
    cache.set(key, { name, expires: now + TTL_MS });

    return NextResponse.json({ name, source: "nominatim" });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal error resolving location" },
      { status: 500 }
    );
  }
}
