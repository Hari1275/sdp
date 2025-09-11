/**
 * Polyline Utilities
 * 
 * Handles conversion between GPS coordinates and polyline data
 * for optimized storage and display
 */

export interface Coordinate {
  latitude: number;
  longitude: number;
  timestamp?: Date | string;
  accuracy?: number | null;
  speed?: number | null;
  altitude?: number | null;
}

export interface PolylineData {
  // Encoded polyline for efficient storage/transmission
  polyline: string;
  // Route geometry coordinates for mapping
  geometry: Array<{ latitude: number; longitude: number }>;
  // Metadata
  method: string;
  duration?: number;
  optimizations?: {
    originalPoints: number;
    processedPoints: number;
    cacheHit?: boolean;
    calculationTime?: number;
    accuracy: 'sub_meter' | 'high' | 'standard';
  };
  // Processing info
  calculatedAt: string;
  totalOriginalPoints?: number;
  optimizedPoints?: number;
  cacheUtilized?: boolean;
  processingTimeMs?: number;
}

/**
 * Parse stored route data JSON string
 */
export function parseRouteData(routeDataJson: string | null): PolylineData | null {
  if (!routeDataJson) return null;
  
  try {
    return JSON.parse(routeDataJson) as PolylineData;
  } catch (error) {
    console.warn('Failed to parse route data:', error);
    return null;
  }
}

/**
 * Convert polyline geometry to coordinate array format for backward compatibility
 */
export function polylineToCoordinates(polylineData: PolylineData | null): Coordinate[] {
  if (!polylineData?.geometry || !Array.isArray(polylineData.geometry)) {
    return [];
  }
  
  return polylineData.geometry.map((point, index) => ({
    latitude: point.latitude,
    longitude: point.longitude,
    timestamp: new Date(), // Use current time as fallback
    accuracy: null,
    speed: null,
    altitude: null
  }));
}

/**
 * Convert polyline data to trail format for map components
 */
export function polylineToTrail(polylineData: PolylineData | null): Array<{ lat: number; lng: number; timestamp: string | Date }> {
  if (!polylineData?.geometry || !Array.isArray(polylineData.geometry)) {
    return [];
  }
  
  return polylineData.geometry.map(point => ({
    lat: point.latitude,
    lng: point.longitude,
    timestamp: new Date()
  }));
}

/**
 * Extract essential route information from polyline data
 */
export function getRouteInfo(polylineData: PolylineData | null) {
  if (!polylineData) {
    return {
      hasRoute: false,
      pointCount: 0,
      method: 'none',
      accuracy: 'none'
    };
  }
  
  return {
    hasRoute: true,
    pointCount: polylineData.geometry?.length || 0,
    method: polylineData.method || 'unknown',
    accuracy: polylineData.optimizations?.accuracy || 'standard',
    duration: polylineData.duration,
    processingTime: polylineData.processingTimeMs
  };
}

/**
 * Create simplified coordinate array from start/end points and polyline
 * for APIs that need coordinate arrays
 */
export function createCoordinateArrayFromSession(session: {
  startLat?: number | null;
  startLng?: number | null;
  endLat?: number | null;
  endLng?: number | null;
  routeData?: string | null;
  checkIn: Date | string;
  checkOut?: Date | string | null;
}): Coordinate[] {
  const coordinates: Coordinate[] = [];
  const checkInDate = new Date(session.checkIn);
  const checkOutDate = session.checkOut ? new Date(session.checkOut) : new Date();
  
  // Add start point if available
  if (session.startLat && session.startLng) {
    coordinates.push({
      latitude: session.startLat,
      longitude: session.startLng,
      timestamp: checkInDate,
      accuracy: null,
      speed: null,
      altitude: null
    });
  }
  
  // Add polyline points if available
  const polylineData = parseRouteData(session.routeData);
  if (polylineData?.geometry && polylineData.geometry.length > 2) {
    // Add intermediate points (skip first and last to avoid duplicates)
    const intermediatePoints = polylineData.geometry.slice(1, -1);
    const timeDiff = checkOutDate.getTime() - checkInDate.getTime();
    
    intermediatePoints.forEach((point, index) => {
      // Distribute timestamps evenly across the route
      const ratio = (index + 1) / (intermediatePoints.length + 1);
      const timestamp = new Date(checkInDate.getTime() + (timeDiff * ratio));
      
      coordinates.push({
        latitude: point.latitude,
        longitude: point.longitude,
        timestamp,
        accuracy: null,
        speed: null,
        altitude: null
      });
    });
  }
  
  // Add end point if available and different from start
  if (session.endLat && session.endLng && session.checkOut) {
    coordinates.push({
      latitude: session.endLat,
      longitude: session.endLng,
      timestamp: checkOutDate,
      accuracy: null,
      speed: null,
      altitude: null
    });
  }
  
  return coordinates;
}

/**
 * Check if session has sufficient route data
 */
export function hasValidRouteData(session: {
  routeData?: string | null;
  startLat?: number | null;
  startLng?: number | null;
  endLat?: number | null;
  endLng?: number | null;
}): boolean {
  // Has polyline data
  const polylineData = parseRouteData(session.routeData);
  if (polylineData?.geometry && polylineData.geometry.length >= 2) {
    return true;
  }
  
  // Or has start/end coordinates
  return !!(session.startLat && session.startLng && 
           session.endLat && session.endLng);
}

/**
 * Get coordinate count from session (for backward compatibility)
 */
export function getCoordinateCount(session: {
  routeData?: string | null;
  startLat?: number | null;
  startLng?: number | null;
  endLat?: number | null;
  endLng?: number | null;
}): number {
  const polylineData = parseRouteData(session.routeData);
  if (polylineData?.geometry) {
    return polylineData.geometry.length;
  }
  
  // Fallback to start/end point count
  let count = 0;
  if (session.startLat && session.startLng) count++;
  if (session.endLat && session.endLng) count++;
  
  return count;
}
