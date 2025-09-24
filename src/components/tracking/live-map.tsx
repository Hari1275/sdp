"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
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
type TrailPoint = { lat: number; lng: number; timestamp: string | Date; isRoadBased?: boolean };
type SessionTrail = { userId: string; userName: string; trail: TrailPoint[]; isRoadBased?: boolean };

// Enhanced Google Directions API integration for road-following routes
const processTrailWithEnhancedDirections = async (trail: TrailPoint[]): Promise<{
  processedTrail: TrailPoint[];
  routingMethod: string;
  wasSkipped: boolean;
  reasoning?: string[];
  totalDistance?: number;
  totalDuration?: number;
}> => {
  if (trail.length < 2) {
    return {
      processedTrail: trail,
      routingMethod: 'insufficient_points',
      wasSkipped: true
    };
  }
  
  try {
    // Convert trail points to coordinate format for intelligent analysis
    const coordinates = trail.map(point => ({
      latitude: point.lat,
      longitude: point.lng,
      timestamp: point.timestamp
    }));
    
    console.log(`🗺️ [LIVE-MAP] Processing trail with ${coordinates.length} points using enhanced Directions API...`);
    
    // Use the enhanced Directions API for proper road-following routes
    const response = await fetch('/api/google-maps/enhanced-directions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates })
    });
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.success) {
        // Convert decoded path to TrailPoint format
        const processedTrail = data.decodedPath?.map((point: { lat: number; lng: number }, index: number) => ({
          lat: point.lat,
          lng: point.lng,
          timestamp: trail[Math.min(index, trail.length - 1)]?.timestamp || new Date()
        })) || trail;
        
        const wasSkipped = data.debugInfo?.skippedDueToIntelligence || false;
        
        if (wasSkipped) {
          console.log(`⏭️ [LIVE-MAP] Route skipped: ${data.debugInfo?.reasonsSkipped?.join(', ')}`);
        } else {
          console.log(`✅ [LIVE-MAP] Road route generated: ${data.method}, ${processedTrail.length} points, ${data.totalDistance?.toFixed(2)}km`);
        }
        
        return {
          processedTrail,
          routingMethod: data.method,
          wasSkipped,
          reasoning: data.debugInfo?.reasonsSkipped,
          totalDistance: data.totalDistance,
          totalDuration: data.totalDuration
        };
      }
    }
    
    // Fallback to original trail
    console.warn(`⚠️ [LIVE-MAP] Directions API failed, using original trail`);
    return {
      processedTrail: trail,
      routingMethod: 'api_fallback',
      wasSkipped: false
    };
    
  } catch (error) {
    console.warn('❌ [LIVE-MAP] Enhanced Directions API error:', error);
    return {
      processedTrail: trail,
      routingMethod: 'error_fallback',
      wasSkipped: false
    };
  }
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
  // Compute bounds from trails to get proper center point
  const center = useMemo(() => {
    // Default center point for initial load only
    const defaultCenter = { lat: 20.5937, lng: 78.9629 } as google.maps.LatLngLiteral;
    
    if (trails?.length) {
      const allPoints = trails.flatMap(t => t.trail);
      if (allPoints.length) {
        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
        for (const p of allPoints) {
          if (p.lat < minLat) minLat = p.lat;
          if (p.lat > maxLat) maxLat = p.lat;
          if (p.lng < minLng) minLng = p.lng;
          if (p.lng > maxLng) maxLng = p.lng;
        }
        return {
          lat: (minLat + maxLat) / 2,
          lng: (minLng + maxLng) / 2,
        } as google.maps.LatLngLiteral;
      }
    }
    if (locations.length > 0) {
      return {
        lat: locations[0].latitude,
        lng: locations[0].longitude,
      } as google.maps.LatLngLiteral;
    }
    return defaultCenter;
  }, [locations, trails]);

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

