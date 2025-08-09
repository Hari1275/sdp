import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { validateCoordinateData, sanitizeCoordinate } from '@/lib/gps-validation';
import { calculateTotalDistance, filterByAccuracy } from '@/lib/gps-utils';

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
    const { sessionId, coordinates } = body;

    // Validate request data
    const validation = validateCoordinateData({ sessionId, coordinates });
    
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validation.errors
        },
        { status: 400 }
      );
    }

    // Verify session exists and belongs to user
    const gpsSession = await prisma.gPSSession.findUnique({
      where: { id: sessionId },
      include: {
        gpsLogs: {
          orderBy: { timestamp: 'desc' },
          take: 1 // Get the latest log for distance calculation
        }
      }
    });

    if (!gpsSession) {
      return NextResponse.json(
        { error: 'GPS session not found' },
        { status: 404 }
      );
    }

    if (gpsSession.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized - not your session' },
        { status: 403 }
      );
    }

    // Check if session is still active
    if (gpsSession.checkOut) {
      return NextResponse.json(
        { error: 'Cannot add coordinates to closed session' },
        { status: 400 }
      );
    }

    // Sanitize and filter coordinates
    const sanitizedCoords = coordinates
      .map((coord: Record<string, unknown>) => sanitizeCoordinate(coord))
      .filter((coord: Record<string, unknown> | null): coord is Record<string, unknown> => coord !== null);

    if (sanitizedCoords.length === 0) {
      return NextResponse.json(
        { error: 'No valid coordinates provided' },
        { status: 400 }
      );
    }

    // Filter by accuracy threshold
    const filteredCoords = filterByAccuracy(sanitizedCoords);

    let processedCount = 0;
    let totalDistance = 0;
    const errors: string[] = [];

    // Create GPS logs in batch
    const gpsLogsToCreate = filteredCoords.map(coord => ({
      sessionId: gpsSession.id,
      latitude: coord.latitude,
      longitude: coord.longitude,
      timestamp: coord.timestamp || new Date(),
      accuracy: coord.accuracy,
      speed: coord.speed,
      altitude: coord.altitude
    }));

    try {
      // Insert GPS logs
      const result = await prisma.gPSLog.createMany({
        data: gpsLogsToCreate
      });

      processedCount = result.count;

      // Calculate distance increment if we have previous coordinates
      if (gpsSession.gpsLogs.length > 0 && filteredCoords.length > 0) {
        const lastKnownCoord = {
          latitude: gpsSession.gpsLogs[0].latitude,
          longitude: gpsSession.gpsLogs[0].longitude
        };

        // Calculate distance from last known point to first new point
        const firstNewCoord = filteredCoords[0];
        const distanceToFirst = calculateTotalDistance([lastKnownCoord, firstNewCoord]);
        
        // Calculate distance between new coordinates
        const distanceBetweenNew = calculateTotalDistance(filteredCoords);
        
        totalDistance = distanceToFirst + distanceBetweenNew;
      } else if (filteredCoords.length > 1) {
        // First coordinates for this session
        totalDistance = calculateTotalDistance(filteredCoords);
      }

      // Update session with new total distance
      if (totalDistance > 0) {
        await prisma.gPSSession.update({
          where: { id: sessionId },
          data: {
            totalKm: {
              increment: totalDistance
            }
          }
        });
      }

    } catch (dbError) {
      console.error('Database error in coordinate logging:', dbError);
      
      return NextResponse.json(
        { 
          error: 'Database error',
          message: 'Failed to save GPS coordinates'
        },
        { status: 500 }
      );
    }

    // Update daily summary
    if (totalDistance > 0) {
      const today = new Date();
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
              increment: totalDistance
            }
          },
          create: {
            mrId: session.user.id,
            date: today,
            totalKms: totalDistance,
            totalHours: 0,
            totalVisits: 0,
            totalBusiness: 0,
            checkInCount: 0
          }
        });
      } catch (summaryError) {
        // Log but don't fail the request
        console.error('Failed to update daily summary:', summaryError);
      }
    }

    // Prepare response
    const response = {
      success: true,
      processed: processedCount,
      filtered: coordinates.length - sanitizedCoords.length, // Invalid coordinates filtered out
      accuracyFiltered: sanitizedCoords.length - filteredCoords.length, // Filtered by accuracy threshold
      distanceAdded: Math.round(totalDistance * 1000) / 1000,
      sessionId: sessionId
    };

    // Add warnings if any
    if (validation.warnings.length > 0) {
      (response as Record<string, unknown>).warnings = validation.warnings;
    }

    if (errors.length > 0) {
      (response as Record<string, unknown>).processingErrors = errors;
    }

    // Add filtering info if coordinates were filtered
    if (coordinates.length > filteredCoords.length) {
      (response as Record<string, unknown>).filteringInfo = {
        originalCount: coordinates.length,
        validCount: sanitizedCoords.length,
        processedCount: filteredCoords.length,
        accuracyThreshold: parseFloat(process.env.GPS_ACCURACY_THRESHOLD || '10')
      };
    }

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('GPS coordinate logging error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to log GPS coordinates'
      },
      { status: 500 }
    );
  }
}

// GET method to retrieve GPS logs for a session
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
    const sessionId = searchParams.get('sessionId');
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');
    const limit = parseInt(searchParams.get('limit') || '1000');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Verify session ownership
    const gpsSession = await prisma.gPSSession.findUnique({
      where: { id: sessionId },
      select: { userId: true, checkIn: true, checkOut: true }
    });

    if (!gpsSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Check access permissions
    const hasAccess = gpsSession.userId === session.user.id || 
                     session.user.role === 'ADMIN' || 
                     session.user.role === 'LEAD_MR';

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Build query conditions
    const whereConditions: Record<string, unknown> = { sessionId };
    const timestampCondition: Record<string, unknown> = {};

    if (startTime) {
      timestampCondition.gte = new Date(startTime);
    }

    if (endTime) {
      timestampCondition.lte = new Date(endTime);
    }

    if (Object.keys(timestampCondition).length > 0) {
      whereConditions.timestamp = timestampCondition;
    }

    // Get GPS logs
    const [gpsLogs, totalCount] = await Promise.all([
      prisma.gPSLog.findMany({
        where: whereConditions,
        orderBy: { timestamp: 'asc' },
        skip: offset,
        take: Math.min(limit, 5000), // Cap at 5000 for performance
        select: {
          id: true,
          latitude: true,
          longitude: true,
          timestamp: true,
          accuracy: true,
          speed: true,
          altitude: true
        }
      }),
      prisma.gPSLog.count({ where: whereConditions })
    ]);

    // Calculate session stats
    const sessionStats = {
      sessionId: sessionId,
      checkIn: gpsSession.checkIn,
      checkOut: gpsSession.checkOut,
      totalCoordinates: totalCount,
      returnedCoordinates: gpsLogs.length,
      hasMore: offset + gpsLogs.length < totalCount
    };

    return NextResponse.json({
      ...sessionStats,
      coordinates: gpsLogs,
      pagination: {
        offset,
        limit,
        totalCount,
        hasMore: sessionStats.hasMore
      }
    });

  } catch (error) {
    console.error('GPS coordinate retrieval error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to retrieve GPS coordinates'
      },
      { status: 500 }
    );
  }
}
