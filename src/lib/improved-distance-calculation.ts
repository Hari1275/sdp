/**
 * Improved Google Distance Matrix API Implementation
 * 
 * This module provides accurate distance calculation using Google Distance Matrix API
 * with proper coordinate filtering, segmentation, and efficient API usage.
 * 
 * Key improvements:
 * - Proper coordinate filtering to remove duplicates and invalid points
 * - Intelligent segmentation to avoid overlapping calculations
 * - Efficient use of Google Distance Matrix API within quota limits
 * - Fallback to Haversine when API fails
 */


export interface ImprovedDistanceResult {
  distance: number; // in kilometers
  duration?: number; // in minutes
  method: 'google_distance_matrix' | 'haversine' | 'mixed';
  success: boolean;
  coordinatesProcessed: number;
  segmentsCalculated: number;
  apiCallsMade: number;
  error?: string;
  warnings?: string[];
}

export interface DistanceMatrixResponse {
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
 * Filter and clean GPS coordinates for accurate distance calculation
 */
export function filterAndCleanCoordinates(
  coordinates: Array<{ latitude: number; longitude: number; timestamp?: Date }>,
  options: {
    minDistanceThreshold?: number; // in kilometers, minimum distance between consecutive points
    maxAccuracyThreshold?: number; // in meters, maximum GPS accuracy to accept
    removeStationary?: boolean; // remove points where user was stationary
    maxSpeed?: number; // in km/h, filter out unrealistic speeds
  } = {}
): Array<{ latitude: number; longitude: number; timestamp?: Date }> {
  const {
    minDistanceThreshold = 0.005, // 5 meters
    maxSpeed = 150 // 150 km/h
  } = options;

  if (coordinates.length === 0) return [];

  console.log(`🔍 [COORDINATE-FILTER] Starting with ${coordinates.length} coordinates`);

  let filtered = [...coordinates];

  // Step 1: Remove invalid coordinates
  filtered = filtered.filter(coord => {
    const isValidLat = coord.latitude >= -90 && coord.latitude <= 90;
    const isValidLng = coord.longitude >= -180 && coord.longitude <= 180;
    const isValidCoord = isValidLat && isValidLng;
    
    if (!isValidCoord) {
      console.warn(`⚠️ [COORDINATE-FILTER] Invalid coordinate removed: ${coord.latitude}, ${coord.longitude}`);
    }
    
    return isValidCoord;
  });

  if (filtered.length === 0) return [];

  // Step 2: Remove duplicate or too-close points
  const cleanedCoordinates: Array<{ latitude: number; longitude: number; timestamp?: Date }> = [filtered[0]];
  
  for (let i = 1; i < filtered.length; i++) {
    const current = filtered[i];
    const previous = cleanedCoordinates[cleanedCoordinates.length - 1];
    
    const distance = calculateHaversineDistance(
      { latitude: previous.latitude, longitude: previous.longitude },
      { latitude: current.latitude, longitude: current.longitude }
    );
    
    // Only add if distance is above threshold
    if (distance >= minDistanceThreshold) {
      // Check speed if timestamps are available
      if (current.timestamp && previous.timestamp && maxSpeed) {
        const timeDiffHours = (new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime()) / (1000 * 60 * 60);
        if (timeDiffHours > 0) {
          const speed = distance / timeDiffHours;
          if (speed > maxSpeed) {
            console.warn(`⚠️ [COORDINATE-FILTER] Unrealistic speed detected: ${speed.toFixed(1)} km/h, skipping point`);
            continue;
          }
        }
      }
      
      cleanedCoordinates.push(current);
    }
  }

  console.log(`✅ [COORDINATE-FILTER] Filtered ${coordinates.length} → ${cleanedCoordinates.length} coordinates`);
  
  return cleanedCoordinates;
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
 * Segment coordinates into optimal chunks for Google Distance Matrix API
 */
export function segmentCoordinatesForAPI(
  coordinates: Array<{ latitude: number; longitude: number }>,
  maxElementsPerRequest: number = 10 // Conservative limit to avoid MAX_ELEMENTS_EXCEEDED
): Array<Array<{ latitude: number; longitude: number }>> {
  if (coordinates.length <= 1) return [];
  
  const segments: Array<Array<{ latitude: number; longitude: number }>> = [];
  
  // Create overlapping segments to ensure continuity
  for (let i = 0; i < coordinates.length - 1; i += maxElementsPerRequest) {
    const segmentEnd = Math.min(i + maxElementsPerRequest + 1, coordinates.length);
    const segment = coordinates.slice(i, segmentEnd);
    
    if (segment.length >= 2) {
      segments.push(segment);
    }
  }
  
  console.log(`🔗 [SEGMENTATION] Created ${segments.length} segments from ${coordinates.length} coordinates`);
  
  return segments;
}

/**
 * Calculate distance using Google Distance Matrix API with improved segmentation
 */
export async function calculateImprovedDistance(
  coordinates: Array<{ latitude: number; longitude: number; timestamp?: Date }>,
  options: {
    apiKey?: string;
    mode?: 'driving' | 'walking' | 'bicycling' | 'transit';
    filterOptions?: Parameters<typeof filterAndCleanCoordinates>[1];
  } = {}
): Promise<ImprovedDistanceResult> {
  const { mode = 'driving', filterOptions = {} } = options;
  const apiKey = options.apiKey || process.env.GOOGLE_MAPS_API_KEY;
  
  console.log(`🗺️ [IMPROVED-DISTANCE] Starting calculation for ${coordinates.length} coordinates`);
  
  if (coordinates.length < 2) {
    return {
      distance: 0,
      method: 'haversine',
      success: true,
      coordinatesProcessed: coordinates.length,
      segmentsCalculated: 0,
      apiCallsMade: 0
    };
  }

  // Step 1: Filter and clean coordinates
  const cleanedCoordinates = filterAndCleanCoordinates(coordinates, filterOptions);
  
  if (cleanedCoordinates.length < 2) {
    console.warn(`⚠️ [IMPROVED-DISTANCE] Insufficient valid coordinates after filtering`);
    return {
      distance: 0,
      method: 'haversine',
      success: true,
      coordinatesProcessed: cleanedCoordinates.length,
      segmentsCalculated: 0,
      apiCallsMade: 0,
      warnings: ['Insufficient valid coordinates after filtering']
    };
  }

  if (!apiKey) {
    console.warn(`⚠️ [IMPROVED-DISTANCE] No API key available, using Haversine fallback`);
    
    // Fallback to Haversine calculation
    let totalDistance = 0;
    for (let i = 1; i < cleanedCoordinates.length; i++) {
      totalDistance += calculateHaversineDistance(cleanedCoordinates[i - 1], cleanedCoordinates[i]);
    }
    
    return {
      distance: totalDistance,
      method: 'haversine',
      success: true,
      coordinatesProcessed: cleanedCoordinates.length,
      segmentsCalculated: cleanedCoordinates.length - 1,
      apiCallsMade: 0,
      error: 'No Google Maps API key available'
    };
  }

  // Step 2: Segment coordinates for API calls
  const segments = segmentCoordinatesForAPI(cleanedCoordinates.map(c => ({ latitude: c.latitude, longitude: c.longitude })));
  
  let totalDistance = 0;
  let totalDuration = 0;
  let apiCallsMade = 0;
  let segmentsCalculated = 0;
  const warnings: string[] = [];
  let hasApiFailure = false;

  // Step 3: Process each segment
  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
    const segment = segments[segmentIndex];
    
    try {
      console.log(`📡 [IMPROVED-DISTANCE] Processing segment ${segmentIndex + 1}/${segments.length} with ${segment.length} points`);
      
      const segmentResult = await callDistanceMatrixAPI(segment, apiKey, mode);
      apiCallsMade++;
      
      if (segmentResult.success) {
        totalDistance += segmentResult.distance;
        totalDuration += segmentResult.duration || 0;
        segmentsCalculated += segmentResult.segmentsProcessed;
      } else {
        // Fallback to Haversine for this segment
        console.warn(`⚠️ [IMPROVED-DISTANCE] API failed for segment ${segmentIndex + 1}, using Haversine fallback`);
        hasApiFailure = true;
        
        for (let i = 1; i < segment.length; i++) {
          totalDistance += calculateHaversineDistance(segment[i - 1], segment[i]);
          segmentsCalculated++;
        }
        
        warnings.push(`API failed for segment ${segmentIndex + 1}, used Haversine fallback`);
      }
      
      // Small delay to respect rate limits
      if (segmentIndex < segments.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
    } catch (error) {
      console.error(`❌ [IMPROVED-DISTANCE] Error processing segment ${segmentIndex + 1}:`, error);
      hasApiFailure = true;
      
      // Fallback to Haversine for this segment
      for (let i = 1; i < segment.length; i++) {
        totalDistance += calculateHaversineDistance(segment[i - 1], segment[i]);
        segmentsCalculated++;
      }
      
      warnings.push(`Error in segment ${segmentIndex + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  const method: ImprovedDistanceResult['method'] = hasApiFailure ? 'mixed' : 'google_distance_matrix';
  
  console.log(`✅ [IMPROVED-DISTANCE] Calculation complete: ${totalDistance.toFixed(3)}km using ${method}`);
  console.log(`   📊 Processed ${cleanedCoordinates.length} coordinates in ${segmentsCalculated} segments with ${apiCallsMade} API calls`);
  
  return {
    distance: Math.round(totalDistance * 1000) / 1000, // Round to 3 decimal places
    duration: totalDuration > 0 ? Math.round(totalDuration * 10) / 10 : undefined, // Round to 1 decimal place
    method,
    success: true,
    coordinatesProcessed: cleanedCoordinates.length,
    segmentsCalculated,
    apiCallsMade,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Call Google Distance Matrix API for a single segment
 */
async function callDistanceMatrixAPI(
  coordinates: Array<{ latitude: number; longitude: number }>,
  apiKey: string,
  mode: string
): Promise<{
  success: boolean;
  distance: number; // in kilometers
  duration?: number; // in minutes
  segmentsProcessed: number;
  error?: string;
}> {
  if (coordinates.length < 2) {
    return {
      success: false,
      distance: 0,
      segmentsProcessed: 0,
      error: 'Insufficient coordinates'
    };
  }

  try {
    // Use consecutive pairs for the segment
    const origins = coordinates.slice(0, -1);
    const destinations = coordinates.slice(1);
    
    const originsStr = origins.map(coord => `${coord.latitude},${coord.longitude}`).join('|');
    const destinationsStr = destinations.map(coord => `${coord.latitude},${coord.longitude}`).join('|');
    
    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
    url.searchParams.append('origins', originsStr);
    url.searchParams.append('destinations', destinationsStr);
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
    
    let totalDistance = 0; // in meters
    let totalDuration = 0; // in seconds
    let segmentsProcessed = 0;
    
    // Process diagonal elements (origin[i] to destination[i])
    for (let i = 0; i < Math.min(data.rows.length, destinations.length); i++) {
      const row = data.rows[i];
      if (i < row.elements.length) {
        const element = row.elements[i];
        
        if (element.status === 'OK' && element.distance && element.duration) {
          totalDistance += element.distance.value;
          totalDuration += element.duration.value;
          segmentsProcessed++;
        } else {
          // Fallback to Haversine for this pair
          const haversineDistance = calculateHaversineDistance(origins[i], destinations[i]);
          totalDistance += haversineDistance * 1000; // Convert to meters
          segmentsProcessed++;
        }
      }
    }
    
    return {
      success: true,
      distance: totalDistance / 1000, // Convert to kilometers
      duration: totalDuration / 60, // Convert to minutes
      segmentsProcessed
    };
    
  } catch (error) {
    return {
      success: false,
      distance: 0,
      segmentsProcessed: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Quick distance calculation for checkout (uses first/last coordinates plus key waypoints)
 */
export async function calculateCheckoutDistance(
  coordinates: Array<{ latitude: number; longitude: number; timestamp?: Date }>,
  apiKey?: string
): Promise<ImprovedDistanceResult> {
  if (coordinates.length < 2) {
    return {
      distance: 0,
      method: 'haversine',
      success: true,
      coordinatesProcessed: coordinates.length,
      segmentsCalculated: 0,
      apiCallsMade: 0
    };
  }

  // For checkout, use a simplified approach with key waypoints
  const cleanedCoordinates = filterAndCleanCoordinates(coordinates, {
    minDistanceThreshold: 0.01 // 10 meters minimum for checkout
  });

  if (cleanedCoordinates.length < 2) {
    return {
      distance: 0,
      method: 'haversine',
      success: true,
      coordinatesProcessed: cleanedCoordinates.length,
      segmentsCalculated: 0,
      apiCallsMade: 0
    };
  }

  // For efficiency, limit to maximum 25 key points for checkout
  let keyPoints = cleanedCoordinates;
  if (cleanedCoordinates.length > 25) {
    const step = Math.floor((cleanedCoordinates.length - 2) / 23); // Keep first, last, and 23 intermediate points
    keyPoints = [cleanedCoordinates[0]];
    
    for (let i = step; i < cleanedCoordinates.length - 1; i += step) {
      if (keyPoints.length < 24) {
        keyPoints.push(cleanedCoordinates[i]);
      }
    }
    
    keyPoints.push(cleanedCoordinates[cleanedCoordinates.length - 1]);
    console.log(`🔗 [CHECKOUT-DISTANCE] Optimized ${cleanedCoordinates.length} → ${keyPoints.length} key points for checkout`);
  }

  return await calculateImprovedDistance(keyPoints, {
    apiKey,
    mode: 'driving',
    filterOptions: {
      minDistanceThreshold: 0.005 // 5 meters
    }
  });
}