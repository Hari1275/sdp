import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser, errorResponse } from '@/lib/api-utils'
import { calculateDistance } from '@/lib/gps-utils';

interface LiveSessionData {
  sessionId: string;
  userId: string;
  userName: string;
  checkIn: Date;
  duration: number; // in hours
  currentLocation?: {
    latitude: number;
    longitude: number;
    timestamp: Date;
    accuracy?: number;
    speed?: number;
  };
  stats: {
    totalKm: number;
    coordinateCount: number;
    lastUpdate: Date | null;
    avgSpeed: number;
    isMoving: boolean;
  };
  status: 'active' | 'idle' | 'moving';
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    
    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const includeTeam = searchParams.get('includeTeam') === 'true';
    const region = searchParams.get('region');

    // Determine access permissions
    let targetUserIds: string[] = [user.id];
    
    if (userId) {
      // Specific user requested
      const canAccessOtherUsers = user.role === 'ADMIN' || user.role === 'LEAD_MR';
      
      if (userId !== user.id && !canAccessOtherUsers) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        );
      }
      
      targetUserIds = [userId];
    } else if (includeTeam) {
      // Team data requested
      if (user.role === 'ADMIN') {
        // Admin can see all users
        const allUsers = await prisma.user.findMany({
          where: { status: 'ACTIVE' },
          select: { id: true }
        });
        targetUserIds = allUsers.map(u => u.id);
      } else if (user.role === 'LEAD_MR') {
        // Lead MR can see their team
        const teamMembers = await prisma.user.findMany({
          where: { leadMrId: user.id },
          select: { id: true }
        });
        targetUserIds = [user.id, ...teamMembers.map(u => u.id)];
      }
    }

    // For Lead MR accessing specific user, verify team membership
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
      userId: { in: targetUserIds },
      checkOut: null // Only active sessions
    };

    if (region) {
      whereConditions.user = {
        regionId: region
      };
    }

    // Get active GPS sessions
    const activeSessions = await prisma.gPSSession.findMany({
      where: whereConditions,
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
          orderBy: { timestamp: 'desc' },
          take: 5, // Get last 5 coordinates for movement analysis
          select: {
            latitude: true,
            longitude: true,
            timestamp: true,
            accuracy: true,
            speed: true
          }
        },
        _count: {
          select: {
            gpsLogs: true
          }
        }
      }
    });

    // Process sessions to create live data
    const liveSessionsData: LiveSessionData[] = [];

    for (const sessionData of activeSessions) {
      const duration = (new Date().getTime() - sessionData.checkIn.getTime()) / (1000 * 60 * 60);
      const gpsLogs = sessionData.gpsLogs;
      
      // Analyze movement
      const movementAnalysis = analyzeMovement(gpsLogs);
      
      // Calculate average speed from recent GPS logs
      const speeds = gpsLogs
        .map(log => log.speed)
        .filter((speed): speed is number => speed !== null && speed > 0);
      const avgSpeed = speeds.length > 0 ? 
        speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;

      // Determine session status
      const lastUpdateTime = gpsLogs.length > 0 ? gpsLogs[0].timestamp : sessionData.checkIn;
      const timeSinceLastUpdate = (new Date().getTime() - lastUpdateTime.getTime()) / (1000 * 60); // minutes
      
      let status: 'active' | 'idle' | 'moving' = 'idle';
      if (timeSinceLastUpdate < 5) { // Updated within 5 minutes
        status = movementAnalysis.isMoving ? 'moving' : 'active';
      }

      const liveData: LiveSessionData = {
        sessionId: sessionData.id,
        userId: sessionData.userId,
        userName: sessionData.user.name,
        checkIn: sessionData.checkIn,
        duration: Math.round(duration * 100) / 100,
        currentLocation: gpsLogs.length > 0 ? {
          latitude: gpsLogs[0].latitude,
          longitude: gpsLogs[0].longitude,
          timestamp: gpsLogs[0].timestamp,
          accuracy: gpsLogs[0].accuracy ?? undefined,
          speed: gpsLogs[0].speed ?? undefined
        } : undefined,
        stats: {
          totalKm: sessionData.totalKm || 0,
          coordinateCount: sessionData._count.gpsLogs,
          lastUpdate: gpsLogs.length > 0 ? gpsLogs[0].timestamp : null,
          avgSpeed: Math.round(avgSpeed * 100) / 100,
          isMoving: movementAnalysis.isMoving
        },
        status
      };

      liveSessionsData.push(liveData);
    }

    // Sort by most recent activity
    liveSessionsData.sort((a, b) => {
      const aTime = a.stats.lastUpdate ? a.stats.lastUpdate.getTime() : a.checkIn.getTime();
      const bTime = b.stats.lastUpdate ? b.stats.lastUpdate.getTime() : b.checkIn.getTime();
      return bTime - aTime;
    });

    // Calculate summary statistics
    const summary = {
      totalActiveSessions: liveSessionsData.length,
      movingSessions: liveSessionsData.filter(s => s.status === 'moving').length,
      idleSessions: liveSessionsData.filter(s => s.status === 'idle').length,
      totalKm: liveSessionsData.reduce((sum, s) => sum + s.stats.totalKm, 0),
      avgSessionDuration: liveSessionsData.length > 0 ? 
        liveSessionsData.reduce((sum, s) => sum + s.duration, 0) / liveSessionsData.length : 0,
      lastUpdate: new Date()
    };

    // Add real-time insights
    const insights = generateLiveInsights(liveSessionsData);

    return NextResponse.json({
      activeSessions: liveSessionsData,
      summary: {
        ...summary,
        totalKm: Math.round(summary.totalKm * 1000) / 1000,
        avgSessionDuration: Math.round(summary.avgSessionDuration * 100) / 100
      },
      insights,
      metadata: {
        requestedBy: user.id,
        requestedAt: new Date(),
        filters: {
          userId: userId,
          includeTeam: includeTeam,
          region: region
        },
        refreshRecommended: new Date(Date.now() + 30 * 1000) // 30 seconds from now
      }
    });

  } catch (error) {
    console.error('Live GPS tracking error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to retrieve live GPS tracking data'
      },
      { status: 500 }
    );
  }
}

