import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sanitizeCoordinate, validateSessionData } from '@/lib/gps-validation';
import { calculateTotalDistance } from '@/lib/gps-utils';
import { getAuthenticatedUser, errorResponse } from '@/lib/api-utils';
import { calculateSimpleDistance } from '@/lib/simple-distance-calculation';

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

    // Calculate total distance using simple Google Distance Matrix API
    let totalKm = 0;
    let calculationMethod = 'simple_distance_matrix';
    let calculationError: string | undefined;

    // Build coordinate list with timestamps
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

    // Add end coordinate if available
    if (endCoord) {
      coordinates.push({
        latitude: endCoord.latitude,
        longitude: endCoord.longitude,
        timestamp: checkOut
      });
    }

    if (coordinates.length > 1) {
      try {
        console.log(`🗺️ Calculating distance using simple Google Distance Matrix API for ${coordinates.length} GPS points...`);
        
        // Use simple segment-based distance calculation
        const distanceResult = await calculateSimpleDistance(coordinates, {
          apiKey: process.env.GOOGLE_MAPS_API_KEY,
          mode: 'driving',
          segmentSize: 50 // Process every 50 coordinates as one segment
        });
        
        totalKm = distanceResult.distance;
        calculationMethod = `simple_${distanceResult.method}`;
        
        if (distanceResult.error) {
          calculationError = distanceResult.error;
        }
        
        console.log(`✅ Distance calculated: ${totalKm.toFixed(3)}km using ${calculationMethod}`);
        console.log(`   📊 Processed ${distanceResult.segmentsProcessed} segments with ${distanceResult.apiCallsMade} API calls`);
        
      } catch (error) {
        console.warn('🔄 Simple distance calculation failed, using Haversine fallback:', error);
        
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
    }

    // Update the session with distance and checkout data
    const updatedSession = await prisma.gPSSession.update({
      where: { id: sessionId },
      data: {
        checkOut,
        endLat: endCoord?.latitude,
        endLng: endCoord?.longitude,
        totalKm,
        calculationMethod,
        routeAccuracy: calculationMethod.includes('google') ? 'high' : 'standard'
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
      coordinateCount: coordinates.length,
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
    
    // Build coordinate list
    const coordinates: Array<{ latitude: number; longitude: number; timestamp?: Date }> = [];
    
    // Add start location if available
    if (gpsSession.startLat !== null && gpsSession.startLng !== null) {
      coordinates.push({
        latitude: gpsSession.startLat,
        longitude: gpsSession.startLng,
        timestamp: gpsSession.checkIn
      });
    }

    // Add GPS logs
    gpsSession.gpsLogs.forEach(log => {
      coordinates.push({
        latitude: log.latitude,
        longitude: log.longitude,
        timestamp: log.timestamp
      });
    });

    if (coordinates.length > 1) {
      try {
        // Try using Distance Matrix API first
        const distanceResult = await calculateSimpleDistance(coordinates, {
          apiKey: process.env.GOOGLE_MAPS_API_KEY,
          mode: 'driving',
          segmentSize: 50
        });
        totalKm = distanceResult.distance;
      } catch {
        // Fallback to Haversine
        totalKm = calculateTotalDistance(coordinates);
      }
    }

    // Force close the session
    const checkOut = new Date();
    const updatedSession = await prisma.gPSSession.update({
      where: { id: sessionId },
      data: {
        checkOut,
        totalKm,
        calculationMethod: 'force_close'
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