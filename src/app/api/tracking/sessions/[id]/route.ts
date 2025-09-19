import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateSessionSummary } from '@/lib/gps-analytics';
import { calculateDataQualityMetrics } from '@/lib/gps-analytics';

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: sessionId } = await params;
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const includeRoute = searchParams.get('includeRoute') === 'true';
    const includeAnalytics = searchParams.get('includeAnalytics') === 'true';

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
            region: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        gpsLogs: {
          orderBy: { timestamp: 'asc' },
          select: {
            id: true,
            latitude: true,
            longitude: true,
            timestamp: true,
            accuracy: true,
            speed: true,
            altitude: true
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

    // Check access permissions
    const canAccess = gpsSession.userId === session.user.id || 
                     session.user.role === 'ADMIN' || 
                     (session.user.role === 'LEAD_MR' && await checkTeamAccess(session.user.id, gpsSession.userId));

    if (!canAccess) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Generate session summary
    const summary = generateSessionSummary({
      id: gpsSession.id,
      userId: gpsSession.userId,
      checkIn: gpsSession.checkIn,
      checkOut: gpsSession.checkOut,
      totalKm: gpsSession.totalKm || 0,
      startLat: gpsSession.startLat,
      startLng: gpsSession.startLng,
      endLat: gpsSession.endLat,
      endLng: gpsSession.endLng,
      gpsLogs: gpsSession.gpsLogs.map(log => ({
        latitude: log.latitude,
        longitude: log.longitude,
        timestamp: log.timestamp,
        speed: log.speed
      }))
    });

    // Prepare response data
    const responseData: Record<string, unknown> = {
      ...summary,
      user: gpsSession.user,
      status: gpsSession.checkOut ? 'completed' : 'active'
    };

    // Add route data if requested
    if (includeRoute) {
      responseData.route = {
        coordinates: gpsSession.gpsLogs.map(log => ({
          latitude: log.latitude,
          longitude: log.longitude,
          timestamp: log.timestamp,
          accuracy: log.accuracy,
          speed: log.speed,
          altitude: log.altitude
        })),
        totalPoints: gpsSession.gpsLogs.length
      };
    }

    // Add analytics data if requested
    if (includeAnalytics) {
      // Calculate data quality metrics
      const qualityMetrics = calculateDataQualityMetrics(
        gpsSession.gpsLogs.map(log => ({
          latitude: log.latitude,
          longitude: log.longitude,
          accuracy: log.accuracy,
          timestamp: log.timestamp
        }))
      );

      // Calculate session statistics
      const speeds = gpsSession.gpsLogs
        .map(log => log.speed)
        .filter((speed): speed is number => speed !== null && speed > 0);

      const analytics = {
        dataQuality: qualityMetrics,
        movement: {
          maxSpeed: speeds.length > 0 ? Math.max(...speeds) : 0,
          avgSpeed: speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0,
          speedVariance: calculateSpeedVariance(speeds),
          movingTime: calculateMovingTime(gpsSession.gpsLogs),
          stationaryTime: summary.duration - (calculateMovingTime(gpsSession.gpsLogs) / 60) // Convert to hours
        },
        efficiency: {
          distanceEfficiency: summary.duration > 0 ? summary.totalKm / summary.duration : 0,
          routeOptimization: calculateRouteOptimization(gpsSession.gpsLogs),
          dataCompleteness: (gpsSession.gpsLogs.length / Math.max(1, summary.duration * 120)) * 100 // Expected ~2 points per minute
        }
      };

      responseData.analytics = analytics;
    }

    // Return with no-cache headers to ensure frontend gets fresh data
    return new NextResponse(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error) {
    console.error('GPS session details error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to retrieve GPS session details'
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: sessionId } = await params;
    const body = await request.json();

    // Find the GPS session
    const gpsSession = await prisma.gPSSession.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          select: {
            id: true,
            name: true
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

    // Check permissions - only owner or admin can modify
    const canModify = gpsSession.userId === session.user.id || 
                     session.user.role === 'ADMIN';

    if (!canModify) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (body.totalKm !== undefined) {
      updateData.totalKm = parseFloat(body.totalKm);
    }

    if (body.checkOut !== undefined) {
      updateData.checkOut = body.checkOut ? new Date(body.checkOut) : null;
    }

    if (body.endLat !== undefined && body.endLng !== undefined) {
      updateData.endLat = parseFloat(body.endLat);
      updateData.endLng = parseFloat(body.endLng);
    }

    // Update the session
    const updatedSession = await prisma.gPSSession.update({
      where: { id: sessionId },
      data: updateData
    });

    // Log the modification
    // console.log(`GPS session ${sessionId} modified by ${session.user.id}. Changes:`, updateData);

    const response = {
      sessionId: updatedSession.id,
      updated: Object.keys(updateData),
      checkIn: updatedSession.checkIn,
      checkOut: updatedSession.checkOut,
      totalKm: updatedSession.totalKm,
      message: 'Session updated successfully'
    };

    return new NextResponse(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error) {
    console.error('GPS session update error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to update GPS session'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only admins can delete sessions
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only administrators can delete GPS sessions' },
        { status: 403 }
      );
    }

    const { id: sessionId } = await params;

    // Find the GPS session first
    const gpsSession = await prisma.gPSSession.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          select: { name: true }
        },
        _count: {
          select: { gpsLogs: true }
        }
      }
    });

    if (!gpsSession) {
      return NextResponse.json(
        { error: 'GPS session not found' },
        { status: 404 }
      );
    }

    // Delete the session (GPS logs will be cascade deleted)
    await prisma.gPSSession.delete({
      where: { id: sessionId }
    });

    // Log the deletion
    // console.log(`GPS session ${sessionId} deleted by admin ${session.user.id}. User: ${gpsSession.user.name}, GPS logs: ${gpsSession._count.gpsLogs}`);

    return NextResponse.json({
      message: 'GPS session deleted successfully',
      deletedSession: {
        id: sessionId,
        user: gpsSession.user.name,
        checkIn: gpsSession.checkIn,
        checkOut: gpsSession.checkOut,
        coordinatesDeleted: gpsSession._count.gpsLogs
      }
    });

  } catch (error) {
    console.error('GPS session deletion error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to delete GPS session'
      },
      { status: 500 }
    );
  }
}

