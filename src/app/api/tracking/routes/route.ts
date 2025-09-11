import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser, errorResponse } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query based on user role and filters
    const whereConditions: Record<string, unknown> = {};

    // Role-based access control
    if (user.role === 'MR') {
      whereConditions.userId = user.id;
    } else if (user.role === 'LEAD_MR') {
      // Lead MR can see their team's routes
      const teamMemberIds = await prisma.user.findMany({
        where: { leadMrId: user.id },
        select: { id: true }
      });
      whereConditions.userId = {
        in: [user.id, ...teamMemberIds.map(tm => tm.id)]
      };
    }
    // ADMIN can see all routes (no additional filter)

    // Apply specific filters
    if (sessionId) {
      whereConditions.id = sessionId;
    }

    if (userId && (user.role === 'ADMIN' || user.role === 'LEAD_MR')) {
      whereConditions.userId = userId;
    }

    // Only return completed sessions with route data
    whereConditions.checkOut = { not: null };

    const sessions = await prisma.gPSSession.findMany({
      where: whereConditions,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true
          }
        },
        gpsLogs: {
          orderBy: { timestamp: 'asc' },
          select: {
            latitude: true,
            longitude: true,
            timestamp: true,
            accuracy: true,
            speed: true
          }
        }
      },
      orderBy: { checkIn: 'desc' },
      skip: offset,
      take: Math.min(limit, 100), // Cap at 100 for performance
    });

    // Transform sessions into route visualization format
    const routes = sessions.map(session => {
      let parsedRouteData = null;
      
      // Parse stored route data
      if (session.routeData) {
        try {
          parsedRouteData = JSON.parse(session.routeData);
        } catch (error) {
          console.warn(`Failed to parse route data for session ${session.id}:`, error);
        }
      }

      return {
        sessionId: session.id,
        userId: session.userId,
        userName: session.user.name,
        checkIn: session.checkIn,
        checkOut: session.checkOut,
        distance: session.totalKm || 0,
        duration: session.estimatedDuration,
        calculationMethod: session.calculationMethod,
        routeAccuracy: session.routeAccuracy,
        coordinates: session.gpsLogs.map(log => ({
          lat: log.latitude,
          lng: log.longitude,
          timestamp: log.timestamp,
          accuracy: log.accuracy,
          speed: log.speed
        })),
        // Enhanced route data
        routePolyline: parsedRouteData?.polyline,
        routeGeometry: parsedRouteData?.geometry,
        optimizations: parsedRouteData?.optimizations,
        processingStats: {
          originalPoints: parsedRouteData?.totalOriginalPoints,
          optimizedPoints: parsedRouteData?.optimizedPoints,
          cacheUtilized: parsedRouteData?.cacheUtilized,
          processingTimeMs: parsedRouteData?.processingTimeMs,
          calculatedAt: parsedRouteData?.calculatedAt
        }
      };
    });

    const totalCount = await prisma.gPSSession.count({ where: whereConditions });

    return NextResponse.json({
      routes,
      pagination: {
        offset,
        limit,
        totalCount,
        hasMore: offset + routes.length < totalCount
      },
      statistics: {
        totalRoutes: routes.length,
        methodBreakdown: routes.reduce((acc: Record<string, number>, route) => {
          const method = route.calculationMethod || 'unknown';
          acc[method] = (acc[method] || 0) + 1;
          return acc;
        }, {}),
        accuracyBreakdown: routes.reduce((acc: Record<string, number>, route) => {
          const accuracy = route.routeAccuracy || 'standard';
          acc[accuracy] = (acc[accuracy] || 0) + 1;
          return acc;
        }, {}),
        totalDistance: routes.reduce((sum, route) => sum + (route.distance || 0), 0),
        totalDuration: routes.reduce((sum, route) => sum + (route.duration || 0), 0)
      }
    });

  } catch (error) {
    console.error('Route retrieval error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to retrieve route data'
      },
      { status: 500 }
    );
  }
}

// POST method to manually recalculate route for a session (admin feature)
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== 'ADMIN') {
      return errorResponse('FORBIDDEN', 'Admin access required', 403);
    }

    const { sessionId, forceRecalculation } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const session = await prisma.gPSSession.findUnique({
      where: { id: sessionId },
      include: {
        gpsLogs: {
          orderBy: { timestamp: 'asc' }
        }
      }
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (!session.checkOut) {
      return NextResponse.json(
        { error: 'Cannot recalculate active session' },
        { status: 400 }
      );
    }

    // Skip if already calculated and not forcing
    if (session.routeData && !forceRecalculation) {
      return NextResponse.json({
        message: 'Route already calculated',
        sessionId: session.id,
        distance: session.totalKm,
        method: session.calculationMethod,
        skipped: true
      });
    }


    // Import and use god-level routing engine
    const { calculateGodLevelRoute } = await import('@/lib/advanced-gps-engine');

    const coordinates = session.gpsLogs.map(log => ({
      latitude: log.latitude,
      longitude: log.longitude,
      timestamp: log.timestamp
    }));

    if (coordinates.length < 2) {
      return NextResponse.json(
        { error: 'Insufficient GPS data for route calculation' },
        { status: 400 }
      );
    }

    console.log(`🔄 Recalculating route for session ${sessionId} with ${coordinates.length} points...`);

    const result = await calculateGodLevelRoute(coordinates);

    // Update the session with new route data
    const updatedSession = await prisma.gPSSession.update({
      where: { id: sessionId },
      data: {
        totalKm: result.distance,
        estimatedDuration: result.duration,
        calculationMethod: result.method,
        routeAccuracy: result.optimizations?.accuracy || 'standard',
        routeData: JSON.stringify({
          polyline: result.polyline,
          geometry: result.geometry,
          method: result.method,
          duration: result.duration,
          optimizations: result.optimizations,
          calculatedAt: new Date().toISOString(),
          recalculatedBy: user.id,
          recalculatedAt: new Date().toISOString()
        })
      }
    });

    console.log(`✅ Route recalculated successfully for session ${sessionId}`);
    console.log(`   Distance: ${result.distance.toFixed(3)}km`);
    console.log(`   Duration: ${result.duration.toFixed(1)}min`);
    console.log(`   Method: ${result.method}`);
    console.log(`   Accuracy: ${result.optimizations?.accuracy}`);

    return NextResponse.json({
      message: 'Route recalculated successfully',
      sessionId: updatedSession.id,
      distance: result.distance,
      duration: result.duration,
      method: result.method,
      accuracy: result.optimizations?.accuracy,
      optimizations: result.optimizations,
      recalculatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Route recalculation error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to recalculate route'
      },
      { status: 500 }
    );
  }
}
