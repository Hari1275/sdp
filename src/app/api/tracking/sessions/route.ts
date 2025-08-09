import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser, errorResponse } from '@/lib/api-utils'
import { validateAnalyticsQuery } from '@/lib/gps-validation';
import { generateSessionSummary } from '@/lib/gps-analytics';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    
    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const includeLogs = searchParams.get('includeLogs') === 'true';

    // Validate analytics query parameters
    const queryData = {
      userId: userId || undefined,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined
    };

    const validation = validateAnalyticsQuery(queryData);
    
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          error: 'Invalid query parameters',
          details: validation.errors
        },
        { status: 400 }
      );
    }

    // Determine which user's data to retrieve
    let targetUserId = user.id;
    
    if (userId) {
      // Check if current user can access other user's data
      const canAccessOtherUsers = user.role === 'ADMIN' || user.role === 'LEAD_MR';
      
      if (userId !== user.id && !canAccessOtherUsers) {
        return NextResponse.json(
          { error: 'Insufficient permissions to access other user data' },
          { status: 403 }
        );
      }
      
      targetUserId = userId;
    }

    // If Lead MR, verify they can only access their team members
    if (user.role === 'LEAD_MR' && userId && userId !== user.id) {
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { leadMrId: true }
      });

      if (!targetUser || targetUser.leadMrId !== user.id) {
        return NextResponse.json(
          { error: 'Can only access your team members data' },
          { status: 403 }
        );
      }
    }

    // Build query conditions
    const whereConditions: Record<string, unknown> = {
      userId: targetUserId
    };

    if (dateFrom && dateTo) {
      whereConditions.checkIn = {
        gte: new Date(dateFrom),
        lte: new Date(dateTo)
      };
    } else if (dateFrom) {
      whereConditions.checkIn = { gte: new Date(dateFrom) };
    } else if (dateTo) {
      whereConditions.checkIn = { lte: new Date(dateTo) };
    }

    if (status) {
      if (status === 'active') {
        whereConditions.checkOut = null;
      } else if (status === 'completed') {
        whereConditions.checkOut = { not: null };
      }
    }

    // Get sessions with optional GPS logs
    const [sessions, totalCount] = await Promise.all([
      prisma.gPSSession.findMany({
        where: whereConditions,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              role: true
            }
          },
          gpsLogs: includeLogs ? {
            orderBy: { timestamp: 'asc' },
            select: {
              latitude: true,
              longitude: true,
              timestamp: true,
              accuracy: true,
              speed: true,
              altitude: true
            }
          } : false,
          _count: {
            select: {
              gpsLogs: true
            }
          }
        },
        orderBy: { checkIn: 'desc' },
        skip: offset,
        take: Math.min(limit, 100) // Cap at 100 for performance
      }),
      prisma.gPSSession.count({ where: whereConditions })
    ]);

    // Generate session summaries
    const sessionSummaries = sessions.map(s => {
      const summary = generateSessionSummary({
        id: s.id,
        userId: s.userId,
        checkIn: s.checkIn,
        checkOut: s.checkOut,
        totalKm: s.totalKm || 0,
        startLat: s.startLat,
        startLng: s.startLng,
        endLat: s.endLat,
        endLng: s.endLng,
        gpsLogs: includeLogs ? (s.gpsLogs as Array<{ latitude: number; longitude: number; timestamp: Date; speed: number | null }>).map(log => ({
          latitude: log.latitude,
          longitude: log.longitude,
          timestamp: log.timestamp,
          speed: log.speed
        })) : []
      });

      return {
        ...summary,
        user: s.user,
        coordinateCount: s._count.gpsLogs,
        ...(includeLogs && { gpsLogs: s.gpsLogs })
      };
    });

    // Calculate summary statistics
    const completedSessions = sessionSummaries.filter(s => s.checkOut !== null);
    const totalKm = completedSessions.reduce((sum, s) => sum + s.totalKm, 0);
    const totalDuration = completedSessions.reduce((sum, s) => sum + s.duration, 0);
    const avgSessionDuration = completedSessions.length > 0 ? totalDuration / completedSessions.length : 0;

    const response = {
      sessions: sessionSummaries,
      pagination: {
        offset,
        limit,
        totalCount,
        hasMore: offset + sessions.length < totalCount
      },
      summary: {
        totalSessions: totalCount,
        completedSessions: completedSessions.length,
        activeSessions: sessionSummaries.length - completedSessions.length,
        totalKm: Math.round(totalKm * 1000) / 1000,
        avgSessionDuration: Math.round(avgSessionDuration * 100) / 100
      },
      filters: {
        userId: targetUserId,
        dateFrom: dateFrom,
        dateTo: dateTo,
        status: status
      }
    };

    // Add warnings if any
    if (validation.warnings.length > 0) {
      (response as Record<string, unknown>).warnings = validation.warnings;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('GPS sessions retrieval error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to retrieve GPS sessions'
      },
      { status: 500 }
    );
  }
}

// POST method to create a manual session (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only admins can create manual sessions
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only administrators can create manual sessions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { 
      userId, 
      checkIn, 
      checkOut, 
      startLat, 
      startLng, 
      endLat, 
      endLng, 
      totalKm,
      notes 
    } = body;

    // Validate required fields
    if (!userId || !checkIn) {
      return NextResponse.json(
        { error: 'User ID and check-in time are required' },
        { status: 400 }
      );
    }

    // Verify user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true }
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Create manual session
    const manualSession = await prisma.gPSSession.create({
      data: {
        userId: userId,
        checkIn: new Date(checkIn),
        checkOut: checkOut ? new Date(checkOut) : null,
        startLat: startLat || null,
        startLng: startLng || null,
        endLat: endLat || null,
        endLng: endLng || null,
        totalKm: totalKm || 0
      }
    });

    // Log the manual session creation
    console.log(`Manual session created by admin ${session.user.id} for user ${userId}. Notes: ${notes || 'None'}`);

    return NextResponse.json({
      sessionId: manualSession.id,
      userId: manualSession.userId,
      checkIn: manualSession.checkIn,
      checkOut: manualSession.checkOut,
      totalKm: manualSession.totalKm,
      status: 'manual_created',
      createdBy: session.user.id,
      message: 'Manual session created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Manual session creation error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to create manual session'
      },
      { status: 500 }
    );
  }
}
