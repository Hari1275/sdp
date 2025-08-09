import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { validateAnalyticsQuery } from '@/lib/gps-validation';
import { calculateWeeklyGPSStats } from '@/lib/gps-analytics';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const weekStart = searchParams.get('weekStart');
    const region = searchParams.get('region');

    // Default to current week if not specified
    const defaultWeekStart = getWeekStart(new Date());
    const targetWeekStart = weekStart ? new Date(weekStart) : defaultWeekStart;

    // Validate query parameters
    const queryData = {
      userId: userId || undefined,
      dateFrom: targetWeekStart,
      dateTo: new Date(targetWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000), // Add 6 days
      region: region || undefined
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

    // Determine target user
    let targetUserId = session.user.id;
    
    if (userId) {
      const canAccessOtherUsers = session.user.role === 'ADMIN' || session.user.role === 'LEAD_MR';
      
      if (userId !== session.user.id && !canAccessOtherUsers) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        );
      }
      
      targetUserId = userId;
    }

    // For Lead MR, verify team access
    if (session.user.role === 'LEAD_MR' && userId && userId !== session.user.id) {
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { leadMrId: true }
      });

      if (!targetUser || targetUser.leadMrId !== session.user.id) {
        return NextResponse.json(
          { error: 'Can only access your team members data' },
          { status: 403 }
        );
      }
    }

    // Calculate week end date
    const weekEnd = new Date(targetWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Build query conditions
    const whereConditions: Record<string, unknown> = {
      userId: targetUserId,
      checkIn: {
        gte: targetWeekStart,
        lte: weekEnd
      }
    };

    // Add region filter if specified
    if (region) {
      whereConditions.user = {
        regionId: region
      };
    }

    // Get GPS sessions for the week
    const sessions = await prisma.gPSSession.findMany({
      where: whereConditions,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            region: region ? {
              select: {
                id: true,
                name: true
              }
            } : false
          }
        },
        gpsLogs: {
          select: {
            latitude: true,
            longitude: true,
            timestamp: true,
            speed: true
          },
          orderBy: { timestamp: 'asc' }
        }
      }
    });

    // Calculate weekly statistics
    const weeklyStats = calculateWeeklyGPSStats(
      sessions.map(s => ({
        id: s.id,
        checkIn: s.checkIn,
        checkOut: s.checkOut,
        totalKm: s.totalKm || 0,
        gpsLogs: s.gpsLogs.map(log => ({
          latitude: log.latitude,
          longitude: log.longitude,
          timestamp: log.timestamp,
          speed: log.speed
        }))
      })),
      targetWeekStart
    );

    // Calculate additional weekly metrics
    const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dailyBreakdown = weeklyStats.dailyStats.map((dayStats, index) => ({
      dayName: weekdays[index],
      ...dayStats
    }));

    // Find best and worst performing days
    const completedDays = dailyBreakdown.filter(day => day.totalKm > 0);
    const bestDay = completedDays.reduce((best, day) => 
      day.totalKm > best.totalKm ? day : best, 
      completedDays[0] || { totalKm: 0, dayName: 'None' }
    );
    
    const worstDay = completedDays.reduce((worst, day) => 
      day.totalKm < worst.totalKm ? day : worst, 
      completedDays[0] || { totalKm: 0, dayName: 'None' }
    );

    // Calculate week-over-week comparison
    const previousWeekStart = new Date(targetWeekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    
    const previousWeekEnd = new Date(weekEnd);
    previousWeekEnd.setDate(previousWeekEnd.getDate() - 7);

    const previousWeekSessions = await prisma.gPSSession.findMany({
      where: {
        userId: targetUserId,
        checkIn: {
          gte: previousWeekStart,
          lte: previousWeekEnd
        },
        checkOut: { not: null }
      },
      select: {
        totalKm: true,
        checkIn: true,
        checkOut: true
      }
    });

    const previousWeekKm = previousWeekSessions.reduce((sum, s) => sum + (s.totalKm || 0), 0);
    const previousWeekHours = previousWeekSessions.reduce((sum, s) => {
      if (s.checkOut) {
        return sum + ((s.checkOut.getTime() - s.checkIn.getTime()) / (1000 * 60 * 60));
      }
      return sum;
    }, 0);

    const weekOverWeekChange = {
      kmChange: weeklyStats.totalKm - previousWeekKm,
      kmPercentChange: previousWeekKm > 0 ? 
        ((weeklyStats.totalKm - previousWeekKm) / previousWeekKm * 100) : 0,
      hoursChange: weeklyStats.totalActiveHours - previousWeekHours,
      hoursPercentChange: previousWeekHours > 0 ? 
        ((weeklyStats.totalActiveHours - previousWeekHours) / previousWeekHours * 100) : 0
    };

    // Get user info
    const userInfo = sessions.length > 0 ? sessions[0].user : await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        username: true,
        region: region ? {
          select: {
            id: true,
            name: true
          }
        } : false
      }
    });

    // Prepare response
    const response = {
      weekStart: weeklyStats.weekStart,
      weekEnd: weeklyStats.weekEnd,
      user: userInfo,
      stats: {
        ...weeklyStats,
        dailyBreakdown,
        performance: {
          bestDay: {
            day: bestDay.dayName,
            date: bestDay.date,
            totalKm: bestDay.totalKm,
            sessions: bestDay.sessions
          },
          worstDay: {
            day: worstDay.dayName,
            date: worstDay.date,
            totalKm: worstDay.totalKm,
            sessions: worstDay.sessions
          },
          consistency: calculateConsistencyScore(dailyBreakdown),
          workingDays: completedDays.length
        },
        comparison: {
          previousWeek: {
            totalKm: Math.round(previousWeekKm * 1000) / 1000,
            totalHours: Math.round(previousWeekHours * 100) / 100,
            sessions: previousWeekSessions.length
          },
          weekOverWeek: {
            kmChange: Math.round(weekOverWeekChange.kmChange * 1000) / 1000,
            kmPercentChange: Math.round(weekOverWeekChange.kmPercentChange * 10) / 10,
            hoursChange: Math.round(weekOverWeekChange.hoursChange * 100) / 100,
            hoursPercentChange: Math.round(weekOverWeekChange.hoursPercentChange * 10) / 10
          }
        }
      },
      filters: {
        userId: targetUserId,
        weekStart: weeklyStats.weekStart,
        region: region
      }
    };

    // Add warnings if any
    if (validation.warnings.length > 0) {
      (response as Record<string, unknown>).warnings = validation.warnings;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Weekly GPS analytics error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to retrieve weekly GPS analytics'
      },
      { status: 500 }
    );
  }
}

// Helper functions
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

function calculateConsistencyScore(dailyBreakdown: Array<{ totalKm: number }>): number {
  const activeDays = dailyBreakdown.filter(day => day.totalKm > 0);
  
  if (activeDays.length === 0) return 0;
  if (activeDays.length === 1) return 50;
  
  // Calculate coefficient of variation (CV) for consistency
  const distances = activeDays.map(day => day.totalKm);
  const avg = distances.reduce((a, b) => a + b, 0) / distances.length;
  
  if (avg === 0) return 0;
  
  const variance = distances.reduce((sum, dist) => sum + Math.pow(dist - avg, 2), 0) / distances.length;
  const standardDeviation = Math.sqrt(variance);
  const cv = standardDeviation / avg;
  
  // Convert CV to consistency score (lower CV = higher consistency)
  // CV of 0 = 100 points, CV of 1 = 0 points
  const consistencyScore = Math.max(0, 100 - (cv * 100));
  
  return Math.round(consistencyScore * 10) / 10;
}
