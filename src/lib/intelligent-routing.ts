/**
 * Intelligent Routing System
 * 
 * This module provides intelligent decision-making for when to use Google Maps Roads API
 * vs algorithmic routing based on GPS location patterns and movement analysis.
 * 
 * Features:
 * - Movement pattern analysis
 * - Static location detection
 * - Route complexity assessment
 * - Return journey optimization
 * - API quota optimization
 */

import { Coordinate, calculateDistance } from './gps-utils';

export interface RouteAnalysis {
  shouldUseRoadsAPI: boolean;
  isStaticLocation: boolean;
  movementDistance: number;
  movementVariance: number;
  routeComplexity: 'simple' | 'moderate' | 'complex';
  confidenceLevel: number;
  reasoning: string[];
  recommendations: {
    useAlgorithmic: boolean;
    useRoadsAPI: boolean;
    skipRouting: boolean;
  };
}

export interface MovementPattern {
  totalDistance: number;
  averageSpeed: number;
  maxDistance: number;
  minDistance: number;
  distanceVariance: number;
  timeSpan: number; // in minutes
  movementRadius: number; // circular area of movement
  directionChanges: number;
  isReturning: boolean; // detected return journey
}

// Configuration constants
const ROUTING_CONFIG = {
  // Distance thresholds (in kilometers)
  MIN_DISTANCE_FOR_ROADS_API: 0.1, // 100 meters minimum
  STATIC_LOCATION_THRESHOLD: 0.05, // 50 meters - consider static
  MAX_BUILDING_RADIUS: 0.02, // 20 meters - inside building movement
  
  // Movement analysis
  MIN_POINTS_FOR_ANALYSIS: 3,
  MAX_VARIANCE_FOR_STATIC: 0.001, // Very low variance = static
  MIN_COMPLEXITY_SCORE: 2, // Minimum route complexity to use Roads API
  
  // Time-based thresholds
  MIN_TIME_FOR_MOVEMENT: 2, // minutes
  MAX_STATIC_TIME: 10, // minutes - too long stationary
  
  // Return journey detection
  RETURN_THRESHOLD_RATIO: 0.3, // 30% of points near start = return journey
  RETURN_PROXIMITY_THRESHOLD: 0.1, // 100 meters from start
};

/**
 * Analyze GPS coordinates to determine movement patterns
 */
export function analyzeMovementPattern(coordinates: Coordinate[]): MovementPattern {
  if (coordinates.length < 2) {
    return {
      totalDistance: 0,
      averageSpeed: 0,
      maxDistance: 0,
      minDistance: 0,
      distanceVariance: 0,
      timeSpan: 0,
      movementRadius: 0,
      directionChanges: 0,
      isReturning: false,
    };
  }

  // Calculate distances between consecutive points
  const distances: number[] = [];
  let totalDistance = 0;

  for (let i = 1; i < coordinates.length; i++) {
    const distance = calculateDistance(coordinates[i - 1], coordinates[i]);
    distances.push(distance);
    totalDistance += distance;
  }

  // Basic statistics
  const maxDistance = Math.max(...distances);
  const minDistance = Math.min(...distances);
  const averageDistance = totalDistance / distances.length;
  
  // Calculate variance
  const distanceVariance = distances.reduce((sum, dist) => {
    return sum + Math.pow(dist - averageDistance, 2);
  }, 0) / distances.length;

  // Time span calculation
  const firstTime = coordinates[0].timestamp ? new Date(coordinates[0].timestamp) : new Date();
  const lastCoordinate = coordinates[coordinates.length - 1];
  const lastTime = lastCoordinate.timestamp ? new Date(lastCoordinate.timestamp) : new Date();
  const timeSpan = (lastTime.getTime() - firstTime.getTime()) / (1000 * 60); // minutes

  // Average speed calculation (km/h)
  const averageSpeed = timeSpan > 0 ? (totalDistance / timeSpan) * 60 : 0;

  // Movement radius (how spread out the points are)
  const centerLat = coordinates.reduce((sum, c) => sum + c.latitude, 0) / coordinates.length;
  const centerLng = coordinates.reduce((sum, c) => sum + c.longitude, 0) / coordinates.length;
  const center = { latitude: centerLat, longitude: centerLng };
  
  const radiusDistances = coordinates.map(coord => calculateDistance(center, coord));
  const movementRadius = Math.max(...radiusDistances);

  // Direction changes analysis
  let directionChanges = 0;
  if (coordinates.length >= 3) {
    for (let i = 2; i < coordinates.length; i++) {
      const bearing1 = calculateBearing(coordinates[i - 2], coordinates[i - 1]);
      const bearing2 = calculateBearing(coordinates[i - 1], coordinates[i]);
      const bearingDiff = Math.abs(bearing1 - bearing2);
      const normalizedDiff = Math.min(bearingDiff, 360 - bearingDiff);
      
      if (normalizedDiff > 30) { // 30 degrees = significant direction change
        directionChanges++;
      }
    }
  }

  // Return journey detection
  const isReturning = detectReturnJourney(coordinates);

  return {
    totalDistance,
    averageSpeed,
    maxDistance,
    minDistance,
    distanceVariance,
    timeSpan,
    movementRadius,
    directionChanges,
    isReturning,
  };
}

