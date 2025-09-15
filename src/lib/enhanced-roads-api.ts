/**
 * Enhanced Google Maps Roads API Integration
 * 
 * This module provides intelligent Google Maps Roads API usage that:
 * - Uses movement analysis to determine when Roads API is needed
 * - Optimizes API calls by reducing unnecessary requests
 * - Handles return journeys and route caching intelligently
 * - Provides fallback options when Roads API fails
 */

import { Coordinate } from './gps-utils';
import { 
  getIntelligentRoutingDecision, 
  getOptimizedCoordinatesForRoadsAPI,
  detectSimilarRoute,
  RouteAnalysis 
} from './intelligent-routing';

export interface RoadsAPIResponse {
  success: boolean;
  snappedPoints: Array<{
    location: {
      latitude: number;
      longitude: number;
    };
    originalIndex?: number;
    placeId?: string;
  }>;
  optimizedRoute?: Coordinate[];
  method: string;
  apiCallsMade: number;
  cacheHit: boolean;
  routingDecision?: RouteAnalysis;
  error?: string;
  debugInfo?: {
    originalPoints: number;
    processedPoints: number;
    skippedDueToIntelligence: boolean;
    reasonsSkipped?: string[];
  };
}

// Route cache for return journey optimization
interface RouteCache {
  coordinates: Coordinate[];
  response: RoadsAPIResponse;
  timestamp: Date;
  routeHash: string;
}

class EnhancedRoadsAPI {
  private routeCache = new Map<string, RouteCache>();
  private readonly CACHE_EXPIRY_HOURS = 24;
  private readonly MAX_CACHE_SIZE = 100;

  /**
   * Generate a hash for route caching
   */
  private generateRouteHash(coordinates: Coordinate[]): string {
    const start = coordinates[0];
    const end = coordinates[coordinates.length - 1];
    const simplified = `${start.latitude.toFixed(4)},${start.longitude.toFixed(4)}-${end.latitude.toFixed(4)},${end.longitude.toFixed(4)}-${coordinates.length}`;
    return Buffer.from(simplified).toString('base64').slice(0, 16);
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
    validEntries
      .sort((a, b) => b[1].timestamp.getTime() - a[1].timestamp.getTime())
      .slice(0, this.MAX_CACHE_SIZE)
      .forEach(([key, cache]) => {
        this.routeCache.set(key, cache);
      });
  }

  /**
   * Enhanced snap to roads with intelligent routing
   */
  async snapToRoads(coordinates: Coordinate[]): Promise<RoadsAPIResponse> {
    console.log(`🚗 [ENHANCED-ROADS-API] Processing ${coordinates.length} coordinates...`);

    try {
      // STEP 1: Apply intelligent routing analysis
      const routingDecision = getIntelligentRoutingDecision(coordinates);
      
      // If intelligence says skip routing entirely
      if (routingDecision.recommendations.skipRouting) {
        console.log(`⏭️ [ENHANCED-ROADS-API] Skipping Roads API - ${routingDecision.reasoning.join(', ')}`);
        
        return {
          success: true,
          snappedPoints: coordinates.map((coord, index) => ({
            location: {
              latitude: coord.latitude,
              longitude: coord.longitude
            },
            originalIndex: index
          })),
          optimizedRoute: coordinates,
          method: 'skipped_static_location',
          apiCallsMade: 0,
          cacheHit: false,
          routingDecision,
          debugInfo: {
            originalPoints: coordinates.length,
            processedPoints: coordinates.length,
            skippedDueToIntelligence: true,
            reasonsSkipped: routingDecision.reasoning
          }
        };
      }

      // If intelligence recommends algorithmic routing instead
      if (routingDecision.recommendations.useAlgorithmic) {
        console.log(`🔧 [ENHANCED-ROADS-API] Using algorithmic routing instead of Roads API - ${routingDecision.reasoning.join(', ')}`);
        
        return {
          success: true,
          snappedPoints: coordinates.map((coord, index) => ({
            location: {
              latitude: coord.latitude,
              longitude: coord.longitude
            },
            originalIndex: index
          })),
          optimizedRoute: coordinates,
          method: 'algorithmic_recommended',
          apiCallsMade: 0,
          cacheHit: false,
          routingDecision,
          debugInfo: {
            originalPoints: coordinates.length,
            processedPoints: coordinates.length,
            skippedDueToIntelligence: true,
            reasonsSkipped: routingDecision.reasoning
          }
        };
      }

      // STEP 2: Check cache for similar routes
      const routeHash = this.generateRouteHash(coordinates);
      const cachedRoute = this.routeCache.get(routeHash);
      
      if (cachedRoute && this.isCacheValid(cachedRoute)) {
        console.log(`📦 [ENHANCED-ROADS-API] Cache hit for route ${routeHash}`);
        
        return {
          ...cachedRoute.response,
          cacheHit: true,
          debugInfo: {
            originalPoints: cachedRoute.response.debugInfo?.originalPoints || coordinates.length,
            processedPoints: cachedRoute.response.debugInfo?.processedPoints || coordinates.length,
            skippedDueToIntelligence: false,
            reasonsSkipped: cachedRoute.response.debugInfo?.reasonsSkipped
          }
        };
      }

      // Check for reverse/similar journey
      const cachedRoutes = Array.from(this.routeCache.values()).map(cache => ({
        coordinates: cache.coordinates,
        route: cache.response
      }));

      if (detectSimilarRoute(coordinates, cachedRoutes)) {
        console.log(`🔄 [ENHANCED-ROADS-API] Similar route detected - using optimized processing`);
        // We could reverse a cached route here, but for now we'll continue with API call
      }

      // STEP 3: Optimize coordinates for Roads API
      const optimizedCoords = getOptimizedCoordinatesForRoadsAPI(coordinates, 23); // Leave room for Roads API limits
      console.log(`🔧 [ENHANCED-ROADS-API] Optimized coordinates: ${coordinates.length} → ${optimizedCoords.length}`);

      // STEP 4: Call Google Roads API
      const roadsResponse = await this.callGoogleRoadsAPI(optimizedCoords);

      if (roadsResponse.success) {
        // Cache successful response
        this.routeCache.set(routeHash, {
          coordinates: coordinates,
          response: {
            ...roadsResponse,
            routingDecision
          },
          timestamp: new Date(),
          routeHash
        });
        
        this.cleanupCache();

        console.log(`✅ [ENHANCED-ROADS-API] Roads API successful: ${roadsResponse.snappedPoints.length} points snapped`);
        
        return {
          ...roadsResponse,
          routingDecision,
          debugInfo: {
            originalPoints: coordinates.length,
            processedPoints: optimizedCoords.length,
            skippedDueToIntelligence: false
          }
        };
      }

      // If Roads API failed, return fallback
      console.warn(`⚠️ [ENHANCED-ROADS-API] Roads API failed, using fallback`);
      
      return {
        success: true,
        snappedPoints: coordinates.map((coord, index) => ({
          location: {
            latitude: coord.latitude,
            longitude: coord.longitude
          },
          originalIndex: index
        })),
        optimizedRoute: coordinates,
        method: 'roads_api_fallback',
        apiCallsMade: 1,
        cacheHit: false,
        routingDecision,
        error: roadsResponse.error,
        debugInfo: {
          originalPoints: coordinates.length,
          processedPoints: coordinates.length,
          skippedDueToIntelligence: false
        }
      };

    } catch (error) {
      console.error(`❌ [ENHANCED-ROADS-API] Error in enhanced roads processing:`, error);
      
      return {
        success: false,
        snappedPoints: [],
        method: 'error',
        apiCallsMade: 0,
        cacheHit: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        debugInfo: {
          originalPoints: coordinates.length,
          processedPoints: 0,
          skippedDueToIntelligence: false
        }
      };
    }
  }

