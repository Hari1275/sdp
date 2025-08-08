import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { validateAnalyticsQuery } from '@/lib/gps-validation';
import { calculateDailyGPSStats } from '@/lib/gps-analytics';

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
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const region = searchParams.get('region');

    // Validate query parameters
    const queryData = {
      userId: userId || undefined,
      dateFrom: new Date(date),
      dateTo: new Date(date),
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

    // Parse target date
    const targetDate = new Date(date);
    
    // Set up date range for the day
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Build query conditions
    const whereConditions: any = {
      userId: targetUserId,
      checkIn: {
        gte: dayStart,
        lte: dayEnd
      }
    };

    // Add region filter if specified
    if (region) {
      whereConditions.user = {
        regionId: region
      };
    }

    // Get GPS sessions for the day
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

    // Calculate daily statistics
    const dailyStats = calculateDailyGPSStats(
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
      targetDate
    );

    // Calculate additional metrics
    const completedSessions = sessions.filter(s => s.checkOut);
    const activeSessions = sessions.filter(s => !s.checkOut);
    
    // Calculate business hours (8 AM to 6 PM)
    const businessHoursSessions = sessions.filter(s => {
      const hour = s.checkIn.getHours();
      return hour >= 8 && hour < 18;
    });

    // Calculate distance by time periods
    const morningDistance = sessions
      .filter(s => s.checkIn.getHours() < 12)
      .reduce((sum, s) => sum + (s.totalKm || 0), 0);
    
    const afternoonDistance = sessions
      .filter(s => s.checkIn.getHours() >= 12)
      .reduce((sum, s) => sum + (s.totalKm || 0), 0);

    // Get user info for response
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
      date: date,
      user: userInfo,
      stats: {
        ...dailyStats,
        completedSessions: completedSessions.length,
        activeSessions: activeSessions.length,
        businessHoursSessions: businessHoursSessions.length,
        periodBreakdown: {
          morning: {
            sessions: sessions.filter(s => s.checkIn.getHours() < 12).length,
            totalKm: Math.round(morningDistance * 1000) / 1000
          },
          afternoon: {
            sessions: sessions.filter(s => s.checkIn.getHours() >= 12).length,
            totalKm: Math.round(afternoonDistance * 1000) / 1000
          }
        }
      },
      sessions: sessions.map(s => ({
        id: s.id,
        checkIn: s.checkIn,
        checkOut: s.checkOut,
        totalKm: s.totalKm || 0,
        duration: s.checkOut ? 
          Math.round(((s.checkOut.getTime() - s.checkIn.getTime()) / (1000 * 60 * 60)) * 100) / 100 : 0,
        coordinateCount: s.gpsLogs.length
      })),
      filters: {
        userId: targetUserId,
        date: date,
        region: region
      }
    };

    // Add warnings if any
    if (validation.warnings.length > 0) {
      (response as any).warnings = validation.warnings;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Daily GPS analytics error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to retrieve daily GPS analytics'
      },
      { status: 500 }
    );
  }
}
