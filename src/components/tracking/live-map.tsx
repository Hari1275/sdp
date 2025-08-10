"use client";

import { useMemo, useState } from "react";
import {
  GoogleMap,
  Marker,
  InfoWindow,
  Polyline as GPolyline,
  useJsApiLoader,
  MarkerClustererF,
} from "@react-google-maps/api";

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

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });

  if (!isLoaded) {
    return <div className="w-full h-96 rounded-md overflow-hidden border" />;
  }

  return (
    <div className="w-full h-96 rounded-md overflow-hidden border">
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
        {focus &&
          mapRef &&
          (() => {
            const target = new google.maps.LatLng(focus.lat, focus.lng);
            mapRef.panTo(target);
            mapRef.setZoom(Math.max(mapRef.getZoom() || 6, 14));
            if (
              !highlight ||
              highlight.lat !== focus.lat ||
              highlight.lng !== focus.lng
            ) {
              setHighlight(focus);
            }
            return null;
          })()}
        {trails?.map((t) => (
          <GPolyline
            key={`trail-${t.userId}`}
            path={t.trail.map((p) => ({ lat: p.lat, lng: p.lng }))}
            options={{
              strokeColor:
                selectedUserId && t.userId !== selectedUserId
                  ? "#94a3b8"
                  : "#2563eb",
              strokeOpacity:
                selectedUserId && t.userId !== selectedUserId ? 0.4 : 0.8,
              strokeWeight:
                selectedUserId && t.userId !== selectedUserId ? 2 : 4,
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
              {locations.map((loc) => (
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

        {follow &&
          selectedUserId &&
          trails &&
          mapRef &&
          (() => {
            const t = trails.find((x) => x.userId === selectedUserId);
            const last = t?.trail?.[t.trail.length - 1];
            if (last) {
              const target = new google.maps.LatLng(last.lat, last.lng);
              mapRef.panTo(target);
              if ((mapRef.getZoom() || 6) < 13) mapRef.setZoom(13);
              if (
                !highlight ||
                highlight.lat !== last.lat ||
                highlight.lng !== last.lng
              ) {
                setHighlight({ lat: last.lat, lng: last.lng });
              }
            }
            return null;
          })()}
      </GoogleMap>
    </div>
  );
}
