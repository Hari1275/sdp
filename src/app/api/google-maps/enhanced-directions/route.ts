import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, errorResponse } from '@/lib/api-utils';
import { processRouteWithEnhancedDirections } from '@/lib/enhanced-directions-api';
import { Coordinate } from '@/lib/gps-utils';

export async function POST(request: NextRequest) {
  try {
    // Authentication required for API usage tracking and security
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { coordinates } = await request.json();

    // Validate input
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid coordinates data. Array of coordinates is required.' 
        },
        { status: 400 }
      );
    }

    // Validate coordinate format
    const isValidCoordinate = (coord: unknown): coord is Coordinate => {
      return (
        coord !== null &&
        typeof coord === 'object' &&
        'latitude' in coord &&
        'longitude' in coord &&
        typeof (coord as { latitude: unknown }).latitude === 'number' &&
        typeof (coord as { longitude: unknown }).longitude === 'number' &&
        Math.abs((coord as { latitude: number }).latitude) <= 90 &&
        Math.abs((coord as { longitude: number }).longitude) <= 180
      );
    };

    const validatedCoordinates = coordinates.filter(isValidCoordinate);
    
    if (validatedCoordinates.length === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'No valid coordinates provided. Each coordinate must have latitude and longitude properties.' 
        },
        { status: 400 }
      );
    }

    if (validatedCoordinates.length !== coordinates.length) {
      console.warn(`⚠️ [ENHANCED-DIRECTIONS-API] Filtered out ${coordinates.length - validatedCoordinates.length} invalid coordinates`);
    }

    console.log(`🗺️ [ENHANCED-DIRECTIONS-API] Processing ${validatedCoordinates.length} coordinates for user ${user.id}...`);

    // Process with enhanced Directions API
    const result = await processRouteWithEnhancedDirections(validatedCoordinates);

    // Log the result for debugging
    if (result.debugInfo?.skippedDueToIntelligence) {
      console.log(`⏭️ [ENHANCED-DIRECTIONS-API] Intelligent routing decision: ${result.debugInfo.reasonsSkipped?.join(', ')}`);
    } else {
      console.log(`✅ [ENHANCED-DIRECTIONS-API] Route processing complete using ${result.method}`);
      if (result.decodedPath) {
        console.log(`   🗺️ Generated route with ${result.decodedPath.length} path points`);
      }
    }

    return NextResponse.json({
      ...result,
      processedAt: new Date().toISOString(),
      userId: user.id
    });

  } catch (error) {
    console.error('❌ [ENHANCED-DIRECTIONS-API] Route processing failed:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process route with enhanced Directions API',
        message: error instanceof Error ? error.message : 'Unknown error',
        method: 'error'
      },
      { status: 500 }
    );
  }
}

// GET method for API documentation and testing
export async function GET() {
  return NextResponse.json({
    name: 'Enhanced Google Directions API',
    description: 'Intelligent road-following route processing with movement analysis and optimal API usage',
    usage: 'POST with coordinates array: [{ latitude: number, longitude: number, timestamp?: string }]',
    features: [
      'Road-following routes using Google Directions API',
      'Intelligent routing decisions based on movement patterns',
      'Static location detection to avoid unnecessary API calls', 
      'Return journey optimization with route caching',
      'Smart waypoint optimization for API efficiency',
      'Coordinate limit handling (max 25 waypoints per request)',
      'Polyline decoding for smooth route visualization'
    ],
    limits: {
      maxCoordinatesPerRequest: 1000,
      maxWaypointsPerDirectionsCall: 23,
      minCoordinatesForAnalysis: 2,
      authenticationRequired: true
    },
    example: {
      request: {
        coordinates: [
          { latitude: 28.6139, longitude: 77.2090 }, // New Delhi
          { latitude: 28.6129, longitude: 77.2295 }, // India Gate
          { latitude: 28.5535, longitude: 77.2588 }  // Lotus Temple
        ]
      },
      response: {
        success: true,
        decodedPath: '... array of lat/lng points following roads ...',
        totalDistance: 12.5, // kilometers
        totalDuration: 45, // minutes
        method: 'google_directions_api | algorithmic_recommended | skipped_static_location',
        apiCallsMade: 1,
        cacheHit: false,
        routingDecision: {
          shouldUseRoadsAPI: true,
          isStaticLocation: false,
          routeComplexity: 'moderate',
          confidenceLevel: 85,
          reasoning: ['Route complexity warrants Directions API usage']
        },
        debugInfo: {
          originalPoints: 3,
          optimizedWaypoints: 1,
          skippedDueToIntelligence: false,
          waypointOptimization: 'all_points'
        }
      }
    }
  });
}