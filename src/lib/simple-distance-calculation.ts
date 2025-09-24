/**
 * Simple Google Distance Matrix API Implementation
 * 
 * This module provides straightforward distance calculation by:
 * 1. Dividing coordinates into segments
 * 2. Using Google Distance Matrix API to get distance between start and end of each segment
 * 3. Summing all segment distances
 * 
 * No complex filtering, no overlapping calculations - just simple and accurate.
 */

export interface SimpleDistanceResult {
  distance: number; // in kilometers
  duration?: number; // in minutes
  method: 'google_distance_matrix' | 'haversine';
  success: boolean;
  segmentsProcessed: number;
  apiCallsMade: number;
  error?: string;
}

interface DistanceMatrixResponse {
  rows: Array<{
    elements: Array<{
      status: 'OK' | 'NOT_FOUND' | 'ZERO_RESULTS' | 'MAX_ROUTE_LENGTH_EXCEEDED';
      distance?: {
        text: string;
        value: number; // in meters
      };
      duration?: {
        text: string;
        value: number; // in seconds
      };
    }>;
  }>;
  status: 'OK' | 'INVALID_REQUEST' | 'MAX_ELEMENTS_EXCEEDED' | 'OVER_DAILY_LIMIT' | 'OVER_QUERY_LIMIT' | 'REQUEST_DENIED' | 'UNKNOWN_ERROR';
  error_message?: string;
}

/**
 * Calculate distance using simple segment-based approach with Google Distance Matrix API
 */
export async function calculateSimpleDistance(
  coordinates: Array<{ latitude: number; longitude: number; timestamp?: Date }>,
  options: {
    apiKey?: string;
    mode?: 'driving' | 'walking' | 'bicycling' | 'transit';
    segmentSize?: number; // number of coordinates per segment
  } = {}
): Promise<SimpleDistanceResult> {
  const { mode = 'driving', segmentSize = 50 } = options;
  const apiKey = options.apiKey || process.env.GOOGLE_MAPS_API_KEY;
  
  console.log(`🗺️ [SIMPLE-DISTANCE] Starting calculation for ${coordinates.length} coordinates`);
  
  if (coordinates.length < 2) {
    return {
      distance: 0,
      method: 'haversine',
      success: true,
      segmentsProcessed: 0,
      apiCallsMade: 0
    };
  }

  // Remove basic duplicates (same lat/lng)
  const filteredCoords = removeDuplicates(coordinates);
  console.log(`🔍 [SIMPLE-DISTANCE] After duplicate removal: ${coordinates.length} → ${filteredCoords.length} coordinates`);

  if (filteredCoords.length < 2) {
    return {
      distance: 0,
      method: 'haversine',
      success: true,
      segmentsProcessed: 0,
      apiCallsMade: 0
    };
  }

  if (!apiKey) {
    console.warn(`⚠️ [SIMPLE-DISTANCE] No API key available, using Haversine fallback`);
    const distance = calculateHaversineTotal(filteredCoords);
    return {
      distance,
      method: 'haversine',
      success: true,
      segmentsProcessed: filteredCoords.length - 1,
      apiCallsMade: 0,
      error: 'No Google Maps API key available'
    };
  }

  // Divide into segments
  const segments = createSegments(filteredCoords, segmentSize);
  console.log(`🔗 [SIMPLE-DISTANCE] Created ${segments.length} segments from ${filteredCoords.length} coordinates`);

  let totalDistance = 0;
  let totalDuration = 0;
  let apiCallsMade = 0;
  let segmentsProcessed = 0;

  // Process each segment
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    
    try {
      console.log(`📡 [SIMPLE-DISTANCE] Processing segment ${i + 1}/${segments.length}: ${segment.start.latitude.toFixed(4)}, ${segment.start.longitude.toFixed(4)} → ${segment.end.latitude.toFixed(4)}, ${segment.end.longitude.toFixed(4)}`);
      
      const result = await callDistanceMatrixAPI(segment.start, segment.end, apiKey, mode);
      apiCallsMade++;
      
      if (result.success) {
        totalDistance += result.distance;
        totalDuration += result.duration || 0;
        segmentsProcessed++;
        console.log(`   ✅ Segment ${i + 1}: ${result.distance.toFixed(3)}km`);
      } else {
        // Fallback to Haversine for this segment
        const haversineDistance = calculateHaversineDistance(segment.start, segment.end);
        totalDistance += haversineDistance;
        segmentsProcessed++;
        console.log(`   ⚠️ Segment ${i + 1}: ${haversineDistance.toFixed(3)}km (Haversine fallback)`);
      }
      
      // Small delay to respect rate limits
      if (i < segments.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
    } catch (error) {
      console.error(`❌ [SIMPLE-DISTANCE] Error processing segment ${i + 1}:`, error);
      
      // Fallback to Haversine for this segment
      const haversineDistance = calculateHaversineDistance(segment.start, segment.end);
      totalDistance += haversineDistance;
      segmentsProcessed++;
      console.log(`   🔄 Segment ${i + 1}: ${haversineDistance.toFixed(3)}km (Error fallback)`);
    }
  }

  console.log(`✅ [SIMPLE-DISTANCE] Calculation complete: ${totalDistance.toFixed(3)}km`);
  console.log(`   📊 Processed ${segmentsProcessed} segments with ${apiCallsMade} API calls`);
  
  return {
    distance: Math.round(totalDistance * 1000) / 1000, // Round to 3 decimal places
    duration: totalDuration > 0 ? Math.round(totalDuration * 10) / 10 : undefined,
    method: 'google_distance_matrix',
    success: true,
    segmentsProcessed,
    apiCallsMade
  };
}