// Process trails with enhanced Directions API for road-following routes
  const processTrailsWithEnhancedDirections = useCallback(async () => {
    if (!trails || trails.length === 0) return;
    
    for (const trail of trails) {
      const trailKey = `${trail.userId}_${trail.trail.length}`;
      
      // Skip if already processed or currently processing
      if (processedTrails.has(trailKey) || processingTrails.has(trailKey)) {
        continue;
      }
      
      // Skip if this is already a road-based route from user-details modal
      if (trail.trail.some(point => point.isRoadBased)) {
        console.log(`⏭️ [LIVE-MAP] Skipping trail for user ${trail.userId} - already road-based`);
        // Set it as processed with original trail to avoid further processing
        setProcessedTrails(prev => new Map([...prev, [trailKey, trail.trail]]));
        continue;
      }
      
      // Skip trails with too few points
      if (trail.trail.length < 3) {
        continue;
      }
      
      // Mark as processing
      setProcessingTrails(prev => new Set([...prev, trailKey]));
      
      try {
        const result = await processTrailWithEnhancedDirections(trail.trail);
        setProcessedTrails(prev => new Map([...prev, [trailKey, result.processedTrail]]));
        
        if (result.wasSkipped) {
          console.log(`⏭️ Skipped routing for user ${trail.userId}: ${result.reasoning?.join(', ') || 'Static location detected'}`);
        } else {
          console.log(`✅ Generated road route for user ${trail.userId}: ${result.routingMethod}, ${result.totalDistance?.toFixed(2)}km`);
        }
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
    processTrailsWithEnhancedDirections();
  }, [processTrailsWithEnhancedDirections]);

  // Fit bounds to trails when trails or processed trails change
  useEffect(() => {
    if (!mapRef || !trails?.length) return;
    try {
      // Calculate bounds from all trails
      const bounds = new google.maps.LatLngBounds();
      
      trails.forEach(trail => {
        if (trail.trail.length > 0) {
          // Add route points to bounds
          trail.trail.forEach(point => {
            bounds.extend({ lat: point.lat, lng: point.lng });
          });
        }
      });
      
      // Add padding around the bounds (20%)
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const latPadding = (ne.lat() - sw.lat()) * 0.1;
      const lngPadding = (ne.lng() - sw.lng()) * 0.1;
      
      // Extend bounds with padding
      bounds.extend({
        lat: ne.lat() + latPadding,
        lng: ne.lng() + lngPadding
      });
      bounds.extend({
        lat: sw.lat() - latPadding,
        lng: sw.lng() - lngPadding
      });
      
      // Only fit bounds if we have a valid area
      if (!bounds.isEmpty() && 
          bounds.getNorthEast().lat() !== bounds.getSouthWest().lat() &&
          bounds.getNorthEast().lng() !== bounds.getSouthWest().lng()) {
        mapRef.fitBounds(bounds);
        
        // Set minimum zoom level to ensure route is visible but not too zoomed out
        const listener = mapRef.addListener('idle', () => {
          const zoom = mapRef.getZoom();
          if (zoom && zoom < 10) {
            mapRef.setZoom(10);
          }
          google.maps.event.removeListener(listener);
        });
      }
    } catch (e) {
      Sentry.captureException(e);
    }
  }, [mapRef, trails, processedTrails]);

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
        zoom={12}
        mapContainerStyle={{ width: "100%", height: "100%" }}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          minZoom: 5,
          maxZoom: 18,
          zoomControl: true,
          styles: [
            {
              featureType: "poi",
              elementType: "labels",
              stylers: [{ visibility: "off" }]
            }
          ],
        }}
        onLoad={(map) => setMapRef(map)}
      >
        {trails?.map((t, idx) => {
          const trailKey = `${t.userId}_${t.trail.length}`;
          const isProcessing = processingTrails.has(trailKey);
          const processedTrail = processedTrails.get(trailKey);
          
          // Only show selected trail if one is selected, or show the best trail if none selected
          const shouldShowTrail = !selectedUserId || t.userId === selectedUserId;
          if (!shouldShowTrail) return null;
          
          const isSelected = t.userId === selectedUserId;
          const hasRoadRoute = processedTrail && processedTrail.length > 0;
          
          // Skip rendering if we're still processing and don't have a route yet
          if (isProcessing && !hasRoadRoute) {
            return null;
          }
          
          // Use processed (road-based) trail if available, otherwise use original GPS trail
          const trailPath = hasRoadRoute ? processedTrail : t.trail;
          
          // Skip if we don't have enough points
          if (!trailPath || trailPath.length < 2) return null;

          // Add start and end markers if this is a selected trail
          const startPoint = trailPath[0];
          const endPoint = trailPath[trailPath.length - 1];
          
          return (
            <React.Fragment key={`trail-${t.userId}-${idx}`}>
              {/* Start Marker */}
              <Marker
                key={`start-${t.userId}-${idx}`}
                position={{ lat: startPoint.lat, lng: startPoint.lng }}
                icon={{
                  // Use a more distinct START marker
                  path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                  scale: 8,
                  fillColor: isSelected ? "#059669" : "#10b981", // Green
                  fillOpacity: 1,
                  strokeColor: "#ffffff",
                  strokeWeight: 2,
                  rotation: 0 // Point up
                }}
                zIndex={2000} // Ensure markers are above the path
                title="Start Point"
              />
              
              {/* End Marker */}
              <Marker
                key={`end-${t.userId}-${idx}`}
                position={{ lat: endPoint.lat, lng: endPoint.lng }}
                icon={{
                  // Use a distinct END marker
                  path: 'M -10,0 0,10 10,0 0,-10 z', // Diamond shape
                  scale: 1.2,
                  fillColor: isSelected ? "#dc2626" : "#ef4444", // Red
                  fillOpacity: 1,
                  strokeColor: "#ffffff",
                  strokeWeight: 2,
                }}
                zIndex={2000} // Ensure markers are above the path
                title="End Point"
              />
              
              {/* Route Line */}
              <GPolyline
                key={`trail-${t.userId}-${idx}`}
                path={trailPath.map((p) => ({ lat: p.lat, lng: p.lng }))}
                options={{
                  strokeColor: hasRoadRoute 
                    ? (isSelected ? "#2563eb" : "#3b82f6") // Blue for road-following routes
                    : (isSelected ? "#6b7280" : "#9ca3af"), // Gray for GPS fallback routes
                  strokeOpacity: isSelected ? 0.9 : 0.7,
                  strokeWeight: isSelected ? 5 : 3,
                  zIndex: isSelected ? 1000 : (hasRoadRoute ? 800 : 600),
                }}
              />
            </React.Fragment>
          );
        }).filter(Boolean)}


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

        {/* Show default markers only when no trails are being displayed */}
        {(!trails || trails.length === 0) && (
          <MarkerClustererF>
            {(clusterer) => (
              <React.Fragment>
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
            </React.Fragment>
          )}
        </MarkerClustererF>
        )}
      </GoogleMap>
    </div>
  );
}
