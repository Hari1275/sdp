"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  GoogleMap,
  Marker,
  InfoWindow,
  Polyline as GPolyline,
  useJsApiLoader,
  DirectionsRenderer,
} from "@react-google-maps/api";

type SessionRoute = {
  sessionId: string;
  userId: string;
  userName: string;
  coordinates: { lat: number; lng: number; timestamp: string | Date }[];
  routePolyline?: string;
  distance?: number;
  duration?: number;
  method?: string;
};

type MapProps = {
  routes: SessionRoute[];
  selectedSessionId?: string;
  focus?: { lat: number; lng: number };
  onRouteSelect?: (sessionId: string) => void;
  showRoadRoutes?: boolean;
};

export default function AdvancedRouteMap({
  routes,
  selectedSessionId,
  focus,
  onRouteSelect,
  showRoadRoutes = true
}: MapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directionsServices, setDirectionsServices] = useState<Map<string, google.maps.DirectionsResult>>(new Map());
  const [openInfoSessionId, setOpenInfoSessionId] = useState<string | null>(null);
  const [loadingRoutes, setLoadingRoutes] = useState<Set<string>>(new Set());
  
  const center = useMemo(() => {
    if (routes.length > 0 && routes[0].coordinates.length > 0) {
      return {
        lat: routes[0].coordinates[0].lat,
        lng: routes[0].coordinates[0].lng,
      };
    }
    return { lat: 20.5937, lng: 78.9629 }; // India centroid
  }, [routes]);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  const { isLoaded } = useJsApiLoader({
    id: "google-map-advanced-routing",
    googleMapsApiKey: apiKey,
  });

  // Calculate road routes using Google Directions API
  const calculateRoadRoute = useCallback(async (route: SessionRoute) => {
    if (!isLoaded || !map || route.coordinates.length < 2) return;
    
    if (directionsServices.has(route.sessionId) || loadingRoutes.has(route.sessionId)) {
      return; // Already calculated or in progress
    }

    try {
      setLoadingRoutes(prev => new Set([...prev, route.sessionId]));
      
      const directionsService = new google.maps.DirectionsService();
      
      // Optimize waypoints - take start, end, and key intermediate points
      const coords = route.coordinates;
      const origin = coords[0];
      const destination = coords[coords.length - 1];
      
      // Select intermediate waypoints (max 23 for Google API)
      const waypoints: google.maps.DirectionsWaypoint[] = [];
      if (coords.length > 2) {
        const maxWaypoints = Math.min(20, coords.length - 2);
        const step = Math.floor((coords.length - 2) / maxWaypoints);
        
        for (let i = step; i < coords.length - 1; i += step) {
          if (waypoints.length < maxWaypoints) {
            waypoints.push({
              location: new google.maps.LatLng(coords[i].lat, coords[i].lng),
              stopover: false
            });
          }
        }
      }

      const request: google.maps.DirectionsRequest = {
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(destination.lat, destination.lng),
        waypoints,
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.METRIC,
        region: 'IN' // Optimize for India
      };

      const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
        directionsService.route(request, (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            resolve(result);
          } else {
            reject(new Error(`Directions request failed: ${status}`));
          }
        });
      });

      setDirectionsServices(prev => new Map([...prev, [route.sessionId, result]]));
      console.log(`✅ Road route calculated for session ${route.sessionId}`);
      
    } catch (error) {
      console.warn(`❌ Failed to calculate road route for session ${route.sessionId}:`, error);
    } finally {
      setLoadingRoutes(prev => {
        const newSet = new Set(prev);
        newSet.delete(route.sessionId);
        return newSet;
      });
    }
  }, [isLoaded, map, directionsServices, loadingRoutes]);

  // Calculate routes when showRoadRoutes is enabled
  useEffect(() => {
    if (showRoadRoutes && isLoaded && map) {
      routes.forEach(route => {
        calculateRoadRoute(route);
      });
    }
  }, [routes, showRoadRoutes, isLoaded, map, calculateRoadRoute]);

  // Pan to focus point
  useEffect(() => {
    if (focus && map) {
      map.panTo(focus);
      map.setZoom(Math.max(map.getZoom() || 10, 14));
    }
  }, [focus, map]);

  // Route color generator
  const getRouteColor = (sessionId: string, isSelected: boolean): string => {
    if (isSelected) return '#10b981'; // Emerald green for selected
    
    // Generate consistent color based on sessionId
    const hash = sessionId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'];
    return colors[Math.abs(hash) % colors.length];
  };

  if (!isLoaded) {
    return (
      <div className="w-full h-96 rounded-md overflow-hidden border bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Loading advanced route map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-72 md:h-96 rounded-md overflow-hidden border relative">
      <GoogleMap
        center={center}
        zoom={6}
        mapContainerStyle={{ width: "100%", height: "100%" }}
        options={{
          streetViewControl: false,
          mapTypeControl: true,
          fullscreenControl: true,
          mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
            position: google.maps.ControlPosition.TOP_RIGHT,
          },
          zoomControl: true,
          gestureHandling: 'cooperative'
        }}
        onLoad={setMap}
      >
        {/* Render road-based routes using DirectionsRenderer */}
        {showRoadRoutes && directionsServices.size > 0 && 
          Array.from(directionsServices.entries()).map(([sessionId, directions]) => {
            const isSelected = sessionId === selectedSessionId;
            return (
              <DirectionsRenderer
                key={`directions-${sessionId}`}
                directions={directions}
                options={{
                  suppressMarkers: true, // We'll add custom markers
                  polylineOptions: {
                    strokeColor: getRouteColor(sessionId, isSelected),
                    strokeOpacity: isSelected ? 0.9 : 0.6,
                    strokeWeight: isSelected ? 6 : 4,
                    zIndex: isSelected ? 1000 : 100
                  }
                }}
              />
            );
          })
        }

        {/* Fallback to GPS coordinate polylines for routes without road data */}
        {routes
          .filter(route => !showRoadRoutes || !directionsServices.has(route.sessionId))
          .map((route) => {
            const isSelected = route.sessionId === selectedSessionId;
            const isLoading = loadingRoutes.has(route.sessionId);
            
            return (
              <GPolyline
                key={`gps-${route.sessionId}`}
                path={route.coordinates}
                options={{
                  strokeColor: isLoading ? '#fbbf24' : getRouteColor(route.sessionId, isSelected),
                  strokeOpacity: isSelected ? 0.8 : 0.5,
                  strokeWeight: isSelected ? 5 : 3,
                  zIndex: isSelected ? 900 : 50,
                  ...(isLoading && {
                    strokePattern: [{
                      icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        fillOpacity: 1,
                        scale: 3
                      },
                      offset: '0',
                      repeat: '10px'
                    }]
                  })
                }}
                onClick={() => onRouteSelect?.(route.sessionId)}
              />
            );
          })
        }

        {/* Start and end markers for each route */}
        {routes.map((route) => {
          if (route.coordinates.length === 0) return null;
          
          const start = route.coordinates[0];
          const end = route.coordinates[route.coordinates.length - 1];
          const isSelected = route.sessionId === selectedSessionId;
          
          return (
            <div key={`markers-${route.sessionId}`}>
              {/* Start marker */}
              <Marker
                position={start}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: isSelected ? 8 : 6,
                  fillColor: '#10b981',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2
                }}
                zIndex={isSelected ? 2000 : 1000}
                title={`Start: ${route.userName}`}
                onClick={() => {
                  setOpenInfoSessionId(route.sessionId);
                  onRouteSelect?.(route.sessionId);
                }}
              />
              
              {/* End marker */}
              <Marker
                position={end}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: isSelected ? 8 : 6,
                  fillColor: '#ef4444',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2
                }}
                zIndex={isSelected ? 2000 : 1000}
                title={`End: ${route.userName}`}
                onClick={() => {
                  setOpenInfoSessionId(route.sessionId);
                  onRouteSelect?.(route.sessionId);
                }}
              />
              
              {/* Info window */}
              {openInfoSessionId === route.sessionId && (
                <InfoWindow
                  position={start}
                  onCloseClick={() => setOpenInfoSessionId(null)}
                >
                  <div className="text-sm p-2">
                    <div className="font-semibold text-gray-800">{route.userName}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Session: {route.sessionId.slice(-8)}
                    </div>
                    {route.distance && (
                      <div className="text-xs mt-1">
                        <span className="font-medium">Distance:</span> {route.distance.toFixed(2)} km
                      </div>
                    )}
                    {route.duration && (
                      <div className="text-xs">
                        <span className="font-medium">Duration:</span> {route.duration.toFixed(1)} min
                      </div>
                    )}
                    {route.method && (
                      <div className="text-xs">
                        <span className="font-medium">Method:</span> {route.method}
                      </div>
                    )}
                    <div className="text-xs mt-1 text-blue-600">
                      {route.coordinates.length} GPS points
                    </div>
                    {loadingRoutes.has(route.sessionId) && (
                      <div className="text-xs mt-1 text-orange-600">
                        🔄 Calculating road route...
                      </div>
                    )}
                    {directionsServices.has(route.sessionId) && (
                      <div className="text-xs mt-1 text-green-600">
                        ✅ Road-based route
                      </div>
                    )}
                  </div>
                </InfoWindow>
              )}
            </div>
          );
        })}
      </GoogleMap>
      
      {/* Route statistics overlay */}
      {selectedSessionId && routes.length > 0 && (
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg max-w-xs">
          <div className="text-sm">
            <div className="font-semibold text-gray-800 mb-2">Route Statistics</div>
            {routes.find(r => r.sessionId === selectedSessionId) && (() => {
              const route = routes.find(r => r.sessionId === selectedSessionId)!;
              const hasRoadRoute = directionsServices.has(route.sessionId);
              const isLoading = loadingRoutes.has(route.sessionId);
              
              return (
                <div className="space-y-1 text-xs">
                  <div>📍 GPS Points: {route.coordinates.length}</div>
                  {route.distance && <div>📏 Distance: {route.distance.toFixed(2)} km</div>}
                  {route.duration && <div>⏱️ Duration: {route.duration.toFixed(1)} min</div>}
                  <div>🛣️ Route Type: {isLoading ? 'Calculating...' : hasRoadRoute ? 'Road-based' : 'GPS-based'}</div>
                  {route.method && <div>🔧 Method: {route.method}</div>}
                </div>
              );
            })()}
          </div>
        </div>
      )}
      
      {/* Loading indicator */}
      {loadingRoutes.size > 0 && (
        <div className="absolute bottom-4 right-4 bg-orange-100/90 backdrop-blur-sm rounded-lg p-2 shadow-lg">
          <div className="flex items-center space-x-2 text-orange-700 text-xs">
            <div className="animate-spin rounded-full h-3 w-3 border-b border-orange-600"></div>
            <span>Calculating {loadingRoutes.size} road route{loadingRoutes.size > 1 ? 's' : ''}...</span>
          </div>
        </div>
      )}
    </div>
  );
}
