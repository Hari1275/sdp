import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sanitizeCoordinate, validateSessionData } from '@/lib/gps-validation';
import { calculateTotalDistance } from '@/lib/gps-utils';
import { calculateGodLevelRoute } from '@/lib/advanced-gps-engine';
import { getAuthenticatedUser, errorResponse } from '@/lib/api-utils';

// Efficient distance calculation using Google Directions API with batching
async function calculateDistanceWithDirections(coordinates: Array<{ latitude: number; longitude: number; timestamp?: Date }>): Promise<number> {
  if (coordinates.length < 2) return 0;
  
  let totalDistance = 0;
  const batchSize = 23; // Google Directions allows max 25 waypoints (origin + 23 waypoints + destination)
  
  for (let i = 0; i < coordinates.length - 1; i += batchSize) {
    const batch = coordinates.slice(i, Math.min(i + batchSize + 1, coordinates.length));
    
    if (batch.length < 2) continue;
    
    try {
      // Use Google Directions API for accurate road-based distance
      const response = await fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${batch[0].latitude},${batch[0].longitude}&destination=${batch[batch.length - 1].latitude},${batch[batch.length - 1].longitude}${batch.length > 2 ? '&waypoints=' + batch.slice(1, -1).map(c => `${c.latitude},${c.longitude}`).join('|') : ''}&key=${process.env.GOOGLE_MAPS_API_KEY}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'OK' && data.routes.length > 0) {
          const route = data.routes[0];
          const distanceInMeters = route.legs.reduce((sum: number, leg: any) => sum + leg.distance.value, 0);
          totalDistance += distanceInMeters / 1000; // Convert to kilometers
          continue;
        }
      }
      
      // Fallback to Haversine calculation for this batch
      console.warn('Google Directions failed for batch, using Haversine fallback');
      totalDistance += calculateTotalDistance(batch);
      
    } catch (error) {
      console.warn('Error in Google Directions batch, using Haversine fallback:', error);
      totalDistance += calculateTotalDistance(batch);
    }
  }
  
  return totalDistance;
}

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

    // Calculate total distance using efficient Google Directions API batching
    let totalKm = 0;
    let calculationMethod = 'google_directions';
    let calculationError: string | undefined;

    if (gpsSession.gpsLogs.length > 1) {
      const coordinates = gpsSession.gpsLogs.map(log => ({
        latitude: log.latitude,
        longitude: log.longitude,
        timestamp: log.timestamp
      }));
      
      try {
        console.log(`🗺️ Calculating distance using Google Directions API for ${coordinates.length} GPS points...`);
        
        // Use efficient batching for Google Directions API (max 25 waypoints per request)
        totalKm = await calculateDistanceWithDirections(coordinates);
        
        console.log(`✅ Distance calculated: ${totalKm.toFixed(3)}km using ${calculationMethod}`);
        
      } catch (error) {
        console.warn('🔄 Google Directions failed, using Haversine fallback:', error);
        
        // Fallback to Haversine calculation
        totalKm = calculateTotalDistance(coordinates);
        calculationMethod = 'haversine_fallback';
        calculationError = error instanceof Error ? error.message : 'Unknown error';
        
        console.log(`✅ Haversine fallback calculated: ${totalKm.toFixed(3)}km`);
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

      // Add final distance from last GPS point to checkout location
      if (gpsSession.gpsLogs.length > 0) {
        const lastCoord = {
          latitude: gpsSession.gpsLogs[gpsSession.gpsLogs.length - 1].latitude,
          longitude: gpsSession.gpsLogs[gpsSession.gpsLogs.length - 1].longitude
        };
        
        const finalDistance = calculateTotalDistance([lastCoord, endCoord]);
        totalKm += finalDistance;
        
        console.log(`🏁 Final segment distance: ${finalDistance.toFixed(3)}km`);
      }
    }

    // Update the session with distance and checkout data
    const updatedSession = await prisma.gPSSession.update({
      where: { id: sessionId },
      data: {
        checkOut,
        endLat: endCoord?.latitude,
        endLng: endCoord?.longitude,
        totalKm,
        calculationMethod
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

    // Prepare checkout response
    const response = {
      sessionId: updatedSession.id,
      checkOut: updatedSession.checkOut,
      totalKm: Math.round(totalKm * 1000) / 1000,
      duration: Math.round(sessionDuration * 100) / 100, // hours
      avgSpeed: Math.round(avgSpeed * 100) / 100, // km/h
      coordinateCount: gpsSession.gpsLogs.length + (endCoord ? 1 : 0),
      distanceCalculationMethod: calculationMethod,
      status: 'completed',
      message: 'Check-out successful'
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
