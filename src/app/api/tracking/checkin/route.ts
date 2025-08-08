import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { validateSessionData, checkSessionConflicts, sanitizeCoordinate } from '@/lib/gps-validation';

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
    
    // Validate and sanitize input data
    const checkIn = new Date(body.checkIn || new Date());
    const startCoord = sanitizeCoordinate({
      latitude: body.latitude,
      longitude: body.longitude,
      accuracy: body.accuracy
    });

    // Validate session data
    const sessionData = {
      userId: session.user.id,
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
        userId: session.user.id
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
      session.user.id,
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

      console.log(`Auto-closed unclosed session ${unclosedSessionId} for user ${session.user.id}`);
    }

    // Check for overlapping sessions (but allow them with warning)
    const overlaps = conflicts.filter(c => c.conflictType === 'OVERLAP');
    const warnings = overlaps.map(o => o.message);

    // Create new GPS session
    const newSession = await prisma.gPSSession.create({
      data: {
        userId: session.user.id,
        checkIn,
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
      (response as any).warnings = warnings;
    }

    if (validation.warnings.length > 0) {
      (response as any).validationWarnings = validation.warnings;
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
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Find active session
    const activeSession = await prisma.gPSSession.findFirst({
      where: {
        userId: session.user.id,
        checkOut: null
      },
      orderBy: {
        checkIn: 'desc'
      },
      include: {
        _count: {
          select: {
            gpsLogs: true
          }
        }
      }
    });

    if (!activeSession) {
      return NextResponse.json({
        status: 'inactive',
        activeSession: null
      });
    }

    // Calculate session duration
    const duration = new Date().getTime() - activeSession.checkIn.getTime();
    const durationHours = duration / (1000 * 60 * 60);

    return NextResponse.json({
      status: 'active',
      activeSession: {
        sessionId: activeSession.id,
        checkIn: activeSession.checkIn,
        duration: Math.round(durationHours * 100) / 100,
        totalKm: activeSession.totalKm || 0,
        coordinateCount: activeSession._count.gpsLogs,
        startLocation: activeSession.startLat && activeSession.startLng ? {
          latitude: activeSession.startLat,
          longitude: activeSession.startLng
        } : null
      }
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
