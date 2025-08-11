import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser, errorResponse } from '@/lib/api-utils';
import { validateSessionData, checkSessionConflicts, sanitizeCoordinate } from '@/lib/gps-validation';

export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user (supports both JWT and session)
    const user = await getAuthenticatedUser(request);
    
    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    // Parse request body
    const body = await request.json();
    
    // Validate and sanitize input data
    const checkIn = new Date(body.checkIn || new Date());
    const startCoord = sanitizeCoordinate({
      latitude: body.latitude,
      longitude: body.longitude,
      accuracy: body.accuracy
    });

    // Validate session data
    const sessionData = {
      userId: user.id,
      checkIn,
      startLat: startCoord?.latitude,
      startLng: startCoord?.longitude
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

    // Check for existing unclosed sessions or conflicts
    const existingSessions = await prisma.gPSSession.findMany({
      where: {
        userId: user.id
      },
      select: {
        id: true,
        checkIn: true,
        checkOut: true
      },
      orderBy: {
        checkIn: 'desc'
      },
      take: 10 // Check last 10 sessions for conflicts
    });

    const conflicts = checkSessionConflicts(
      user.id,
      checkIn,
      undefined,
      existingSessions
    );

    // Handle unclosed sessions
    const unclosedSessions = conflicts.filter(c => c.conflictType === 'UNCLOSED_SESSION');
    if (unclosedSessions.length > 0) {
      // Auto-close the previous session
      const unclosedSessionId = unclosedSessions[0].existingSessionId;
      
      await prisma.gPSSession.update({
        where: { id: unclosedSessionId },
        data: {
          checkOut: new Date(checkIn.getTime() - 1000) // 1 second before new check-in
        }
      });

      console.log(`Auto-closed unclosed session ${unclosedSessionId} for user ${user.id}`);
    }

    // Check for overlapping sessions (but allow them with warning)
    const overlaps = conflicts.filter(c => c.conflictType === 'OVERLAP');
    const warnings = overlaps.map(o => o.message);

    // Create new GPS session
    const newSession = await prisma.gPSSession.create({
      data: {
        userId: user.id,
        checkIn,
        checkOut: null,
        startLat: startCoord?.latitude,
        startLng: startCoord?.longitude,
        totalKm: 0
      }
    });

    // Log the initial coordinate if provided
    if (startCoord) {
      await prisma.gPSLog.create({
        data: {
          sessionId: newSession.id,
          latitude: startCoord.latitude,
          longitude: startCoord.longitude,
          timestamp: checkIn,
          accuracy: startCoord.accuracy,
          speed: startCoord.speed,
          altitude: startCoord.altitude
        }
      });
    }

    // Prepare response
    const response = {
      sessionId: newSession.id,
      checkIn: newSession.checkIn,
      status: 'active',
      message: 'Check-in successful'
    };

    // Add warnings if any
    if (warnings.length > 0) {
      (response as Record<string, unknown>).warnings = warnings;
    }

    if (validation.warnings.length > 0) {
      (response as Record<string, unknown>).validationWarnings = validation.warnings;
    }

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('GPS check-in error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to process GPS check-in'
      },
      { status: 500 }
    );
  }
}

// GET method to check current session status
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    
    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    // Find active session using the working query approach
    // Get all sessions for this user - this query works reliably
    const allSessions = await prisma.gPSSession.findMany({
      where: { userId: user.id },
      select: { 
        id: true, 
        checkIn: true, 
        checkOut: true, 
        startLat: true, 
        startLng: true, 
        totalKm: true 
      },
      orderBy: { checkIn: 'desc' },
      take: 5
    });
    
    // Find the active session from the results (checkOut === null)
    const activeSessionData = allSessions.find(session => session.checkOut === null);
    
    if (activeSessionData) {
      // Get GPS logs count for this session
      const gpsLogsCount = await prisma.gPSLog.count({
        where: { sessionId: activeSessionData.id }
      });
      
      // Calculate session duration
      const duration = (new Date().getTime() - activeSessionData.checkIn.getTime()) / (1000 * 60 * 60);
      
      return NextResponse.json({
        status: 'active',
        activeSession: {
          sessionId: activeSessionData.id,
          checkIn: activeSessionData.checkIn,
          duration: Math.round(duration * 100) / 100,
          totalKm: activeSessionData.totalKm || 0,
          coordinateCount: gpsLogsCount,
          startLocation: activeSessionData.startLat && activeSessionData.startLng ? {
            latitude: activeSessionData.startLat,
            longitude: activeSessionData.startLng
          } : null
        }
      });
    }
    
    // No active session found
    return NextResponse.json({
      status: 'inactive',
      activeSession: null
    });

  } catch (error) {
    console.error('GPS session status error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to get session status'
      },
      { status: 500 }
    );
  }
}