/**
 * Calculate bearing between two coordinates
 */
function calculateBearing(coord1: Coordinate, coord2: Coordinate): number {
  const lat1Rad = coord1.latitude * Math.PI / 180;
  const lat2Rad = coord2.latitude * Math.PI / 180;
  const deltaLngRad = (coord2.longitude - coord1.longitude) * Math.PI / 180;

  const x = Math.sin(deltaLngRad) * Math.cos(lat2Rad);
  const y = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
           Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLngRad);

  const bearingRad = Math.atan2(x, y);
  return (bearingRad * 180 / Math.PI + 360) % 360;
}

/**
 * Detect if this is a return journey
 */
function detectReturnJourney(coordinates: Coordinate[]): boolean {
  if (coordinates.length < 6) return false; // Need enough points

  const startPoint = coordinates[0];
  const totalPoints = coordinates.length;
  
  // Count how many points in the latter half are close to the start
  const startIndex = Math.floor(totalPoints * 0.6); // Check last 40% of journey
  let nearStartCount = 0;

  for (let i = startIndex; i < totalPoints; i++) {
    const distanceFromStart = calculateDistance(startPoint, coordinates[i]);
    if (distanceFromStart <= ROUTING_CONFIG.RETURN_PROXIMITY_THRESHOLD) {
      nearStartCount++;
    }
  }

  const returnRatio = nearStartCount / (totalPoints - startIndex);
  return returnRatio >= ROUTING_CONFIG.RETURN_THRESHOLD_RATIO;
}

/**
 * Analyze route complexity to determine routing method
 */
