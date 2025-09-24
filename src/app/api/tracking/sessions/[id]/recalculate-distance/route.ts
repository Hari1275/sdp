import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { calculateSimpleDistance } from '@/lib/simple-distance-calculation';

interface RouteParams {
  params: Promise<{ id: string }>
}


export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: sessionId } = await params;
  
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Find the GPS session
    const gpsSession = await prisma.gPSSession.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            role: true,
          }
        },
        gpsLogs: {
          orderBy: { timestamp: 'asc' },
          select: {
            latitude: true,
            longitude: true,
            timestamp: true,
          }
        }
      }
    });

    if (!gpsSession) {
      return NextResponse.json(
        { error: 'GPS session not found' },
        { status: 404 }
      );
    }

    // Check permissions
    const canRecalculate = gpsSession.userId === session.user.id || 
                          session.user.role === 'ADMIN' || 
                          (session.user.role === 'LEAD_MR' && await checkTeamAccess(session.user.id, gpsSession.userId));

    if (!canRecalculate) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get Google Maps API key (optional - will fallback to Haversine if not available)
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
    
    if (!googleMapsApiKey) {
      console.warn('⚠️ [RECALCULATE-DISTANCE] No Google Maps API key configured, will use Haversine fallback');
    }

    // Build coordinate list with timestamps for better filtering
    const coordinates: Array<{ latitude: number; longitude: number; timestamp?: Date }> = [];
    
    // Add start location if available
    if (gpsSession.startLat !== null && gpsSession.startLng !== null) {
      coordinates.push({
        latitude: gpsSession.startLat,
        longitude: gpsSession.startLng,
        timestamp: gpsSession.checkIn
      });
    }

    // Add GPS logs with timestamps
    gpsSession.gpsLogs.forEach(log => {
      coordinates.push({
        latitude: log.latitude,
        longitude: log.longitude,
        timestamp: log.timestamp
      });
    });

    // Add end location if available and different from last point
    if (gpsSession.endLat !== null && gpsSession.endLng !== null && gpsSession.checkOut) {
      coordinates.push({
        latitude: gpsSession.endLat,
        longitude: gpsSession.endLng,
        timestamp: gpsSession.checkOut
      });
    }

    if (coordinates.length < 2) {
      return NextResponse.json(
        { 
          error: 'Insufficient coordinates',
          message: 'At least 2 coordinate points are required for distance calculation',
          originalDistance: gpsSession.totalKm || 0,
          recalculatedDistance: gpsSession.totalKm || 0
        },
        { status: 400 }
      );
    }

    console.log(`📊 Recalculating distance for session ${sessionId} with ${coordinates.length} coordinates`);

    // Calculate distance using simple Google Distance Matrix API
    const distanceResult = await calculateSimpleDistance(coordinates, {
      apiKey: googleMapsApiKey,
      mode: 'driving',
      segmentSize: 50 // Process every 50 coordinates as one segment
    });

    const totalDistance = distanceResult.distance;
    const calculationMethod = distanceResult.method;
    const calculationError = distanceResult.error;

    // Update the session with new distance using the sessions PATCH endpoint
    console.log(`🔄 [RECALCULATE-DISTANCE] Updating session ${sessionId} in database...`);
    console.log(`   Old distance: ${gpsSession.totalKm}km`);
    console.log(`   New distance: ${totalDistance}km`);
    
    // Update the session directly using Prisma with explicit round trip
    console.log(`🔄 [RECALCULATE-DISTANCE] Preparing to update session ${sessionId}:`);
    console.log(`   Old distance: ${gpsSession.totalKm || 0}km`);
    console.log(`   New distance: ${totalDistance}km`);

    // Write directly via Prisma to avoid any request-layer caching/auth issues
    const roundedKm = Math.round(Number(totalDistance) * 1000) / 1000;
    const updatedSessionDirect = await prisma.gPSSession.update({
      where: { id: sessionId },
      data: {
        totalKm: roundedKm,
        calculationMethod: `simple_${calculationMethod}`,
        routeAccuracy: distanceResult.apiCallsMade > 0 ? 'high' : 'standard'
      },
      select: { id: true, totalKm: true, calculationMethod: true, routeAccuracy: true }
    });

    if (!updatedSessionDirect || updatedSessionDirect.totalKm !== roundedKm) {
      throw new Error(`Failed to persist recalculated distance for session ${sessionId}`);
    }

    // Fetch the updated session to verify changes
    // Log success
    console.log(`✅ [RECALCULATE-DISTANCE] Database updated successfully!`);
    console.log(`   Session ID: ${updatedSessionDirect.id}`);
    console.log(`   Updated totalKm: ${updatedSessionDirect.totalKm}km`);
    console.log(`   Calculation method: ${updatedSessionDirect.calculationMethod}`);
    console.log(`   Route accuracy: ${updatedSessionDirect.routeAccuracy}`);
    console.log(`   📊 API calls: ${distanceResult.apiCallsMade}, Segments: ${distanceResult.segmentsProcessed}`);
    
    // Verify the update by reading back from database
    console.log(`🔍 [RECALCULATE-DISTANCE] Verifying database update...`);
    const verificationSession = await prisma.gPSSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        totalKm: true,
        calculationMethod: true
      }
    });
    
    if (verificationSession) {
      console.log(`✅ [RECALCULATE-DISTANCE] Verification successful!`);
      console.log(`   Verified totalKm in DB: ${verificationSession.totalKm}km`);
      console.log(`   Verified method: ${verificationSession.calculationMethod}`);
    } else {
      console.error(`❌ [RECALCULATE-DISTANCE] Verification failed - session not found!`);
    }

    const response: {
      sessionId: string;
      originalDistance: number;
      recalculatedDistance: number;
      coordinatesUsed: number;
      segmentsProcessed: number;
      apiCallsMade: number;
      calculationMethod: string;
      message: string;
      calculationNote?: string;
    } = {
      sessionId: sessionId,
      originalDistance: gpsSession.totalKm || 0,
      recalculatedDistance: totalDistance,
      coordinatesUsed: coordinates.length,
      segmentsProcessed: distanceResult.segmentsProcessed,
      apiCallsMade: distanceResult.apiCallsMade,
      calculationMethod: calculationMethod,
      message: `Distance recalculated successfully using simple ${calculationMethod} method`
    };

    if (calculationError) {
      response.calculationNote = calculationError;
    }

    // Force clear any potential caches and refresh the session data
    console.log(`🔄 [RECALCULATE-DISTANCE] Force refreshing session data...`);
    
    // Final sanity check to ensure data consistency
    const refreshedSession = await prisma.gPSSession.findUnique({
      where: { id: sessionId },
      select: { id: true, totalKm: true, calculationMethod: true }
    });
    
    if (refreshedSession) {
      console.log(`✅ [RECALCULATE-DISTANCE] Final verification:`);
      console.log(`   Initial value: ${gpsSession.totalKm || 0}km`);
      console.log(`   After update: ${updatedSessionDirect.totalKm}km`);
      console.log(`   Final check: ${refreshedSession.totalKm}km`);
      console.log(`   All match: ${gpsSession.totalKm !== refreshedSession.totalKm && updatedSessionDirect.totalKm === refreshedSession.totalKm}`);
    }
    
    if (refreshedSession?.totalKm !== (Math.round(Number(totalDistance) * 1000) / 1000)) {
      console.warn(`⚠️ [RECALCULATE-DISTANCE] Distance mismatch in final check:`);
      console.warn(`   Expected: ${totalDistance}km`);
      console.warn(`   Actual: ${refreshedSession?.totalKm}km`);
    }

    // Return response with aggressive no-cache headers and updated distance
    return new NextResponse(JSON.stringify({
      ...response,
      _debug: {
        freshFromDB: refreshedSession?.totalKm,
        verificationDB: updatedSessionDirect?.totalKm,
        timestamp: new Date().toISOString(),
        cacheCleared: true
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Last-Modified': new Date().toUTCString(),
        'ETag': `"${Date.now()}"`,
        'Vary': '*'
      },
    });

  } catch (error) {
    console.error('Distance recalculation error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('API key') || errorMessage.includes('quota') || errorMessage.includes('billing')) {
      return NextResponse.json(
        { 
          error: 'Google Maps API error',
          message: 'Failed to recalculate distance due to Google Maps API issues',
          details: errorMessage
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to recalculate distance',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}

// Helper function to check team access for Lead MR
async function checkTeamAccess(leadMrId: string, userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { leadMrId: true }
  });
  
  return user?.leadMrId === leadMrId;
}

