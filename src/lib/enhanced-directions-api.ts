/**
 * Enhanced Google Directions API Integration
 * 
 * This module provides intelligent Google Directions API usage for road-following routes:
 * - Uses Directions API instead of Roads API for proper road routing
 * - Handles coordinate limits efficiently with smart waypoint selection
 * - Provides single optimal route per session
 * - Handles return journeys intelligently to avoid route variations
 * - Includes route caching and optimization
 */

import { Coordinate } from './gps-utils';
import { getIntelligentRoutingDecision, RouteAnalysis } from './intelligent-routing';

export interface DirectionsAPIResponse {
  success: boolean;
  route?: {
    overview_polyline: {
      points: string; // Encoded polyline
    };
    legs: Array<{
      distance: { value: number; text: string };
      duration: { value: number; text: string };
      start_location: { lat: number; lng: number };
      end_location: { lat: number; lng: number };
    }>;
    bounds: {
      northeast: { lat: number; lng: number };
      southwest: { lat: number; lng: number };
    };
  };
  decodedPath?: Array<{ lat: number; lng: number }>;
  totalDistance: number; // in kilometers
  totalDuration: number; // in minutes
  method: string;
  apiCallsMade: number;
  cacheHit: boolean;
  routingDecision?: RouteAnalysis;
  error?: string;
  debugInfo?: {
    originalPoints: number;
    optimizedWaypoints: number;
    skippedDueToIntelligence: boolean;
    reasonsSkipped?: string[];
    waypointOptimization: string;
  };
}

// Route cache for intelligent caching
interface RouteCache {
  coordinates: Coordinate[];
  response: DirectionsAPIResponse;
  timestamp: Date;
  routeHash: string;
}

class EnhancedDirectionsAPI {
  private routeCache = new Map<string, RouteCache>();
  private readonly CACHE_EXPIRY_HOURS = 24;
  private readonly MAX_CACHE_SIZE = 50;
  private readonly MAX_WAYPOINTS = 23; // Google Directions API limit is 25 (origin + destination + 23 waypoints)

  /**
   * Generate a hash for route caching based on start/end points and route characteristics
   */
  private generateRouteHash(coordinates: Coordinate[]): string {
    const start = coordinates[0];
    const end = coordinates[coordinates.length - 1];
    
    // Create a hash based on start, end, and number of points for caching
    const routeKey = `${start.latitude.toFixed(4)},${start.longitude.toFixed(4)}-${end.latitude.toFixed(4)},${end.longitude.toFixed(4)}-${coordinates.length}`;
    return Buffer.from(routeKey).toString('base64').slice(0, 16);
  }

  /**
   * Check if cache entry is still valid
   */
  private isCacheValid(cache: RouteCache): boolean {
    const ageHours = (Date.now() - cache.timestamp.getTime()) / (1000 * 60 * 60);
    return ageHours < this.CACHE_EXPIRY_HOURS;
  }

  /**
   * Clean expired cache entries
   */
  private cleanupCache(): void {
    if (this.routeCache.size <= this.MAX_CACHE_SIZE) return;

    const entries = Array.from(this.routeCache.entries());
    const validEntries = entries.filter(([, cache]) => this.isCacheValid(cache));
    
    // Keep only the most recent valid entries
    this.routeCache.clear();
    validEntries
      .sort((a, b) => b[1].timestamp.getTime() - a[1].timestamp.getTime())
      .slice(0, this.MAX_CACHE_SIZE)
      .forEach(([key, cache]) => {
        this.routeCache.set(key, cache);
      });
  }

