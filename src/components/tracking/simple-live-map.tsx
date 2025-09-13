"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GoogleMap,
  Marker,
  InfoWindow,
  useJsApiLoader,
} from "@react-google-maps/api";

type TeamLocation = {
  userId: string;
  userName: string;
  latitude: number;
  longitude: number;
  timestamp: string | Date;
  status?: 'active' | 'idle' | 'offline';
};

// Predefined colors for different MRs
const MARKER_COLORS = [
  "#ef4444", // red
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f97316", // orange
  "#6366f1", // indigo
];

export default function SimpleLiveMap({
  locations,
  followedUserId,
  onMarkerClick,
  className = "",
}: {
  locations: TeamLocation[];
  followedUserId?: string | null;
  onMarkerClick?: (userId: string) => void;
  className?: string;
}) {
  const [mapRef, setMapRef] = useState<google.maps.Map | null>(null);
  const [openInfoUserId, setOpenInfoUserId] = useState<string | null>(null);

  const center = useMemo(() => {
    if (locations.length > 0) {
      return {
        lat: locations[0].latitude,
        lng: locations[0].longitude,
      };
    }
    return { lat: 20.5937, lng: 78.9629 }; // India centroid fallback
  }, [locations]);

  // Create unique color mapping for users
  const userColorMap = useMemo(() => {
    const map = new Map<string, string>();
    const uniqueUserIds = [...new Set(locations.map(loc => loc.userId))];
    uniqueUserIds.forEach((userId, index) => {
      map.set(userId, MARKER_COLORS[index % MARKER_COLORS.length]);
    });
    return map;
  }, [locations]);

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });

  // Auto-focus on followed user
  useEffect(() => {
    if (!isLoaded || !mapRef || !followedUserId) return;
    
    const followedLocation = locations.find(loc => loc.userId === followedUserId);
    if (followedLocation) {
      const target = new google.maps.LatLng(followedLocation.latitude, followedLocation.longitude);
      mapRef.panTo(target);
      mapRef.setZoom(15);
    }
  }, [isLoaded, mapRef, followedUserId, locations]);

  // Auto-fit bounds when no user is followed
  useEffect(() => {
    if (!isLoaded || !mapRef || followedUserId || locations.length === 0) return;
    
    if (locations.length === 1) {
      const loc = locations[0];
      mapRef.panTo({ lat: loc.latitude, lng: loc.longitude });
      mapRef.setZoom(12);
    } else {
      const bounds = new google.maps.LatLngBounds();
      locations.forEach(loc => {
        bounds.extend({ lat: loc.latitude, lng: loc.longitude });
      });
      mapRef.fitBounds(bounds, 50);
    }
  }, [isLoaded, mapRef, followedUserId, locations]);

  if (!isLoaded) {
    return (
      <div className={`w-full h-full rounded-xl bg-muted animate-pulse flex items-center justify-center ${className}`}>
        <div className="text-muted-foreground text-sm">Loading map...</div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full rounded-xl overflow-hidden border shadow-sm ${className}`}>
      <GoogleMap
        center={center}
        zoom={6}
        mapContainerStyle={{ width: "100%", height: "100%" }}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
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
        {locations.map((loc) => {
          const color = userColorMap.get(loc.userId) || MARKER_COLORS[0];
          const isFollowed = followedUserId === loc.userId;
          
          return (
            <Marker
              key={`${loc.userId}-${loc.timestamp}`}
              position={{ lat: loc.latitude, lng: loc.longitude }}
              onClick={() => {
                setOpenInfoUserId(loc.userId);
                onMarkerClick?.(loc.userId);
              }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: isFollowed ? 12 : 8,
                fillColor: color,
                fillOpacity: 0.9,
                strokeColor: isFollowed ? "#ffffff" : color,
                strokeWeight: isFollowed ? 3 : 1,
                strokeOpacity: 1,
              }}
              zIndex={isFollowed ? 1000 : 1}
            >
              {openInfoUserId === loc.userId && (
                <InfoWindow onCloseClick={() => setOpenInfoUserId(null)}>
                  <div className="text-sm space-y-1">
                    <div className="font-semibold text-foreground">{loc.userName}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(loc.timestamp).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                    </div>
                    {loc.status && (
                      <div className={`text-xs px-2 py-1 rounded-full text-center ${
                        loc.status === 'active' ? 'bg-green-100 text-green-700' :
                        loc.status === 'idle' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {loc.status.toUpperCase()}
                      </div>
                    )}
                  </div>
                </InfoWindow>
              )}
            </Marker>
          );
        })}
      </GoogleMap>
    </div>
  );
}