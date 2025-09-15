import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, errorResponse } from '@/lib/api-utils';
import { processRouteWithEnhancedRoads } from '@/lib/enhanced-roads-api';
import { Coordinate } from '@/lib/gps-utils';

export async function POST(request: NextRequest) {
  try {
    // Authentication is optional for this utility endpoint but recommended for security
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
      console.warn(`⚠️ [ENHANCED-ROADS-API] Filtered out ${coordinates.length - validatedCoordinates.length} invalid coordinates`);
    }

    console.log(`🚗 [ENHANCED-ROADS-API] Processing ${validatedCoordinates.length} coordinates for user ${user.id}...`);

    // Process with enhanced Roads API
    const result = await processRouteWithEnhancedRoads(validatedCoordinates);

    // Log the result for debugging
    if (result.debugInfo?.skippedDueToIntelligence) {
      console.log(`⏭️ [ENHANCED-ROADS-API] Intelligent routing skipped Roads API: ${result.debugInfo.reasonsSkipped?.join(', ')}`);
    } else {
      console.log(`✅ [ENHANCED-ROADS-API] Route processing complete using ${result.method}`);
    }

    return NextResponse.json({
      ...result,
      processedAt: new Date().toISOString(),
      userId: user.id
    });

  } catch (error) {
    console.error('❌ [ENHANCED-ROADS-API] Route processing failed:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process route with enhanced Roads API',
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
    name: 'Enhanced Google Maps Roads API',
    description: 'Intelligent route processing with movement analysis and optimal API usage',
    usage: 'POST with coordinates array: [{ latitude: number, longitude: number, timestamp?: string }]',
    features: [
      'Intelligent routing decisions based on movement patterns',
      'Static location detection to avoid unnecessary API calls', 
      'Return journey optimization',
      'Route caching for similar journeys',
      'Automatic fallback to algorithmic routing when appropriate'
    ],
    limits: {
      maxCoordinatesPerRequest: 100,
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
        snappedPoints: '... road-snapped GPS points ...',
        optimizedRoute: '... optimized coordinate array ...',
        method: 'google_roads_api | algorithmic_recommended | skipped_static_location',
        apiCallsMade: 1,
        cacheHit: false,
        routingDecision: {
          shouldUseRoadsAPI: true,
          isStaticLocation: false,
          routeComplexity: 'moderate',
          confidenceLevel: 85,
          reasoning: ['Route complexity warrants Roads API usage']
        },
        debugInfo: {
          originalPoints: 3,
          processedPoints: 15,
          skippedDueToIntelligence: false
        }
      }
    }
  });
}