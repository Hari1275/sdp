"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  GoogleMap,
  Marker,
  InfoWindow,
  Polyline as GPolyline,
  useJsApiLoader,
  MarkerClustererF,
} from "@react-google-maps/api";
import * as Sentry from "@sentry/nextjs";
import { formatSessionDateTime } from "@/lib/session-date-utils";

type TeamLocation = {
  userId: string;
  userName: string;
  latitude: number;
  longitude: number;
  timestamp: string | Date;
};
type TrailPoint = { lat: number; lng: number; timestamp: string | Date };
type SessionTrail = { userId: string; userName: string; trail: TrailPoint[] };

// Google Roads API integration for efficient coordinate batching
const processTrailWithGoogleRoads = async (trail: TrailPoint[]): Promise<TrailPoint[]> => {
  if (trail.length < 2) return trail;
  
  // Google Roads API has a 100-point limit per request, but we'll use 25 for safety
  const batchSize = 25;
  const processedTrail: TrailPoint[] = [];
  
  for (let i = 0; i < trail.length; i += batchSize - 1) {
    // Overlap by 1 point to ensure continuity
    const batch = trail.slice(i, Math.min(i + batchSize, trail.length));
    
    try {
      // Use our backend API to call Google Roads API
      const response = await fetch('/api/google-maps/snap-to-roads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: batch.map(point => ({ lat: point.lat, lng: point.lng }))
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.snappedPoints) {
          const snappedPoints = data.snappedPoints.map((point: { location: { latitude: number; longitude: number } }, index: number) => ({
            lat: point.location.latitude,
            lng: point.location.longitude,
            timestamp: batch[Math.min(index, batch.length - 1)]?.timestamp || new Date()
          }));
          
          // Avoid duplicates when merging batches
          if (i > 0) {
            snappedPoints.shift(); // Remove first point to avoid overlap
          }
          
          processedTrail.push(...snappedPoints);
        } else {
          // Fallback to original batch if Roads API fails
          if (i > 0) {
            batch.shift(); // Remove first point to avoid overlap
          }
          processedTrail.push(...batch);
        }
      } else {
        // Fallback to original batch if API request fails
        if (i > 0) {
          batch.shift(); // Remove first point to avoid overlap
        }
        processedTrail.push(...batch);
      }
    } catch (error) {
      console.warn('Google Roads API error for batch:', error);
      // Fallback to original batch
      if (i > 0) {
        batch.shift(); // Remove first point to avoid overlap
      }
      processedTrail.push(...batch);
    }
  }
  
  return processedTrail;
};

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
  const [processedTrails, setProcessedTrails] = useState<Map<string, TrailPoint[]>>(new Map());
  const [processingTrails, setProcessingTrails] = useState<Set<string>>(new Set());

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

  // Process trails with Google Roads API for better route accuracy
  const processTrailsWithGoogleRoads = useCallback(async () => {
    if (!trails || trails.length === 0) return;
    
    for (const trail of trails) {
      const trailKey = `${trail.userId}_${trail.trail.length}`;
      
      // Skip if already processed or currently processing
      if (processedTrails.has(trailKey) || processingTrails.has(trailKey)) {
        continue;
      }
      
      // Skip trails with too few points
      if (trail.trail.length < 3) {
        continue;
      }
      
      // Mark as processing
      setProcessingTrails(prev => new Set([...prev, trailKey]));
      
      try {
        const roadSnappedTrail = await processTrailWithGoogleRoads(trail.trail);
        setProcessedTrails(prev => new Map([...prev, [trailKey, roadSnappedTrail]]));
        console.log(`✅ Processed trail for user ${trail.userId} with Google Roads API`);
      } catch (error) {
        console.warn(`❌ Failed to process trail for user ${trail.userId}:`, error);
      } finally {
        // Remove from processing set
        setProcessingTrails(prev => {
          const newSet = new Set(prev);
          newSet.delete(trailKey);
          return newSet;
        });
      }
    }
  }, [trails, processedTrails, processingTrails]);
  
  // Process trails when they change
  useEffect(() => {
    processTrailsWithGoogleRoads();
  }, [processTrailsWithGoogleRoads]);

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
        {trails?.map((t, idx) => {
          const trailKey = `${t.userId}_${t.trail.length}`;
          const isProcessing = processingTrails.has(trailKey);
          const processedTrail = processedTrails.get(trailKey);
          
          // Use processed trail if available, otherwise use original
          const trailPath = processedTrail || t.trail;
          
          return (
            <GPolyline
              key={`trail-${t.userId}-${idx}`}
              path={trailPath.map((p) => ({ lat: p.lat, lng: p.lng }))}
              options={{
                strokeColor: (() => {
                  if (isProcessing) {
                    return "#fbbf24"; // Orange while processing
                  }
                  if (!selectedUserId) {
                    return processedTrail ? "#059669" : "#3b82f6"; // Green for road-snapped, blue for original
                  }
                  if (t.userId === selectedUserId) {
                    return "#10b981"; // Bright green for selected session
                  }
                  return "#cbd5e1"; // Light gray for all unselected sessions
                })(),
                strokeOpacity: (() => {
                  if (isProcessing) {
                    return 0.6; // Lower opacity while processing
                  }
                  if (!selectedUserId) {
                    return 0.8; // Default opacity when no selection
                  }
                  if (t.userId === selectedUserId) {
                    return 0.9; // High opacity for selected session
                  }
                  return 0.3; // Low opacity for unselected sessions
                })(),
                strokeWeight: (() => {
                  if (isProcessing) {
                    return 2; // Thinner while processing
                  }
                  if (!selectedUserId) {
                    return processedTrail ? 4 : 3; // Slightly thicker for road-snapped
                  }
                  if (t.userId === selectedUserId) {
                    return 5; // Thick line for selected session
                  }
                  return 2; // Thin line for unselected sessions
                })(),
                zIndex: t.userId === selectedUserId ? 1000 : (processedTrail ? 500 : 1),
              }}
            />
          );
        })}

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
                          {formatSessionDateTime(loc.timestamp, { dateFormat: 'medium' })}
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