  /**
   * Call the actual Google Roads API
   */
  private async callGoogleRoadsAPI(coordinates: Coordinate[]): Promise<RoadsAPIResponse> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    if (coordinates.length < 2) {
      return {
        success: true,
        snappedPoints: [],
        method: 'insufficient_points',
        apiCallsMade: 0,
        cacheHit: false
      };
    }

    try {
      // Convert coordinates to Google Roads API format
      const pathString = coordinates
        .map(coord => `${coord.latitude},${coord.longitude}`)
        .join('|');

      const url = `https://roads.googleapis.com/v1/snapToRoads?path=${encodeURIComponent(pathString)}&interpolate=true&key=${apiKey}`;
      
      console.log(`🌐 [ENHANCED-ROADS-API] Calling Google Roads API with ${coordinates.length} points...`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Google Roads API HTTP error: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`Google Roads API error: ${data.error.message}`);
      }

      const snappedPoints = data.snappedPoints || [];
      console.log(`✅ [ENHANCED-ROADS-API] Google Roads API returned ${snappedPoints.length} snapped points`);

      // Convert snapped points back to our coordinate format
      const optimizedRoute: Coordinate[] = snappedPoints.map((point: {
        location: { latitude: number; longitude: number };
        originalIndex?: number;
      }) => ({
        latitude: point.location.latitude,
        longitude: point.location.longitude
      }));

      return {
        success: true,
        snappedPoints,
        optimizedRoute,
        method: 'google_roads_api',
        apiCallsMade: 1,
        cacheHit: false
      };

    } catch (error) {
      console.error('Google Roads API call failed:', error);
      
      return {
        success: false,
        snappedPoints: [],
        method: 'google_roads_api_failed',
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
    hitRate?: number;
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
   * Clear cache (useful for testing or memory management)
   */
  clearCache(): void {
    this.routeCache.clear();
    console.log('🧹 [ENHANCED-ROADS-API] Cache cleared');
  }
}

// Export singleton instance
export const enhancedRoadsAPI = new EnhancedRoadsAPI();

/**
 * Convenience function for enhanced roads API processing
 */
export async function processRouteWithEnhancedRoads(coordinates: Coordinate[]): Promise<RoadsAPIResponse> {
  return await enhancedRoadsAPI.snapToRoads(coordinates);
}

/**
 * Batch process multiple routes efficiently
 */
export async function batchProcessRoutes(routes: { id: string; coordinates: Coordinate[] }[]): Promise<Map<string, RoadsAPIResponse>> {
  const results = new Map<string, RoadsAPIResponse>();
  
  console.log(`📋 [ENHANCED-ROADS-API] Batch processing ${routes.length} routes...`);
  
  // Process routes with a small delay to respect API rate limits
  for (const route of routes) {
    const result = await enhancedRoadsAPI.snapToRoads(route.coordinates);
    results.set(route.id, result);
    
    // Small delay between requests (100ms)
    if (routes.indexOf(route) < routes.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`✅ [ENHANCED-ROADS-API] Batch processing complete: ${results.size} routes processed`);
  
  return results;
}