  /**
   * Optimize coordinates for Google Directions API with intelligent waypoint selection
   */
  private optimizeWaypointsForDirections(coordinates: Coordinate[]): {
    origin: Coordinate;
    destination: Coordinate;
    waypoints: Coordinate[];
    optimization: string;
  } {
    if (coordinates.length <= 2) {
      return {
        origin: coordinates[0],
        destination: coordinates[coordinates.length - 1],
        waypoints: [],
        optimization: 'direct_route'
      };
    }

    const origin = coordinates[0];
    const destination = coordinates[coordinates.length - 1];
    
    // If we have too many points, select key waypoints intelligently
    if (coordinates.length <= this.MAX_WAYPOINTS + 2) {
      // Use all intermediate points as waypoints
      return {
        origin,
        destination,
        waypoints: coordinates.slice(1, -1),
        optimization: 'all_points'
      };
    }

    // Smart waypoint selection for routes with many points
    const intermediatePoints = coordinates.slice(1, -1);
    const selectedWaypoints: Coordinate[] = [];

    // Method 1: Select waypoints at regular intervals
    const interval = Math.floor(intermediatePoints.length / this.MAX_WAYPOINTS);
    
    for (let i = 0; i < this.MAX_WAYPOINTS && i * interval < intermediatePoints.length; i++) {
      const waypointIndex = i * interval;
      if (waypointIndex < intermediatePoints.length) {
        selectedWaypoints.push(intermediatePoints[waypointIndex]);
      }
    }

    return {
      origin,
      destination,
      waypoints: selectedWaypoints,
      optimization: `interval_selection_${interval}`
    };
  }