export function analyzeRouteComplexity(coordinates: Coordinate[], movementPattern: MovementPattern): RouteAnalysis {
  const reasoning: string[] = [];
  let confidenceLevel = 0;

  // Check if coordinates are sufficient for analysis
  if (coordinates.length < ROUTING_CONFIG.MIN_POINTS_FOR_ANALYSIS) {
    return {
      shouldUseRoadsAPI: false,
      isStaticLocation: true,
      movementDistance: movementPattern.totalDistance,
      movementVariance: movementPattern.distanceVariance,
      routeComplexity: 'simple',
      confidenceLevel: 100,
      reasoning: ['Insufficient GPS points for route analysis'],
      recommendations: {
        useAlgorithmic: false,
        useRoadsAPI: false,
        skipRouting: true,
      },
    };
  }

  // 1. Static location detection
  const isStaticLocation = (
    movementPattern.totalDistance < ROUTING_CONFIG.STATIC_LOCATION_THRESHOLD ||
    movementPattern.movementRadius < ROUTING_CONFIG.MAX_BUILDING_RADIUS ||
    movementPattern.distanceVariance < ROUTING_CONFIG.MAX_VARIANCE_FOR_STATIC
  );

  if (isStaticLocation) {
    reasoning.push('Location appears static - minimal movement detected');
    confidenceLevel = 95;
    
    return {
      shouldUseRoadsAPI: false,
      isStaticLocation: true,
      movementDistance: movementPattern.totalDistance,
      movementVariance: movementPattern.distanceVariance,
      routeComplexity: 'simple',
      confidenceLevel,
      reasoning,
      recommendations: {
        useAlgorithmic: false,
        useRoadsAPI: false,
        skipRouting: true,
      },
    };
  }

  // 2. Check minimum distance threshold
  if (movementPattern.totalDistance < ROUTING_CONFIG.MIN_DISTANCE_FOR_ROADS_API) {
    reasoning.push(`Total distance (${movementPattern.totalDistance.toFixed(2)}km) below minimum threshold for Roads API`);
    confidenceLevel = 85;
    
    return {
      shouldUseRoadsAPI: false,
      isStaticLocation: false,
      movementDistance: movementPattern.totalDistance,
      movementVariance: movementPattern.distanceVariance,
      routeComplexity: 'simple',
      confidenceLevel,
      reasoning,
      recommendations: {
        useAlgorithmic: true,
        useRoadsAPI: false,
        skipRouting: false,
      },
    };
  }

  // 3. Calculate route complexity score
  let complexityScore = 0;
  let routeComplexity: 'simple' | 'moderate' | 'complex' = 'simple';

  // Distance complexity
  if (movementPattern.totalDistance > 5) complexityScore += 2;
  else if (movementPattern.totalDistance > 1) complexityScore += 1;

  // Direction changes complexity
  const directionComplexity = movementPattern.directionChanges / coordinates.length;
  if (directionComplexity > 0.3) complexityScore += 2;
  else if (directionComplexity > 0.1) complexityScore += 1;

  // Time/speed complexity
  if (movementPattern.averageSpeed > 30) complexityScore += 1; // Highway speeds
  if (movementPattern.timeSpan > 30) complexityScore += 1; // Long journeys

  // Movement radius complexity
  if (movementPattern.movementRadius > 2) complexityScore += 2;
  else if (movementPattern.movementRadius > 0.5) complexityScore += 1;

  // Set complexity level
  if (complexityScore >= 6) routeComplexity = 'complex';
  else if (complexityScore >= 3) routeComplexity = 'moderate';

  // 4. Handle return journeys specially
  if (movementPattern.isReturning) {
    reasoning.push('Return journey detected - optimizing for round trip');
    
    // For return journeys, we can use Roads API but with optimizations
    if (complexityScore >= ROUTING_CONFIG.MIN_COMPLEXITY_SCORE) {
      reasoning.push('Complex return journey - using Roads API with return optimization');
      confidenceLevel = 80;
      
      return {
        shouldUseRoadsAPI: true,
        isStaticLocation: false,
        movementDistance: movementPattern.totalDistance,
        movementVariance: movementPattern.distanceVariance,
        routeComplexity,
        confidenceLevel,
        reasoning,
        recommendations: {
          useAlgorithmic: false,
          useRoadsAPI: true,
          skipRouting: false,
        },
      };
    } else {
      reasoning.push('Simple return journey - using algorithmic routing');
      confidenceLevel = 75;
      
      return {
        shouldUseRoadsAPI: false,
        isStaticLocation: false,
        movementDistance: movementPattern.totalDistance,
        movementVariance: movementPattern.distanceVariance,
        routeComplexity,
        confidenceLevel,
        reasoning,
        recommendations: {
          useAlgorithmic: true,
          useRoadsAPI: false,
          skipRouting: false,
        },
      };
    }
  }

  // 5. Final decision based on complexity
  const shouldUseRoadsAPI = complexityScore >= ROUTING_CONFIG.MIN_COMPLEXITY_SCORE;
  confidenceLevel = Math.min(90, 50 + (complexityScore * 10));

  if (shouldUseRoadsAPI) {
    reasoning.push(`Route complexity score (${complexityScore}) warrants Roads API usage`);
    reasoning.push(`Complex route with ${movementPattern.directionChanges} direction changes`);
  } else {
    reasoning.push(`Route complexity score (${complexityScore}) suggests algorithmic routing is sufficient`);
  }

  return {
    shouldUseRoadsAPI,
    isStaticLocation: false,
    movementDistance: movementPattern.totalDistance,
    movementVariance: movementPattern.distanceVariance,
    routeComplexity,
    confidenceLevel,
    reasoning,
    recommendations: {
      useAlgorithmic: !shouldUseRoadsAPI,
      useRoadsAPI: shouldUseRoadsAPI,
      skipRouting: false,
    },
  };
}

/**
 * Main intelligent routing decision function
 */
