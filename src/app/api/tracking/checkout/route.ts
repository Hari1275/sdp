import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sanitizeCoordinate, validateSessionData } from '@/lib/gps-validation';
import { calculateTotalDistance } from '@/lib/gps-utils';

export async function POST(request: NextRequest) {
  try {
    // Get the authenticated session
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
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
    if (gpsSession.userId !== session.user.id) {
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
      userId: session.user.id,
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

    // Calculate total distance from GPS logs
    let totalKm = 0;
    if (gpsSession.gpsLogs.length > 1) {
      const coordinates = gpsSession.gpsLogs.map(log => ({
        latitude: log.latitude,
        longitude: log.longitude,
        timestamp: log.timestamp
      }));
      
      totalKm = calculateTotalDistance(coordinates);
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
        
        const finalDistance = calculateTotalDistance([lastCoord, endCoord]);
        totalKm += finalDistance;
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
            mrId: session.user.id,
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
          mrId: session.user.id,
          date: today,
          totalKms: totalKm,
          totalHours: sessionDuration,
          checkInCount: 1,
          totalVisits: 0,
          totalBusiness: 0
        }
      });
    } catch (summaryError) {
      // Log error but don't fail the checkout
      console.error('Failed to update daily summary:', summaryError);
    }

    // Prepare response
    const response = {
      sessionId: updatedSession.id,
      checkOut: updatedSession.checkOut,
      totalKm: Math.round(totalKm * 1000) / 1000,
      duration: Math.round(sessionDuration * 100) / 100, // hours
      avgSpeed: Math.round(avgSpeed * 100) / 100, // km/h
      coordinateCount: gpsSession.gpsLogs.length + (endCoord ? 1 : 0),
      status: 'completed',
      message: 'Check-out successful'
    };

    // Add warnings if any
    if (validation.warnings.length > 0) {
      (response as Record<string, unknown>).warnings = validation.warnings;
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

  } catch (error) {
    console.error('GPS check-out error:', error);
    
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
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
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
    const canClose = gpsSession.userId === session.user.id || 
                    session.user.role === 'ADMIN' || 
                    session.user.role === 'LEAD_MR';

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
    console.log(`Session ${sessionId} force-closed by ${session.user.id}. Reason: ${reason || 'Not specified'}`);

    return NextResponse.json({
      sessionId: updatedSession.id,
      checkOut: updatedSession.checkOut,
      totalKm: Math.round(totalKm * 1000) / 1000,
      status: 'force_closed',
      reason: reason || 'Force closed',
      closedBy: session.user.id
    });

  } catch (error) {
    console.error('Force close session error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to force close session'
      },
      { status: 500 }
    );
  }
}