  /**
   * Decode Google polyline
   */
  private decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
    const poly: Array<{ lat: number; lng: number }> = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let b: number;
      let shift = 0;
      let result = 0;
      
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      
      const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      
      const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      poly.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }

    return poly;
  }

  /**
   * Check for return journey to use cached route in reverse
   */
  private findReturnJourneyRoute(coordinates: Coordinate[]): DirectionsAPIResponse | null {
    const start = coordinates[0];
    const end = coordinates[coordinates.length - 1];

    for (const [, cachedRoute] of this.routeCache) {
      if (!this.isCacheValid(cachedRoute)) continue;

      const cachedStart = cachedRoute.coordinates[0];
      const cachedEnd = cachedRoute.coordinates[cachedRoute.coordinates.length - 1];

      // Check if this is a return journey (current start ≈ cached end, current end ≈ cached start)
      const startDistance = Math.sqrt(
        Math.pow(start.latitude - cachedEnd.latitude, 2) + 
        Math.pow(start.longitude - cachedEnd.longitude, 2)
      );
      
      const endDistance = Math.sqrt(
        Math.pow(end.latitude - cachedStart.latitude, 2) + 
        Math.pow(end.longitude - cachedStart.longitude, 2)
      );

      // If both distances are small (within ~100m), this is likely a return journey
      if (startDistance < 0.001 && endDistance < 0.001) {
        console.log(`🔄 [ENHANCED-DIRECTIONS] Return journey detected - reusing cached route`);
        
        // Return the cached route with reversed path
        const reversedPath = cachedRoute.response.decodedPath?.slice().reverse() || [];
        
        return {
          ...cachedRoute.response,
          decodedPath: reversedPath,
          cacheHit: true,
          method: 'return_journey_cached',
          debugInfo: {
            ...cachedRoute.response.debugInfo!,
            waypointOptimization: 'return_journey_reversal'
          }
        };
      }
    }

    return null;
  }

  /**
   * Get road-following route using Google Directions API
   */
  async getDirectionsRoute(coordinates: Coordinate[]): Promise<DirectionsAPIResponse> {
    console.log(`🗺️ [ENHANCED-DIRECTIONS] Processing ${coordinates.length} coordinates...`);

    try {
      // STEP 1: Apply intelligent routing analysis
      const routingDecision = getIntelligentRoutingDecision(coordinates);
      
      // If intelligence says skip routing entirely
      if (routingDecision.recommendations.skipRouting) {
        console.log(`⏭️ [ENHANCED-DIRECTIONS] Skipping routing - ${routingDecision.reasoning.join(', ')}`);
        
        return {
          success: true,
          decodedPath: coordinates.map(coord => ({
            lat: coord.latitude,
            lng: coord.longitude
          })),
          totalDistance: routingDecision.movementDistance,
          totalDuration: 0,
          method: 'skipped_static_location',
          apiCallsMade: 0,
          cacheHit: false,
          routingDecision,
          debugInfo: {
            originalPoints: coordinates.length,
            optimizedWaypoints: 0,
            skippedDueToIntelligence: true,
            reasonsSkipped: routingDecision.reasoning,
            waypointOptimization: 'skipped'
          }
        };
      }

      // STEP 2: Check for return journey
      const returnRoute = this.findReturnJourneyRoute(coordinates);
      if (returnRoute) {
        return returnRoute;
      }

      // STEP 3: Check regular cache
      const routeHash = this.generateRouteHash(coordinates);
      const cachedRoute = this.routeCache.get(routeHash);
      
      if (cachedRoute && this.isCacheValid(cachedRoute)) {
        console.log(`📦 [ENHANCED-DIRECTIONS] Cache hit for route ${routeHash}`);
        return {
          ...cachedRoute.response,
          cacheHit: true
        };
      }

      // STEP 4: If intelligence recommends algorithmic routing, return simple path
      if (routingDecision.recommendations.useAlgorithmic) {
        console.log(`🔧 [ENHANCED-DIRECTIONS] Using algorithmic routing - ${routingDecision.reasoning.join(', ')}`);
        
        return {
          success: true,
          decodedPath: coordinates.map(coord => ({
            lat: coord.latitude,
            lng: coord.longitude
          })),
          totalDistance: routingDecision.movementDistance,
          totalDuration: Math.max(1, routingDecision.movementDistance * 2), // Estimate 2 min/km
          method: 'algorithmic_recommended',
          apiCallsMade: 0,
          cacheHit: false,
          routingDecision,
          debugInfo: {
            originalPoints: coordinates.length,
            optimizedWaypoints: 0,
            skippedDueToIntelligence: true,
            reasonsSkipped: routingDecision.reasoning,
            waypointOptimization: 'algorithmic'
          }
        };
      }

      // STEP 5: Use Google Directions API for complex routes
      console.log(`🛣️ [ENHANCED-DIRECTIONS] Using Google Directions API for complex route`);
      
      const directionsResponse = await this.callGoogleDirectionsAPI(coordinates);

      if (directionsResponse.success) {
        // Cache successful response
        this.routeCache.set(routeHash, {
          coordinates: coordinates,
          response: {
            ...directionsResponse,
            routingDecision
          },
          timestamp: new Date(),
          routeHash
        });
        
        this.cleanupCache();

        console.log(`✅ [ENHANCED-DIRECTIONS] Directions API successful - ${directionsResponse.totalDistance.toFixed(2)}km route`);
        
        return {
          ...directionsResponse,
          routingDecision
        };
      }

      // If Directions API failed, return fallback
      console.warn(`⚠️ [ENHANCED-DIRECTIONS] Directions API failed, using coordinate path fallback`);
      
      return {
        success: true,
        decodedPath: coordinates.map(coord => ({
          lat: coord.latitude,
          lng: coord.longitude
        })),
        totalDistance: routingDecision.movementDistance,
        totalDuration: Math.max(1, routingDecision.movementDistance * 2),
        method: 'directions_api_fallback',
        apiCallsMade: 1,
        cacheHit: false,
        routingDecision,
        error: directionsResponse.error,
        debugInfo: {
          originalPoints: coordinates.length,
          optimizedWaypoints: 0,
          skippedDueToIntelligence: false,
          waypointOptimization: 'fallback'
        }
      };

    } catch (error) {
      console.error(`❌ [ENHANCED-DIRECTIONS] Error in directions processing:`, error);
      
      return {
        success: false,
        decodedPath: [],
        totalDistance: 0,
        totalDuration: 0,
        method: 'error',
        apiCallsMade: 0,
        cacheHit: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        debugInfo: {
          originalPoints: coordinates.length,
          optimizedWaypoints: 0,
          skippedDueToIntelligence: false,
          waypointOptimization: 'error'
        }
      };
    }
  }

  /**
   * Call the actual Google Directions API
   */
  private async callGoogleDirectionsAPI(coordinates: Coordinate[]): Promise<DirectionsAPIResponse> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    if (coordinates.length < 2) {
      return {
        success: false,
        decodedPath: [],
        totalDistance: 0,
        totalDuration: 0,
        method: 'insufficient_points',
        apiCallsMade: 0,
        cacheHit: false,
        error: 'Insufficient coordinates for routing'
      };
    }

    try {
      // Optimize waypoints for Directions API
      const optimized = this.optimizeWaypointsForDirections(coordinates);
      
      console.log(`🔧 [ENHANCED-DIRECTIONS] Optimized ${coordinates.length} points to ${optimized.waypoints.length} waypoints using ${optimized.optimization}`);

      // Build the Directions API URL
      const origin = `${optimized.origin.latitude},${optimized.origin.longitude}`;
      const destination = `${optimized.destination.latitude},${optimized.destination.longitude}`;
      
      let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&key=${apiKey}`;
      
      // Add waypoints if any
      if (optimized.waypoints.length > 0) {
        const waypointsStr = optimized.waypoints
          .map(wp => `${wp.latitude},${wp.longitude}`)
          .join('|');
        url += `&waypoints=${encodeURIComponent(waypointsStr)}`;
      }

      // Add parameters for better routing
      url += '&mode=driving&avoid=tolls&region=IN&language=en';

      console.log(`🌐 [ENHANCED-DIRECTIONS] Calling Google Directions API...`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Google Directions API HTTP error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== 'OK') {
        throw new Error(`Google Directions API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
      }

      if (!data.routes || data.routes.length === 0) {
        throw new Error('No routes found');
      }

      const route = data.routes[0];
      
      // Calculate totals
      let totalDistance = 0; // in meters
      let totalDuration = 0; // in seconds
      
      route.legs.forEach((leg: { distance: { value: number }; duration: { value: number } }) => {
        totalDistance += leg.distance.value;
        totalDuration += leg.duration.value;
      });

      // Decode the overview polyline for the route path
      const decodedPath = this.decodePolyline(route.overview_polyline.points);

      console.log(`✅ [ENHANCED-DIRECTIONS] Google Directions API returned route with ${decodedPath.length} points`);

      return {
        success: true,
        route,
        decodedPath,
        totalDistance: totalDistance / 1000, // Convert to kilometers
        totalDuration: totalDuration / 60, // Convert to minutes
        method: 'google_directions_api',
        apiCallsMade: 1,
        cacheHit: false,
        debugInfo: {
          originalPoints: coordinates.length,
          optimizedWaypoints: optimized.waypoints.length,
          skippedDueToIntelligence: false,
          waypointOptimization: optimized.optimization
        }
      };

    } catch (error) {
      console.error('Google Directions API call failed:', error);
      
      return {
        success: false,
        decodedPath: [],
        totalDistance: 0,
        totalDuration: 0,
        method: 'google_directions_api_failed',
        apiCallsMade: 1,
        cacheHit: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  } {
    if (this.routeCache.size === 0) {
      return { size: 0 };
    }

    const entries = Array.from(this.routeCache.values());
    const timestamps = entries.map(e => e.timestamp);
    
    return {
      size: this.routeCache.size,
      oldestEntry: new Date(Math.min(...timestamps.map(t => t.getTime()))),
      newestEntry: new Date(Math.max(...timestamps.map(t => t.getTime())))
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.routeCache.clear();
    console.log('🧹 [ENHANCED-DIRECTIONS] Cache cleared');
  }
}

// Export singleton instance
export const enhancedDirectionsAPI = new EnhancedDirectionsAPI();

/**
 * Convenience function for enhanced directions API processing
 */
export async function processRouteWithEnhancedDirections(coordinates: Coordinate[]): Promise<DirectionsAPIResponse> {
  return await enhancedDirectionsAPI.getDirectionsRoute(coordinates);
}