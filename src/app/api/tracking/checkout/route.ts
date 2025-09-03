import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sanitizeCoordinate, validateSessionData } from '@/lib/gps-validation';
import { calculateTotalDistance, calculateTotalDistanceWithGoogle, calculateTotalRouteWithGoogle } from '@/lib/gps-utils';
import { getAuthenticatedUser, errorResponse } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user (supports both JWT and session)
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    // Parse request body
    const body = await request.json();
    
    // Find the active session to check out
    const sessionId = body.sessionId;
    const checkOut = new Date(body.checkOut || new Date());
    const endCoord = sanitizeCoordinate({
      latitude: body.latitude,
      longitude: body.longitude,
      accuracy: body.accuracy
    });

    // Validate required fields
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required for check-out' },
        { status: 400 }
      );
    }

    // Find the session to check out
    const gpsSession = await prisma.gPSSession.findUnique({
      where: { id: sessionId },
      include: {
        gpsLogs: {
          orderBy: { timestamp: 'asc' }
        }
      }
    });

    if (!gpsSession) {
      return NextResponse.json(
        { error: 'GPS session not found' },
        { status: 404 }
      );
    }

    // Verify session ownership
    if (gpsSession.userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized - not your session' },
        { status: 403 }
      );
    }

    // Check if session is already closed
    if (gpsSession.checkOut) {
      return NextResponse.json(
        { 
          error: 'Session already checked out',
          checkOut: gpsSession.checkOut,
          totalKm: gpsSession.totalKm
        },
        { status: 400 }
      );
    }

    // Validate checkout data
    const sessionData = {
      userId: user.id,
      checkIn: gpsSession.checkIn,
      checkOut: checkOut,
      endLat: endCoord?.latitude,
      endLng: endCoord?.longitude
    };

    const validation = validateSessionData(sessionData);
    
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validation.errors
        },
        { status: 400 }
      );
    }

    // Calculate total distance from GPS logs using Google Routes API with traffic awareness
    let totalKm = 0;
    let calculationMethod = 'haversine';
    let calculationError: string | undefined;
    let routePolyline: string | undefined;
    let trafficDuration: number | undefined;
    let staticDuration: number | undefined;

    if (gpsSession.gpsLogs.length > 1) {
      const coordinates = gpsSession.gpsLogs.map(log => ({
        latitude: log.latitude,
        longitude: log.longitude,
        timestamp: log.timestamp
      }));
      
      try {
        // Use Google Routes API for most accurate road-based distance with traffic awareness
        const result = await calculateTotalRouteWithGoogle(coordinates, 'DRIVE', {
          routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
          avoidTolls: false, // Allow tolls for field workers
          avoidHighways: false, // Allow highways for efficiency
          avoidFerries: true, // Avoid ferries for reliability
          maxWaypoints: 10 // Conservative limit
        });
        
        totalKm = result.distance;
        calculationMethod = result.method;
        calculationError = result.error;
        routePolyline = result.polyline;
        trafficDuration = result.duration;
        staticDuration = result.staticDuration;
        
        console.log(`Distance calculated using ${result.method}: ${totalKm}km, ${trafficDuration}min (${staticDuration}min without traffic)`);
        
        if (result.warnings && result.warnings.length > 0) {
          console.warn('Route calculation warnings:', result.warnings);
        }
      } catch (error) {
        console.warn('Failed to calculate route with Google Routes API, trying Distance Matrix fallback:', error);
        
        try {
          // Fallback to Distance Matrix API
          const distanceResult = await calculateTotalDistanceWithGoogle(coordinates, 'driving');
          totalKm = distanceResult.distance;
          calculationMethod = distanceResult.method;
          calculationError = distanceResult.error;
          trafficDuration = distanceResult.duration;
          
          console.log(`Distance calculated using fallback ${distanceResult.method}: ${totalKm}km`);
        } catch (fallbackError) {
          console.warn('Failed to calculate distance with Distance Matrix API, using Haversine fallback:', fallbackError);
          totalKm = calculateTotalDistance(coordinates);
          calculationMethod = 'haversine';
          calculationError = error instanceof Error ? error.message : 'Unknown error';
        }
      }
    }

    // Add final coordinate if provided
    if (endCoord) {
      await prisma.gPSLog.create({
        data: {
          sessionId: gpsSession.id,
          latitude: endCoord.latitude,
          longitude: endCoord.longitude,
          timestamp: checkOut,
          accuracy: endCoord.accuracy,
          speed: endCoord.speed,
          altitude: endCoord.altitude
        }
      });

      // Recalculate distance including the final coordinate
      if (gpsSession.gpsLogs.length > 0) {
        const lastCoord = {
          latitude: gpsSession.gpsLogs[gpsSession.gpsLogs.length - 1].latitude,
          longitude: gpsSession.gpsLogs[gpsSession.gpsLogs.length - 1].longitude
        };
        
        try {
          // Use Google Routes API for final segment if available
          const finalResult = await calculateTotalRouteWithGoogle([lastCoord, endCoord], 'DRIVE', {
            routingPreference: 'TRAFFIC_AWARE_OPTIMAL'
          });
          totalKm += finalResult.distance;
          
          // Update durations if we got them
          if (finalResult.duration) {
            trafficDuration = (trafficDuration || 0) + finalResult.duration;
          }
          if (finalResult.staticDuration) {
            staticDuration = (staticDuration || 0) + finalResult.staticDuration;
          }
          
          console.log(`Final segment calculated using ${finalResult.method}: ${finalResult.distance}km`);
        } catch (error) {
          console.warn('Failed to calculate final segment with Google Routes API, using Haversine:', error);
          const finalDistance = calculateTotalDistance([lastCoord, endCoord]);
          totalKm += finalDistance;
        }
      }
    }

    // Update the session with check-out data
    const updatedSession = await prisma.gPSSession.update({
      where: { id: sessionId },
      data: {
        checkOut,
        endLat: endCoord?.latitude,
        endLng: endCoord?.longitude,
        totalKm
      }
    });

    // Calculate session stats
    const sessionDuration = (checkOut.getTime() - gpsSession.checkIn.getTime()) / (1000 * 60 * 60); // hours
    const avgSpeed = sessionDuration > 0 ? totalKm / sessionDuration : 0;

    // Update daily summary
    const today = new Date(checkOut);
    today.setHours(0, 0, 0, 0);

    try {
      await prisma.dailySummary.upsert({
        where: {
          mrId_date: {
            mrId: user.id,
            date: today
          }
        },
        update: {
          totalKms: {
            increment: totalKm
          },
          totalHours: {
            increment: sessionDuration
          },
          checkInCount: {
            increment: 1
          }
        },
        create: {
          mrId: user.id,
          date: today,
          totalKms: totalKm,
          totalHours: sessionDuration,
          checkInCount: 1,
          totalVisits: 0,
          totalBusiness: 0
        }
      });
    } catch {
      // Log error but don't fail the checkout
    }

    // Prepare response with enhanced Routes API data
    const response = {
      sessionId: updatedSession.id,
      checkOut: updatedSession.checkOut,
      totalKm: Math.round(totalKm * 1000) / 1000,
      duration: Math.round(sessionDuration * 100) / 100, // hours
      avgSpeed: Math.round(avgSpeed * 100) / 100, // km/h
      coordinateCount: gpsSession.gpsLogs.length + (endCoord ? 1 : 0),
      distanceCalculationMethod: calculationMethod,
      status: 'completed',
      message: 'Check-out successful',
      // Enhanced Routes API data
      ...(trafficDuration && { 
        estimatedTravelTime: Math.round(trafficDuration * 100) / 100 // minutes
      }),
      ...(staticDuration && { 
        baselineTravelTime: Math.round(staticDuration * 100) / 100 // minutes
      }),
      ...(routePolyline && { 
        routePolyline: routePolyline // For map visualization
      })
    };

    // Add warnings if any
    const allWarnings = [...validation.warnings];
    if (calculationError) {
      allWarnings.push(`Distance calculation note: ${calculationError}`);
    }
    
    if (allWarnings.length > 0) {
      (response as Record<string, unknown>).warnings = allWarnings;
    }

    // Add location data if available
    if (gpsSession.startLat && gpsSession.startLng) {
      (response as Record<string, unknown>).startLocation = {
        latitude: gpsSession.startLat,
        longitude: gpsSession.startLng
      };
    }

    if (endCoord) {
      (response as Record<string, unknown>).endLocation = {
        latitude: endCoord.latitude,
        longitude: endCoord.longitude
      };
    }

    return NextResponse.json(response, { status: 200 });

  } catch {
  // console.error('GPS check-out error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to process GPS check-out'
      },
      { status: 500 }
    );
  }
}

