/**
 * GPS utility functions for distance calculation and validation
 */

export interface Coordinate {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: Date;
  speed?: number;
  altitude?: number;
}

// Google Distance Matrix API interfaces
export interface DistanceMatrixElement {
  distance: {
    text: string;
    value: number; // in meters
  };
  duration: {
    text: string;
    value: number; // in seconds
  };
  status: 'OK' | 'NOT_FOUND' | 'ZERO_RESULTS' | 'MAX_ROUTE_LENGTH_EXCEEDED';
}

export interface DistanceMatrixRow {
  elements: DistanceMatrixElement[];
}

export interface DistanceMatrixResponse {
  destination_addresses: string[];
  origin_addresses: string[];
  rows: DistanceMatrixRow[];
  status: 'OK' | 'INVALID_REQUEST' | 'MAX_ELEMENTS_EXCEEDED' | 'OVER_DAILY_LIMIT' | 'OVER_QUERY_LIMIT' | 'REQUEST_DENIED' | 'UNKNOWN_ERROR';
  error_message?: string;
}

export interface DistanceCalculationResult {
  distance: number; // in kilometers
  duration?: number; // in minutes
  method: 'haversine' | 'google_api' | 'google_routes';
  success: boolean;
  error?: string;
}

// Google Routes API interfaces (following the official documentation)
export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface Location {
  latLng: LatLng;
}

export interface Waypoint {
  location: Location;
  via?: boolean; // If true, the waypoint is for routing purposes only
}

export interface RouteRequest {
  origin: Waypoint;
  destination: Waypoint;
  intermediates?: Waypoint[];
  travelMode: 'DRIVE' | 'WALK' | 'BICYCLE' | 'TRANSIT';
  routingPreference?: 'TRAFFIC_UNAWARE' | 'TRAFFIC_AWARE' | 'TRAFFIC_AWARE_OPTIMAL';
  computeAlternativeRoutes?: boolean;
  routeModifiers?: {
    avoidTolls?: boolean;
    avoidHighways?: boolean;
    avoidFerries?: boolean;
    avoidIndoor?: boolean;
  };
}

export interface RouteLeg {
  distanceMeters: number;
  duration: string; // ISO 8601 duration format
  staticDuration: string;
  polyline: {
    encodedPolyline: string;
  };
  startLocation: Location;
  endLocation: Location;
}

export interface Route {
  legs: RouteLeg[];
  distanceMeters: number;
  duration: string;
  staticDuration: string;
  polyline: {
    encodedPolyline: string;
  };
  description: string;
  warnings: string[];
}

export interface GeocodingResult {
  status: string;
  place_id?: string;
  types?: string[];
  formatted_address?: string;
}

export interface RoutesResponse {
  routes: Route[];
  geocodingResults?: {
    origin: GeocodingResult;
    destination: GeocodingResult;
    intermediates: GeocodingResult[];
  };
}

export interface RouteCalculationResult {
  distance: number; // in kilometers
  duration: number; // in minutes
  staticDuration: number; // in minutes (without traffic)
  polyline: string; // encoded polyline for route visualization
  legs: {
    distance: number;
    duration: number;
    startLocation: LatLng;
    endLocation: LatLng;
  }[];
  method: 'google_routes';
  success: boolean;
  error?: string;
  warnings?: string[];
}

export interface GPSValidationResult {
  isValid: boolean;
  errors: string[];
}

// Earth's radius in kilometers
const EARTH_RADIUS_KM = 6371;

// GPS accuracy threshold (from env or default 50 meters for production use)
const GPS_ACCURACY_THRESHOLD = parseFloat(process.env.GPS_ACCURACY_THRESHOLD || '50');

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param coord1 First coordinate
 * @param coord2 Second coordinate
 * @returns Distance in kilometers
 */
