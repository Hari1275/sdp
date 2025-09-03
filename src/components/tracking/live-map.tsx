"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GoogleMap,
  Marker,
  InfoWindow,
  Polyline as GPolyline,
  useJsApiLoader,
  MarkerClustererF,
} from "@react-google-maps/api";
import * as Sentry from "@sentry/nextjs";

type TeamLocation = {
  userId: string;
  userName: string;
  latitude: number;
  longitude: number;
  timestamp: string | Date;
};
type TrailPoint = { lat: number; lng: number; timestamp: string | Date };
type SessionTrail = { userId: string; userName: string; trail: TrailPoint[] };

export default function LiveMap({
  locations,
  trails,
  focus,
  selectedUserId,
  follow,
}: {
  locations: TeamLocation[];
  trails?: SessionTrail[];
  focus?: { lat: number; lng: number };
  selectedUserId?: string | null;
  follow?: boolean;
}) {
  const center = useMemo(() => {
    if (locations.length > 0) {
      return {
        lat: locations[0].latitude,
        lng: locations[0].longitude,
      } as google.maps.LatLngLiteral;
    }
    return { lat: 20.5937, lng: 78.9629 } as google.maps.LatLngLiteral; // India centroid fallback
  }, [locations]);

  const [openInfoUserId, setOpenInfoUserId] = useState<string | null>(null);
  const [mapRef, setMapRef] = useState<google.maps.Map | null>(null);
  const [highlight, setHighlight] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Ensure unique markers per user by keeping the latest location per userId
  const uniqueLocations = useMemo(() => {
    const latestByUser = new Map<string, TeamLocation>();
    for (const loc of locations) {
      const previous = latestByUser.get(loc.userId);
      const locTs = new Date(loc.timestamp).getTime();
      const prevTs = previous ? new Date(previous.timestamp).getTime() : -Infinity;
      if (!previous || locTs >= prevTs) {
        latestByUser.set(loc.userId, loc);
      }
    }
    return Array.from(latestByUser.values());
  }, [locations]);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  console.log('🗺️ [LIVE-MAP] Initializing Google Maps with API key:', !!apiKey ? `Available (${apiKey.length} chars)` : 'MISSING');

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: apiKey,
  });

  // Pan/zoom to explicit focus when provided
  useEffect(() => {
    if (!isLoaded || !focus || !mapRef) return;
    try {
      const target = new google.maps.LatLng(focus.lat, focus.lng);
      mapRef.panTo(target);
      mapRef.setZoom(Math.max(mapRef.getZoom() || 6, 14));
      setHighlight((curr) => {
        if (!curr || curr.lat !== focus.lat || curr.lng !== focus.lng) {
          return focus;
        }
        return curr;
      });
    } catch (e) {
      Sentry.captureException(e);
    }
  }, [isLoaded, focus, mapRef]);

  // Follow the selected user's latest trail point if requested
  useEffect(() => {
    if (!isLoaded || !follow || !selectedUserId || !trails || !mapRef) return;
    try {
      const t = trails.find((x) => x.userId === selectedUserId);
      const last = t?.trail?.[t.trail.length - 1];
      if (last) {
        const target = new google.maps.LatLng(last.lat, last.lng);
        mapRef.panTo(target);
        if ((mapRef.getZoom() || 6) < 13) mapRef.setZoom(13);
        setHighlight((curr) => {
          if (!curr || curr.lat !== last.lat || curr.lng !== last.lng) {
            return { lat: last.lat, lng: last.lng };
          }
          return curr;
        });
      }
    } catch (e) {
      Sentry.captureException(e);
    }
  }, [isLoaded, follow, selectedUserId, trails, mapRef]);

  if (!isLoaded) {
    return <div className="w-full h-96 rounded-md overflow-hidden border" />;
  }

  return (
    <div className="w-full h-72 md:h-96 rounded-md overflow-hidden border">
      <GoogleMap
        center={center}
        zoom={6}
        mapContainerStyle={{ width: "100%", height: "100%" }}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        }}
        onLoad={(map) => setMapRef(map)}
      >
        {trails?.map((t, idx) => (
          <GPolyline
            key={`trail-${t.userId}-${idx}`}
            path={t.trail.map((p) => ({ lat: p.lat, lng: p.lng }))}
            options={{
              strokeColor: (() => {
                if (!selectedUserId) {
                  return "#3b82f6"; // Default blue when no selection
                }
                if (t.userId === selectedUserId) {
                  return "#10b981"; // Bright green for selected session
                }
                return "#cbd5e1"; // Light gray for all unselected sessions
              })(),
              strokeOpacity: (() => {
                if (!selectedUserId) {
                  return 0.8; // Default opacity when no selection
                }
                if (t.userId === selectedUserId) {
                  return 0.9; // High opacity for selected session
                }
                return 0.3; // Low opacity for unselected sessions
              })(),
              strokeWeight: (() => {
                if (!selectedUserId) {
                  return 3; // Default weight when no selection
                }
                if (t.userId === selectedUserId) {
                  return 5; // Thick line for selected session
                }
                return 2; // Thin line for unselected sessions
              })(),
              zIndex: t.userId === selectedUserId ? 1000 : 1,
            }}
          />
        ))}

        {highlight && (
          <Marker
            position={highlight}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#ef4444",
              fillOpacity: 0.9,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            }}
          />
        )}

        <MarkerClustererF>
          {(clusterer) => (
            <>
              {uniqueLocations.map((loc) => (
                <Marker
                  key={loc.userId}
                  position={{ lat: loc.latitude, lng: loc.longitude }}
                  clusterer={clusterer}
                  onClick={() => setOpenInfoUserId(loc.userId)}
                >
                  {openInfoUserId === loc.userId && (
                    <InfoWindow onCloseClick={() => setOpenInfoUserId(null)}>
                      <div className="text-sm">
                        <div className="font-medium">{loc.userName}</div>
                        <div className="text-xs text-gray-600">
                          {new Date(loc.timestamp).toLocaleString()}
                        </div>
                        <div className="text-xs">
                          {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                        </div>
                      </div>
                    </InfoWindow>
                  )}
                </Marker>
              ))}
            </>
          )}
        </MarkerClustererF>
      </GoogleMap>
    </div>
  );
}