// PATCH method to force close session (admin/emergency)
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const body = await request.json();
    const { sessionId, reason } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Find the session
    const gpsSession = await prisma.gPSSession.findUnique({
      where: { id: sessionId },
      include: {
        user: true,
        gpsLogs: true
      }
    });

    if (!gpsSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Check permissions - user can close own session, or admin can close any
    const canClose = gpsSession.userId === user.id || 
                    user.role === 'ADMIN' || 
                    user.role === 'LEAD_MR';

    if (!canClose) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Calculate distance from existing logs
    let totalKm = 0;
    if (gpsSession.gpsLogs.length > 1) {
      const coordinates = gpsSession.gpsLogs.map(log => ({
        latitude: log.latitude,
        longitude: log.longitude
      }));
      totalKm = calculateTotalDistance(coordinates);
    }

    // Force close the session
    const checkOut = new Date();
    const updatedSession = await prisma.gPSSession.update({
      where: { id: sessionId },
      data: {
        checkOut,
        totalKm
      }
    });

    // Log the forced closure
  // console.log(`Session ${sessionId} force-closed by ${user.id}. Reason: ${reason || 'Not specified'}`);

    return NextResponse.json({
      sessionId: updatedSession.id,
      checkOut: updatedSession.checkOut,
      totalKm: Math.round(totalKm * 1000) / 1000,
      status: 'force_closed',
      reason: reason || 'Force closed',
      closedBy: user.id
    });

  } catch {
  // console.error('Force close session error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to force close session'
      },
      { status: 500 }
    );
  }
}