// Helper functions
async function checkTeamAccess(leadMrId: string, userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { leadMrId: true }
  });
  
  return user?.leadMrId === leadMrId;
}

function calculateSpeedVariance(speeds: number[]): number {
  if (speeds.length < 2) return 0;
  
  const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const variance = speeds.reduce((sum, speed) => sum + Math.pow(speed - avg, 2), 0) / speeds.length;
  
  return Math.round(Math.sqrt(variance) * 100) / 100;
}

function calculateMovingTime(gpsLogs: Array<{ timestamp: Date; speed: number | null }>): number {
  if (gpsLogs.length < 2) return 0;
  
  let movingTimeMinutes = 0;
  const minMovingSpeed = 1; // km/h
  
  for (let i = 1; i < gpsLogs.length; i++) {
    const currentLog = gpsLogs[i];
    const previousLog = gpsLogs[i - 1];
    
    if (currentLog.speed && currentLog.speed > minMovingSpeed) {
      const timeDiff = (currentLog.timestamp.getTime() - previousLog.timestamp.getTime()) / (1000 * 60);
      movingTimeMinutes += timeDiff;
    }
  }
  
  return Math.round(movingTimeMinutes * 10) / 10;
}

function calculateRouteOptimization(gpsLogs: Array<{ latitude: number; longitude: number }>): number {
  if (gpsLogs.length < 2) return 100;
  
  // Simple route optimization score based on directness
  const start = gpsLogs[0];
  const end = gpsLogs[gpsLogs.length - 1];
  
  // Calculate direct distance
  const directDistance = Math.sqrt(
    Math.pow(end.latitude - start.latitude, 2) + 
    Math.pow(end.longitude - start.longitude, 2)
  );
  
  // Calculate actual path length (simplified)
  let actualDistance = 0;
  for (let i = 1; i < gpsLogs.length; i++) {
    const curr = gpsLogs[i];
    const prev = gpsLogs[i - 1];
    actualDistance += Math.sqrt(
      Math.pow(curr.latitude - prev.latitude, 2) + 
      Math.pow(curr.longitude - prev.longitude, 2)
    );
  }
  
  if (actualDistance === 0) return 100;
  
  const efficiency = (directDistance / actualDistance) * 100;
  return Math.min(100, Math.max(0, Math.round(efficiency * 10) / 10));
}