export function calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
  const lat1Rad = degreesToRadians(coord1.latitude);
  const lat2Rad = degreesToRadians(coord2.latitude);
  const deltaLatRad = degreesToRadians(coord2.latitude - coord1.latitude);
  const deltaLngRad = degreesToRadians(coord2.longitude - coord1.longitude);

  const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
           Math.cos(lat1Rad) * Math.cos(lat2Rad) *
           Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Calculate total distance from array of coordinates
 * @param coordinates Array of coordinates
 * @returns Total distance in kilometers
 */
export function calculateTotalDistance(coordinates: Coordinate[]): number {
  if (coordinates.length < 2) return 0;
  
  let totalDistance = 0;
  for (let i = 1; i < coordinates.length; i++) {
    totalDistance += calculateDistance(coordinates[i - 1], coordinates[i]);
  }
  
  return totalDistance;
}

/**
 * Calculate distance using Google Distance Matrix API
 * @param origin Starting coordinate
 * @param destination Ending coordinate
 * @param mode Travel mode (driving, walking, bicycling, transit)
 * @returns Promise with distance calculation result
 */
export async function calculateDistanceWithGoogle(
  origin: Coordinate,
  destination: Coordinate,
  mode: 'driving' | 'walking' | 'bicycling' | 'transit' = 'driving'
): Promise<DistanceCalculationResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    // Fallback to Haversine if no API key
    const distance = calculateDistance(origin, destination);
    return {
      distance,
      method: 'haversine',
      success: true
    };
  }

  try {
    console.log(`🌐 [GPS-UTILS] Calling server-side Google Maps API endpoint`);
    
    const response = await fetch('/api/google-maps/distance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        origin,
        destination,
        mode
      })
    });
    
    if (!response.ok) {
      console.error(`❌ [GPS-UTILS] Server API HTTP error: ${response.status}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`📊 [GPS-UTILS] Server API response:`, data);

    if (!data.success) {
      console.error(`❌ [GPS-UTILS] Server API returned error: ${data.error || 'Unknown error'}`);
      throw new Error(`API error: ${data.error || 'Unknown error'}`);
    }

    console.log(`✅ [GPS-UTILS] Distance calculation success! Distance: ${data.distance}km, Method: ${data.method}`);
    if (data.duration) {
      console.log(`   Duration: ${data.duration.toFixed(1)} min`);
    }

    return {
      distance: data.distance,
      duration: data.duration,
      method: data.method,
      success: true
    };

  } catch (error) {
    console.error('❌ [GPS-UTILS] Google Distance Matrix API failed, falling back to Haversine calculation');
    console.error(`   Error details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.warn('   This means you\'ll get straight-line distance instead of road distance');
    
    // Fallback to Haversine formula
    const distance = calculateDistance(origin, destination);
    console.log(`✅ [GPS-UTILS] Haversine fallback calculated: ${distance}km (straight-line distance)`);
    
    return {
      distance,
      method: 'haversine',
      success: true,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Calculate total distance for a route using Google Distance Matrix API
 * Optimizes API calls by grouping waypoints efficiently
 * @param coordinates Array of coordinates representing the route
 * @param mode Travel mode (driving, walking, bicycling, transit)
 * @param maxWaypoints Maximum waypoints per API call (Google limit is 25)
 * @returns Promise with distance calculation result
 */
export async function calculateTotalDistanceWithGoogle(
  coordinates: Coordinate[],
  mode: 'driving' | 'walking' | 'bicycling' | 'transit' = 'driving',
  maxWaypoints = 10 // Conservative limit to stay within API quotas
): Promise<DistanceCalculationResult> {
  console.log('🗺️ [GPS-UTILS] calculateTotalDistanceWithGoogle called');
  console.log(`   Coordinates count: ${coordinates.length}`);
  console.log(`   Mode: ${mode}`);
  console.log(`   Max waypoints: ${maxWaypoints}`);
  
  if (coordinates.length < 2) {
    console.log('ℹ️ [GPS-UTILS] Less than 2 coordinates, returning 0 distance');
    return {
      distance: 0,
      method: 'haversine',
      success: true
    };
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  console.log(`   API Key available: ${!!apiKey} ${apiKey ? `(length: ${apiKey.length})` : '(MISSING)'}`);
  
  if (!apiKey) {
    console.warn('⚠️ [GPS-UTILS] No Google Maps API key found for route calculation! Falling back to Haversine');
    console.warn('   To fix: Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your .env.local file');
    
    // Fallback to Haversine if no API key
    const distance = calculateTotalDistance(coordinates);
    console.log(`✅ [GPS-UTILS] Total distance via Haversine: ${distance}km (straight-line segments)`);
    return {
      distance,
      method: 'haversine',
      success: true
    };
  }

  try {
    // Simplify route to key waypoints to minimize API calls
    const simplifiedCoords = simplifyRouteForAPI(coordinates, maxWaypoints);
    console.log(`🔗 [GPS-UTILS] Simplified ${coordinates.length} coordinates to ${simplifiedCoords.length} key waypoints`);
    
    let totalDistance = 0;
    let totalDuration = 0;

    // Process waypoints in chunks to respect API limits
    console.log(`🚶 [GPS-UTILS] Processing ${simplifiedCoords.length - 1} route segments...`);
    for (let i = 0; i < simplifiedCoords.length - 1; i++) {
      console.log(`   Segment ${i + 1}/${simplifiedCoords.length - 1}: Calculating distance...`);
      
      const result = await calculateDistanceWithGoogle(
        simplifiedCoords[i],
        simplifiedCoords[i + 1],
        mode
      );
      
      if (!result.success) {
        console.error(`❌ [GPS-UTILS] Segment ${i + 1} calculation failed`);
        throw new Error(result.error || 'Failed to calculate segment distance');
      }
      
      console.log(`   Segment ${i + 1} result: ${result.distance}km (method: ${result.method})`);
      totalDistance += result.distance;
      if (result.duration) {
        totalDuration += result.duration;
      }

      // Add small delay to respect rate limits
      if (i < simplifiedCoords.length - 2) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`✅ [GPS-UTILS] Google API route calculation completed successfully!`);
    console.log(`   Total distance: ${totalDistance}km, Total duration: ${totalDuration.toFixed(1)} min`);
    console.log(`   Used Google API for ${simplifiedCoords.length - 1} segments`);

    return {
      distance: totalDistance,
      duration: totalDuration,
      method: 'google_api',
      success: true
    };

  } catch (error) {
    console.error('❌ [GPS-UTILS] Google API route calculation failed, falling back to Haversine');
    console.error(`   Error details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.warn('   This means you\'ll get straight-line segments instead of road routing');
    
    // Fallback to Haversine formula
    const distance = calculateTotalDistance(coordinates);
    console.log(`✅ [GPS-UTILS] Haversine route fallback calculated: ${distance}km (straight-line segments)`);
    
    return {
      distance,
      method: 'haversine',
      success: true,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Simplify route coordinates for API efficiency
 * Keeps start, end, and key waypoints while staying within limits
 * @param coordinates Original route coordinates
 * @param maxPoints Maximum points to keep
 * @returns Simplified coordinate array
 */
function simplifyRouteForAPI(coordinates: Coordinate[], maxPoints: number): Coordinate[] {
  if (coordinates.length <= maxPoints) {
    return coordinates;
  }

  const simplified = [coordinates[0]]; // Always keep start point
  
  // Calculate step size to distribute waypoints evenly
  const step = Math.floor((coordinates.length - 2) / (maxPoints - 2));
  
  // Add intermediate waypoints
  for (let i = step; i < coordinates.length - 1; i += step) {
    if (simplified.length < maxPoints - 1) {
      simplified.push(coordinates[i]);
    }
  }
  
  // Always keep end point
  simplified.push(coordinates[coordinates.length - 1]);
  
  return simplified;
}

/**
 * Calculate route using Google Routes API with real-time traffic awareness
 * @param origin Starting coordinate
 * @param destination Ending coordinate
 * @param intermediates Optional waypoints along the route
 * @param travelMode Travel mode (DRIVE, WALK, BICYCLE, TRANSIT)
 * @param options Additional routing options
 * @returns Promise with detailed route calculation result
 */
export async function calculateRouteWithGoogle(
  origin: Coordinate,
  destination: Coordinate,
  intermediates: Coordinate[] = [],
  travelMode: 'DRIVE' | 'WALK' | 'BICYCLE' | 'TRANSIT' = 'DRIVE',
  options: {
    routingPreference?: 'TRAFFIC_UNAWARE' | 'TRAFFIC_AWARE' | 'TRAFFIC_AWARE_OPTIMAL';
    avoidTolls?: boolean;
    avoidHighways?: boolean;
    avoidFerries?: boolean;
  } = {}
): Promise<RouteCalculationResult> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    // Fallback to Distance Matrix API or Haversine
    console.warn('No Google API key found, falling back to Distance Matrix API');
    try {
      const distanceResult = await calculateDistanceWithGoogle(origin, destination, travelMode.toLowerCase() as 'driving' | 'walking' | 'bicycling' | 'transit');
      return {
        distance: distanceResult.distance,
        duration: distanceResult.duration || 0,
        staticDuration: distanceResult.duration || 0,
        polyline: '',
        legs: [{
          distance: distanceResult.distance,
          duration: distanceResult.duration || 0,
          startLocation: { latitude: origin.latitude, longitude: origin.longitude },
          endLocation: { latitude: destination.latitude, longitude: destination.longitude }
        }],
        method: 'google_routes',
        success: true,
        error: 'No API key, used Distance Matrix fallback'
      };
    } catch (error) {
      // Final fallback to Haversine
      console.warn('Distance Matrix API also failed:', error);
      const distance = calculateDistance(origin, destination);
      return {
        distance,
        duration: 0,
        staticDuration: 0,
        polyline: '',
        legs: [{
          distance,
          duration: 0,
          startLocation: { latitude: origin.latitude, longitude: origin.longitude },
          endLocation: { latitude: destination.latitude, longitude: destination.longitude }
        }],
        method: 'google_routes',
        success: true,
        error: 'No API key, used Haversine fallback'
      };
    }
  }

  try {
    // Construct the request body following Google Routes API documentation
    const requestBody: RouteRequest = {
      origin: {
        location: {
          latLng: {
            latitude: origin.latitude,
            longitude: origin.longitude
          }
        }
      },
      destination: {
        location: {
          latLng: {
            latitude: destination.latitude,
            longitude: destination.longitude
          }
        }
      },
      travelMode,
      routingPreference: options.routingPreference || 'TRAFFIC_AWARE',
      computeAlternativeRoutes: false
    };

    // Add intermediate waypoints if provided
    if (intermediates.length > 0) {
      requestBody.intermediates = intermediates.map(coord => ({
        location: {
          latLng: {
            latitude: coord.latitude,
            longitude: coord.longitude
          }
        },
        via: true // Mark as routing waypoints
      }));
    }

    // Add route modifiers if specified
    if (options.avoidTolls || options.avoidHighways || options.avoidFerries) {
      requestBody.routeModifiers = {
        avoidTolls: options.avoidTolls,
        avoidHighways: options.avoidHighways,
        avoidFerries: options.avoidFerries,
        avoidIndoor: true // Generally good for field workers
      };
    }

    // Make the API request following Google's guidelines
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.duration,routes.legs.distanceMeters,routes.legs.startLocation,routes.legs.endLocation,routes.description,routes.warnings'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: RoutesResponse = await response.json();

    if (!data.routes || data.routes.length === 0) {
      throw new Error('No routes found');
    }

    const route = data.routes[0]; // Use the first (optimal) route

    // Parse duration from ISO 8601 format (e.g., "1234s" to seconds)
    const parseDuration = (duration: string): number => {
      const match = duration.match(/(\d+)s/);
      return match ? parseInt(match[1]) / 60 : 0; // Convert to minutes
    };

    const result: RouteCalculationResult = {
      distance: route.distanceMeters / 1000, // Convert meters to kilometers
      duration: parseDuration(route.duration),
      staticDuration: parseDuration(route.staticDuration),
      polyline: route.polyline.encodedPolyline,
      legs: route.legs.map(leg => ({
        distance: leg.distanceMeters / 1000,
        duration: parseDuration(leg.duration),
        startLocation: leg.startLocation.latLng,
        endLocation: leg.endLocation.latLng
      })),
      method: 'google_routes',
      success: true,
      warnings: route.warnings
    };

    console.log(`Route calculated using Google Routes API: ${result.distance}km, ${result.duration}min (${result.staticDuration}min without traffic)`);
    
    return result;

  } catch (error) {
    console.warn('Google Routes API failed, falling back to Distance Matrix API:', error);
    
    try {
      // Fallback to Distance Matrix API
      const distanceResult = await calculateDistanceWithGoogle(origin, destination, travelMode.toLowerCase() as 'driving' | 'walking' | 'bicycling' | 'transit');
      return {
        distance: distanceResult.distance,
        duration: distanceResult.duration || 0,
        staticDuration: distanceResult.duration || 0,
        polyline: '',
        legs: [{
          distance: distanceResult.distance,
          duration: distanceResult.duration || 0,
          startLocation: { latitude: origin.latitude, longitude: origin.longitude },
          endLocation: { latitude: destination.latitude, longitude: destination.longitude }
        }],
        method: 'google_routes',
        success: true,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } catch (fallbackError) {
      // Final fallback to Haversine
      console.warn('All APIs failed, using Haversine fallback:', fallbackError);
      const distance = calculateDistance(origin, destination);
      return {
        distance,
        duration: 0,
        staticDuration: 0,
        polyline: '',
        legs: [{
          distance,
          duration: 0,
          startLocation: { latitude: origin.latitude, longitude: origin.longitude },
          endLocation: { latitude: destination.latitude, longitude: destination.longitude }
        }],
        method: 'google_routes',
        success: true,
        error: `Routes API and Distance Matrix API failed, used Haversine fallback: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

/**
 * Calculate total route distance for multiple coordinates using Google Routes API
 * Optimizes waypoints and provides traffic-aware routing
 * @param coordinates Array of coordinates representing the route
 * @param travelMode Travel mode (DRIVE, WALK, BICYCLE, TRANSIT)
 * @param options Additional routing options
 * @returns Promise with comprehensive route calculation result
 */
export async function calculateTotalRouteWithGoogle(
  coordinates: Coordinate[],
  travelMode: 'DRIVE' | 'WALK' | 'BICYCLE' | 'TRANSIT' = 'DRIVE',
  options: {
    routingPreference?: 'TRAFFIC_UNAWARE' | 'TRAFFIC_AWARE' | 'TRAFFIC_AWARE_OPTIMAL';
    avoidTolls?: boolean;
    avoidHighways?: boolean;
    avoidFerries?: boolean;
    maxWaypoints?: number;
  } = {}
): Promise<RouteCalculationResult> {
  if (coordinates.length < 2) {
    return {
      distance: 0,
      duration: 0,
      staticDuration: 0,
      polyline: '',
      legs: [],
      method: 'google_routes',
      success: true
    };
  }

  const maxWaypoints = options.maxWaypoints || 8; // Conservative limit for Routes API

  try {
    // For simple two-point routes, use direct calculation
    if (coordinates.length === 2) {
      return await calculateRouteWithGoogle(
        coordinates[0],
        coordinates[coordinates.length - 1],
        [],
        travelMode,
        options
      );
    }

    // For complex routes, optimize waypoints
    const simplifiedCoords = simplifyRouteForAPI(coordinates, maxWaypoints + 2); // +2 for origin and destination
    const origin = simplifiedCoords[0];
    const destination = simplifiedCoords[simplifiedCoords.length - 1];
    const intermediates = simplifiedCoords.slice(1, -1);

    const result = await calculateRouteWithGoogle(
      origin,
      destination,
      intermediates,
      travelMode,
      options
    );

    console.log(`Total route calculated using Google Routes API: ${result.distance}km, ${result.duration}min with ${intermediates.length} waypoints`);
    
    return result;

  } catch (error) {
    console.warn('Google Routes API failed for total route, falling back to Distance Matrix API:', error);
    
    try {
      // Fallback to Distance Matrix API
      const distanceResult = await calculateTotalDistanceWithGoogle(coordinates, travelMode.toLowerCase() as 'driving' | 'walking' | 'bicycling' | 'transit');
      return {
        distance: distanceResult.distance,
        duration: distanceResult.duration || 0,
        staticDuration: distanceResult.duration || 0,
        polyline: '',
        legs: [],
        method: 'google_routes',
        success: true,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } catch (fallbackError) {
      // Final fallback to Haversine
      console.warn('All APIs failed for route calculation, using Haversine fallback:', fallbackError);
      const distance = calculateTotalDistance(coordinates);
      return {
        distance,
        duration: 0,
        staticDuration: 0,
        polyline: '',
        legs: [],
        method: 'google_routes',
        success: true,
        error: `Routes API and Distance Matrix API failed, used Haversine fallback: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

/**
 * Validate GPS coordinates
 * @param coordinate Coordinate to validate
 * @returns Validation result
 */
export function validateCoordinate(coordinate: Coordinate): GPSValidationResult {
  const errors: string[] = [];

  // Validate latitude range (-90 to 90)
  if (coordinate.latitude < -90 || coordinate.latitude > 90) {
    errors.push('Latitude must be between -90 and 90 degrees');
  }

  // Validate longitude range (-180 to 180)
  if (coordinate.longitude < -180 || coordinate.longitude > 180) {
    errors.push('Longitude must be between -180 and 180 degrees');
  }

  // Validate accuracy if provided - warning instead of error for poor accuracy
  if (coordinate.accuracy !== undefined && coordinate.accuracy > GPS_ACCURACY_THRESHOLD * 5) {
    errors.push(`GPS accuracy (${coordinate.accuracy}m) is extremely poor (threshold: ${GPS_ACCURACY_THRESHOLD}m)`);
  }

  // Validate speed if provided (reasonable range: 0-200 km/h)
  if (coordinate.speed !== undefined && (coordinate.speed < 0 || coordinate.speed > 200)) {
    errors.push('Speed must be between 0 and 200 km/h');
  }

  // Validate altitude if provided (reasonable range: -500 to 10000 meters)
  if (coordinate.altitude !== undefined && (coordinate.altitude < -500 || coordinate.altitude > 10000)) {
    errors.push('Altitude must be between -500 and 10000 meters');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate array of coordinates
 * @param coordinates Array of coordinates to validate
 * @returns Validation result
 */
export function validateCoordinates(coordinates: Coordinate[]): GPSValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    errors.push('Coordinates array must not be empty');
    return { isValid: false, errors };
  }

  coordinates.forEach((coord, index) => {
    const validation = validateCoordinate(coord);
    if (!validation.isValid) {
      errors.push(`Coordinate ${index}: ${validation.errors.join(', ')}`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Filter coordinates by accuracy threshold
 * @param coordinates Array of coordinates
 * @returns Filtered coordinates with acceptable accuracy
 */
export function filterByAccuracy(coordinates: Coordinate[]): Coordinate[] {
  return coordinates.filter(coord => 
    coord.accuracy === undefined || coord.accuracy <= GPS_ACCURACY_THRESHOLD
  );
}

/**
 * Calculate average speed from coordinates
 * @param coordinates Array of coordinates with timestamps
 * @returns Average speed in km/h
 */
export function calculateAverageSpeed(coordinates: Coordinate[]): number {
  if (coordinates.length < 2) return 0;

  const filteredCoords = coordinates.filter(coord => coord.timestamp);
  if (filteredCoords.length < 2) return 0;

  const totalDistance = calculateTotalDistance(filteredCoords);
  const timeSpan = filteredCoords[filteredCoords.length - 1].timestamp!.getTime() - 
                  filteredCoords[0].timestamp!.getTime();
  
  const hours = timeSpan / (1000 * 60 * 60); // Convert milliseconds to hours
  
  return hours > 0 ? totalDistance / hours : 0;
}

/**
 * Convert degrees to radians
 * @param degrees Degrees value
 * @returns Radians value
 */
function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 * @param radians Radians value
 * @returns Degrees value
 */
export function radiansToDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Calculate bearing between two coordinates
 * @param coord1 Start coordinate
 * @param coord2 End coordinate
 * @returns Bearing in degrees (0-360)
 */
export function calculateBearing(coord1: Coordinate, coord2: Coordinate): number {
  const lat1Rad = degreesToRadians(coord1.latitude);
  const lat2Rad = degreesToRadians(coord2.latitude);
  const deltaLngRad = degreesToRadians(coord2.longitude - coord1.longitude);

  const x = Math.sin(deltaLngRad) * Math.cos(lat2Rad);
  const y = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
           Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLngRad);

  const bearingRad = Math.atan2(x, y);
  const bearingDeg = radiansToDegrees(bearingRad);
  
  return (bearingDeg + 360) % 360; // Normalize to 0-360
}

/**
 * Remove duplicate or too-close coordinates
 * @param coordinates Array of coordinates
 * @param minDistance Minimum distance in meters (default: 1m)
 * @returns Filtered coordinates
 */
export function removeDuplicateCoordinates(coordinates: Coordinate[], minDistance = 0.001): Coordinate[] {
  if (coordinates.length <= 1) return coordinates;

  const filtered = [coordinates[0]];
  
  for (let i = 1; i < coordinates.length; i++) {
    const distance = calculateDistance(filtered[filtered.length - 1], coordinates[i]);
    if (distance >= minDistance) {
      filtered.push(coordinates[i]);
    }
  }

  return filtered;
}

/**
 * Compress GPS data for efficient storage
 * @param coordinates Array of coordinates
 * @returns Compressed coordinate data
 */
export interface CompressedGPSData {
  startTime: Date;
  coordinates: {
    lat: number;
    lng: number;
    timeOffset: number; // Offset in seconds from startTime
    accuracy?: number;
    speed?: number;
    altitude?: number;
  }[];
  totalDistance: number;
}

export function compressGPSData(coordinates: Coordinate[]): CompressedGPSData {
  if (coordinates.length === 0) {
    throw new Error('Cannot compress empty coordinates array');
  }

  // Remove duplicates and filter by accuracy
  const filtered = removeDuplicateCoordinates(filterByAccuracy(coordinates));
  
  if (filtered.length === 0) {
    throw new Error('No valid coordinates after filtering');
  }

  const startTime = filtered[0].timestamp || new Date();
  const totalDistance = calculateTotalDistance(filtered);

  const compressed = filtered.map(coord => ({
    lat: Math.round(coord.latitude * 1000000) / 1000000, // 6 decimal places
    lng: Math.round(coord.longitude * 1000000) / 1000000, // 6 decimal places
    timeOffset: coord.timestamp ? 
      Math.round((coord.timestamp.getTime() - startTime.getTime()) / 1000) : 0,
    ...(coord.accuracy && { accuracy: Math.round(coord.accuracy * 10) / 10 }),
    ...(coord.speed && { speed: Math.round(coord.speed * 10) / 10 }),
    ...(coord.altitude && { altitude: Math.round(coord.altitude * 10) / 10 })
  }));

  return {
    startTime,
    coordinates: compressed,
    totalDistance: Math.round(totalDistance * 1000) / 1000 // 3 decimal places
  };
}