// Helper function to analyze movement from GPS logs
function analyzeMovement(gpsLogs: Array<{
  latitude: number;
  longitude: number;
  timestamp: Date;
  speed: number | null;
}>): {
  isMoving: boolean;
  averageSpeed: number;
  distanceInLast5Minutes: number;
} {
  if (gpsLogs.length < 2) {
    return {
      isMoving: false,
      averageSpeed: 0,
      distanceInLast5Minutes: 0
    };
  }

  // Get logs from last 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const recentLogs = gpsLogs.filter(log => log.timestamp > fiveMinutesAgo);

  if (recentLogs.length < 2) {
    return {
      isMoving: false,
      averageSpeed: 0,
      distanceInLast5Minutes: 0
    };
  }

  // Calculate distance covered in last 5 minutes
  let totalDistance = 0;
  for (let i = 1; i < recentLogs.length; i++) {
    const dist = calculateDistance(
      { latitude: recentLogs[i-1].latitude, longitude: recentLogs[i-1].longitude },
      { latitude: recentLogs[i].latitude, longitude: recentLogs[i].longitude }
    );
    totalDistance += dist;
  }

  // Calculate average speed from GPS data
  const speeds = recentLogs
    .map(log => log.speed)
    .filter((speed): speed is number => speed !== null && speed > 0);
  const averageSpeed = speeds.length > 0 ? 
    speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;

  // Determine if moving (speed > 1 km/h or distance > 0.05 km in 5 minutes)
  const isMoving = averageSpeed > 1 || totalDistance > 0.05;

  return {
    isMoving,
    averageSpeed: Math.round(averageSpeed * 100) / 100,
    distanceInLast5Minutes: Math.round(totalDistance * 1000) / 1000
  };
}

// Helper function to generate live insights
function generateLiveInsights(sessions: LiveSessionData[]): {
  type: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
}[] {
  const insights = [];

  if (sessions.length === 0) {
    insights.push({
      type: 'no_activity',
      message: 'No active GPS sessions found',
      priority: 'low' as const
    });
    return insights;
  }

  // Check for idle sessions
  const idleSessions = sessions.filter(s => s.status === 'idle');
  if (idleSessions.length > 0) {
    insights.push({
      type: 'idle_sessions',
      message: `${idleSessions.length} session(s) appear to be idle`,
      priority: 'medium' as const
    });
  }

  // Check for high activity
  const movingSessions = sessions.filter(s => s.status === 'moving');
  if (movingSessions.length > sessions.length * 0.8) {
    insights.push({
      type: 'high_activity',
      message: `${movingSessions.length} users are currently moving`,
      priority: 'low' as const
    });
  }

  // Check for long sessions
  const longSessions = sessions.filter(s => s.duration > 8); // More than 8 hours
  if (longSessions.length > 0) {
    insights.push({
      type: 'long_sessions',
      message: `${longSessions.length} session(s) running for more than 8 hours`,
      priority: 'high' as const
    });
  }

  // Check for users with no recent GPS updates
  const staleUpdates = sessions.filter(s => {
    if (!s.stats.lastUpdate) return true;
    const timeSinceUpdate = (new Date().getTime() - s.stats.lastUpdate.getTime()) / (1000 * 60);
    return timeSinceUpdate > 10; // No update in 10 minutes
  });

  if (staleUpdates.length > 0) {
    insights.push({
      type: 'stale_updates',
      message: `${staleUpdates.length} session(s) with no GPS updates in 10+ minutes`,
      priority: 'medium' as const
    });
  }

  // Performance insight
  const totalDistance = sessions.reduce((sum, s) => sum + s.stats.totalKm, 0);
  const avgDistance = totalDistance / sessions.length;
  
  if (avgDistance > 50) {
    insights.push({
      type: 'high_performance',
      message: `Above average distance coverage: ${Math.round(avgDistance * 10) / 10} km per session`,
      priority: 'low' as const
    });
  }

  return insights;
}