/**
 * Create segments from coordinates
 */
function createSegments(
  coordinates: Array<{ latitude: number; longitude: number }>, 
  segmentSize: number
): Array<{ start: { latitude: number; longitude: number }, end: { latitude: number; longitude: number } }> {
  const segments: Array<{ start: { latitude: number; longitude: number }, end: { latitude: number; longitude: number } }> = [];
  
  for (let i = 0; i < coordinates.length - 1; i += segmentSize) {
    const segmentStart = coordinates[i];
    const segmentEnd = coordinates[Math.min(i + segmentSize, coordinates.length - 1)];
    
    // Only add segment if start and end are different
    if (segmentStart.latitude !== segmentEnd.latitude || segmentStart.longitude !== segmentEnd.longitude) {
      segments.push({
        start: segmentStart,
        end: segmentEnd
      });
    }
  }
  
  return segments;
}

/**
 * Remove duplicate coordinates (same lat/lng)
 */
function removeDuplicates(
  coordinates: Array<{ latitude: number; longitude: number; timestamp?: Date }>
): Array<{ latitude: number; longitude: number; timestamp?: Date }> {
  if (coordinates.length <= 1) return coordinates;
  
  const filtered = [coordinates[0]];
  
  for (let i = 1; i < coordinates.length; i++) {
    const current = coordinates[i];
    const previous = filtered[filtered.length - 1];
    
    // Only add if coordinates are different (to 6 decimal places)
    const latDiff = Math.abs(current.latitude - previous.latitude);
    const lngDiff = Math.abs(current.longitude - previous.longitude);
    
    if (latDiff > 0.000001 || lngDiff > 0.000001) {
      filtered.push(current);
    }
  }
  
  return filtered;
}

/**
 * Call Google Distance Matrix API for two points
 */
async function callDistanceMatrixAPI(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  apiKey: string,
  mode: string
): Promise<{
  success: boolean;
  distance: number; // in kilometers
  duration?: number; // in minutes
  error?: string;
}> {
  try {
    const originStr = `${origin.latitude},${origin.longitude}`;
    const destinationStr = `${destination.latitude},${destination.longitude}`;
    
    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
    url.searchParams.append('origins', originStr);
    url.searchParams.append('destinations', destinationStr);
    url.searchParams.append('mode', mode);
    url.searchParams.append('units', 'metric');
    url.searchParams.append('key', apiKey);
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    const data: DistanceMatrixResponse = await response.json();
    
    if (data.status !== 'OK') {
      throw new Error(`API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
    }
    
    const element = data.rows[0]?.elements[0];
    if (!element || element.status !== 'OK' || !element.distance || !element.duration) {
      throw new Error(`No valid route found: ${element?.status || 'Unknown error'}`);
    }
    
    return {
      success: true,
      distance: element.distance.value / 1000, // Convert meters to kilometers
      duration: element.duration.value / 60 // Convert seconds to minutes
    };
    
  } catch (error) {
    return {
      success: false,
      distance: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Calculate Haversine distance between two points
 */
function calculateHaversineDistance(
  point1: { latitude: number; longitude: number },
  point2: { latitude: number; longitude: number }
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
  const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Calculate total Haversine distance for array of coordinates
 */
function calculateHaversineTotal(coordinates: Array<{ latitude: number; longitude: number }>): number {
  if (coordinates.length < 2) return 0;
  
  let totalDistance = 0;
  for (let i = 1; i < coordinates.length; i++) {
    totalDistance += calculateHaversineDistance(coordinates[i - 1], coordinates[i]);
  }
  
  return totalDistance;
}