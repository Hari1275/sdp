import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { validateAnalyticsQuery } from '@/lib/gps-validation';
import { calculateMonthlyGPSStats } from '@/lib/gps-analytics';

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
    const monthParam = searchParams.get('month');
    const yearParam = searchParams.get('year');
    const region = searchParams.get('region');

    // Default to current month if not specified
    const now = new Date();
    const targetMonth = monthParam ? parseInt(monthParam) : now.getMonth() + 1;
    const targetYear = yearParam ? parseInt(yearParam) : now.getFullYear();

    // Validate month and year
    if (targetMonth < 1 || targetMonth > 12) {
      return NextResponse.json(
        { error: 'Month must be between 1 and 12' },
        { status: 400 }
      );
    }

    if (targetYear < 2020 || targetYear > new Date().getFullYear() + 1) {
      return NextResponse.json(
        { error: 'Invalid year specified' },
        { status: 400 }
      );
    }

    // Create date range for the month
    const monthStart = new Date(targetYear, targetMonth - 1, 1);
    const monthEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    // Validate query parameters
    const queryData = {
      userId: userId || undefined,
      dateFrom: monthStart,
      dateTo: monthEnd,
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

    // Build query conditions
    const whereConditions: Record<string, unknown> = {
      userId: targetUserId,
      checkIn: {
        gte: monthStart,
        lte: monthEnd
      }
    };

    // Add region filter if specified
    if (region) {
      whereConditions.user = {
        regionId: region
      };
    }

    // Get GPS sessions for the month
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

    // Calculate monthly statistics
    const monthlyStats = calculateMonthlyGPSStats(
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
      targetMonth,
      targetYear
    );

    // Calculate month-over-month comparison
    const previousMonth = targetMonth === 1 ? 12 : targetMonth - 1;
    const previousYear = targetMonth === 1 ? targetYear - 1 : targetYear;
    
    const previousMonthStart = new Date(previousYear, previousMonth - 1, 1);
    const previousMonthEnd = new Date(previousYear, previousMonth, 0, 23, 59, 59, 999);

    const previousMonthSessions = await prisma.gPSSession.findMany({
      where: {
        userId: targetUserId,
        checkIn: {
          gte: previousMonthStart,
          lte: previousMonthEnd
        },
        checkOut: { not: null }
      },
      select: {
        totalKm: true,
        checkIn: true,
        checkOut: true
      }
    });

    const previousMonthKm = previousMonthSessions.reduce((sum, s) => sum + (s.totalKm || 0), 0);
    const previousMonthHours = previousMonthSessions.reduce((sum, s) => {
      if (s.checkOut) {
        return sum + ((s.checkOut.getTime() - s.checkIn.getTime()) / (1000 * 60 * 60));
      }
      return sum;
    }, 0);

    const monthOverMonthChange = {
      kmChange: monthlyStats.totalKm - previousMonthKm,
      kmPercentChange: previousMonthKm > 0 ? 
        ((monthlyStats.totalKm - previousMonthKm) / previousMonthKm * 100) : 0,
      hoursChange: monthlyStats.totalActiveHours - previousMonthHours,
      hoursPercentChange: previousMonthHours > 0 ? 
        ((monthlyStats.totalActiveHours - previousMonthHours) / previousMonthHours * 100) : 0
    };

    // Calculate monthly trends
    const trends = calculateMonthlyTrends({ weeklyStats: monthlyStats.weeklyStats });

    // Calculate working days and efficiency metrics
    const workingDays = sessions.filter(s => s.checkOut).length;
    const avgDailyDistance = workingDays > 0 ? monthlyStats.totalKm / workingDays : 0;
    const monthDays = new Date(targetYear, targetMonth, 0).getDate();
    const utilizationRate = (workingDays / monthDays) * 100;

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
      month: targetMonth,
      year: targetYear,
      monthName: getMonthName(targetMonth),
      user: userInfo,
      stats: {
        ...monthlyStats,
        performance: {
          workingDays,
          totalDays: monthDays,
          utilizationRate: Math.round(utilizationRate * 10) / 10,
          avgDailyDistance: Math.round(avgDailyDistance * 1000) / 1000,
          peakWeekPerformance: monthlyStats.peakWeek.totalKm > 0 ? {
            week: monthlyStats.peakWeek.weekStart,
            distance: monthlyStats.peakWeek.totalKm,
            percentage: monthlyStats.totalKm > 0 ? 
              Math.round((monthlyStats.peakWeek.totalKm / monthlyStats.totalKm) * 100 * 10) / 10 : 0
          } : null
        },
        trends,
        comparison: {
          previousMonth: {
            month: previousMonth,
            year: previousYear,
            monthName: getMonthName(previousMonth),
            totalKm: Math.round(previousMonthKm * 1000) / 1000,
            totalHours: Math.round(previousMonthHours * 100) / 100,
            sessions: previousMonthSessions.length
          },
          monthOverMonth: {
            kmChange: Math.round(monthOverMonthChange.kmChange * 1000) / 1000,
            kmPercentChange: Math.round(monthOverMonthChange.kmPercentChange * 10) / 10,
            hoursChange: Math.round(monthOverMonthChange.hoursChange * 100) / 100,
            hoursPercentChange: Math.round(monthOverMonthChange.hoursPercentChange * 10) / 10
          }
        }
      },
      filters: {
        userId: targetUserId,
        month: targetMonth,
        year: targetYear,
        region: region
      }
    };

    // Add warnings if any
    if (validation.warnings.length > 0) {
      (response as Record<string, unknown>).warnings = validation.warnings;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Monthly GPS analytics error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to retrieve monthly GPS analytics'
      },
      { status: 500 }
    );
  }
}