export function getIntelligentRoutingDecision(coordinates: Coordinate[]): RouteAnalysis {
  console.log(`🧠 [INTELLIGENT-ROUTING] Analyzing ${coordinates.length} GPS coordinates...`);
  
  // Exit early if no valid route possible
  if (coordinates.length < 2) {
    return {
      shouldUseRoadsAPI: false,
      isStaticLocation: true,
      movementDistance: 0,
      movementVariance: 0,
      routeComplexity: 'simple',
      confidenceLevel: 100,
      reasoning: ['Insufficient points for route analysis'],
      recommendations: {
        useAlgorithmic: false,
        useRoadsAPI: false,
        skipRouting: true,
      },
    };
  }
  
  const movementPattern = analyzeMovementPattern(coordinates);
  const routeAnalysis = analyzeRouteComplexity(coordinates, movementPattern);

  console.log(`📊 [INTELLIGENT-ROUTING] Analysis complete:`);
  console.log(`   Total Distance: ${movementPattern.totalDistance.toFixed(3)}km`);
  console.log(`   Movement Radius: ${movementPattern.movementRadius.toFixed(3)}km`);
  console.log(`   Direction Changes: ${movementPattern.directionChanges}`);
  console.log(`   Time Span: ${movementPattern.timeSpan.toFixed(1)} minutes`);
  console.log(`   Average Speed: ${movementPattern.averageSpeed.toFixed(1)} km/h`);
  console.log(`   Is Returning: ${movementPattern.isReturning}`);
  console.log(`   Route Complexity: ${routeAnalysis.routeComplexity}`);
  console.log(`   Should Use Roads API: ${routeAnalysis.shouldUseRoadsAPI}`);
  console.log(`   Confidence Level: ${routeAnalysis.confidenceLevel}%`);
  console.log(`   Reasoning: ${routeAnalysis.reasoning.join(', ')}`);

  return routeAnalysis;
}

/**
 * Get optimized coordinate set for Roads API (reduces API calls)
 */
export function getOptimizedCoordinatesForRoadsAPI(coordinates: Coordinate[], maxPoints = 25): Coordinate[] {
  if (coordinates.length <= maxPoints) {
    return coordinates;
  }

  const optimized = [coordinates[0]]; // Always include start
  
  // Calculate step size to distribute waypoints evenly
  const step = Math.floor((coordinates.length - 2) / (maxPoints - 2));
  
  // Add intermediate waypoints at key intervals
  for (let i = step; i < coordinates.length - 1; i += step) {
    if (optimized.length < maxPoints - 1) {
      optimized.push(coordinates[i]);
    }
  }
  
  // Always include end
  optimized.push(coordinates[coordinates.length - 1]);
  
  console.log(`🔧 [INTELLIGENT-ROUTING] Optimized coordinates: ${coordinates.length} → ${optimized.length} for Roads API`);
  
  return optimized;
}

/**
 * Detect if current route is similar to a cached route (return journey optimization)
 */
export function detectSimilarRoute(newCoordinates: Coordinate[], cachedRoutes: { coordinates: Coordinate[], route: unknown }[]): boolean {
  if (cachedRoutes.length === 0) return false;

  const newStart = newCoordinates[0];
  const newEnd = newCoordinates[newCoordinates.length - 1];

  for (const cached of cachedRoutes) {
    const cachedStart = cached.coordinates[0];
    const cachedEnd = cached.coordinates[cached.coordinates.length - 1];

    // Check if this is a reverse journey (end matches start and vice versa)
    const startToEndDistance = calculateDistance(newStart, cachedEnd);
    const endToStartDistance = calculateDistance(newEnd, cachedStart);

    if (startToEndDistance < 0.1 && endToStartDistance < 0.1) {
      console.log(`🔄 [INTELLIGENT-ROUTING] Detected reverse journey - can reuse cached route`);
      return true;
    }

    // Check if this is the same route (both start and end are similar)
    const startToStartDistance = calculateDistance(newStart, cachedStart);
    const endToEndDistance = calculateDistance(newEnd, cachedEnd);

    if (startToStartDistance < 0.1 && endToEndDistance < 0.1) {
      console.log(`🔄 [INTELLIGENT-ROUTING] Detected similar route - can reuse cached route`);
      return true;
    }
  }

  return false;
}