// Helper functions
function getMonthName(month: number): string {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return monthNames[month - 1];
}

function calculateMonthlyTrends(monthlyStats: { weeklyStats: Array<{ totalKm: number; totalActiveHours: number; avgEfficiency: number }> }): {
  distanceTrend: 'increasing' | 'decreasing' | 'stable';
  efficiencyTrend: 'improving' | 'declining' | 'stable';
  consistencyTrend: 'improving' | 'declining' | 'stable';
} {
  const { weeklyStats } = monthlyStats;
  if (weeklyStats.length < 2) {
    return {
      distanceTrend: 'stable',
      efficiencyTrend: 'stable',
      consistencyTrend: 'stable'
    };
  }

  // Calculate distance trend
  const firstWeek = weeklyStats[0];
  const lastWeek = weeklyStats[weeklyStats.length - 1];
  
  const distanceChange = lastWeek.totalKm - firstWeek.totalKm;
  const distanceChangePercent = firstWeek.totalKm > 0 ? 
    (distanceChange / firstWeek.totalKm) * 100 : 0;

  // Calculate efficiency trend
  const efficiencyChange = lastWeek.avgEfficiency - firstWeek.avgEfficiency;

  // Calculate consistency (based on variance between weeks)
  const weeklyDistances = weeklyStats.map(w => w.totalKm);
  const firstHalf = weeklyDistances.slice(0, Math.ceil(weeklyDistances.length / 2));
  const secondHalf = weeklyDistances.slice(Math.floor(weeklyDistances.length / 2));

  const firstHalfVariance = calculateVariance(firstHalf);
  const secondHalfVariance = calculateVariance(secondHalf);
  const consistencyImprovement = firstHalfVariance > secondHalfVariance;

  return {
    distanceTrend: Math.abs(distanceChangePercent) < 5 ? 'stable' : 
                  distanceChangePercent > 0 ? 'increasing' : 'decreasing',
    efficiencyTrend: Math.abs(efficiencyChange) < 2 ? 'stable' :
                    efficiencyChange > 0 ? 'improving' : 'declining',
    consistencyTrend: firstHalf.length < 2 || secondHalf.length < 2 ? 'stable' :
                     consistencyImprovement ? 'improving' : 'declining'
  };
}

function calculateVariance(numbers: number[]): number {
  if (numbers.length < 2) return 0;
  
  const avg = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const variance = numbers.reduce((sum, num) => sum + Math.pow(num - avg, 2), 0) / numbers.length;
  
  return variance;
}
