import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateCoordinateData, sanitizeCoordinate } from '@/lib/gps-validation';
import { calculateTotalDistance, filterByAccuracy } from '@/lib/gps-utils';
import { calculateGodLevelRoute } from '@/lib/advanced-gps-engine';
import { getAuthenticatedUser, errorResponse, logError } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    // Auth supports both JWT (mobile) and session (web)
    const user = await getAuthenticatedUser(request);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    // Parse request body
    const body = await request.json();
    const { sessionId, coordinates } = body;

    // Basic input validation
    if (!sessionId) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: ['Session ID is required']
        },
        { status: 400 }
      );
    }

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: ['Coordinates array is required and must not be empty']
        },
        { status: 400 }
      );
    }

    // Validate request data
    const validation = validateCoordinateData({ sessionId, coordinates });
    
    if (!validation.isValid) {
      console.log('Validation failed:', validation.errors);
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validation.errors,
          warnings: validation.warnings || []
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

    if (gpsSession.userId !== user.id) {
      return errorResponse('FORBIDDEN', 'Unauthorized - not your session', 403);
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
      .filter((coord): coord is NonNullable<typeof coord> => coord !== null);

    if (sanitizedCoords.length === 0) {
      return NextResponse.json(
        { error: 'No valid coordinates provided' },
        { status: 400 }
      );
    }

    // Filter by accuracy threshold
    const filteredCoords = filterByAccuracy(sanitizedCoords);
    
    console.log(`Coordinate filtering: ${coordinates.length} -> ${sanitizedCoords.length} -> ${filteredCoords.length}`);
    console.log(`Accuracy threshold: ${parseFloat(process.env.GPS_ACCURACY_THRESHOLD || '50')}m`);

    // If accuracy filtering removes all coordinates, use the best available ones
    let coordsToProcess = filteredCoords;
    if (filteredCoords.length === 0 && sanitizedCoords.length > 0) {
      console.warn('All coordinates filtered by accuracy, using best available coordinates');
      // Sort by accuracy (ascending) and take the best ones
      coordsToProcess = sanitizedCoords
        .filter(coord => coord.accuracy !== undefined)
        .sort((a, b) => (a.accuracy || 0) - (b.accuracy || 0))
        .slice(0, Math.min(5, sanitizedCoords.length)); // Take up to 5 best coordinates
      
      // If still no coordinates with accuracy, take all sanitized coordinates
      if (coordsToProcess.length === 0) {
        coordsToProcess = sanitizedCoords;
      }
    }

    if (coordsToProcess.length === 0) {
      return NextResponse.json(
        { error: 'No valid coordinates after filtering and sanitization' },
        { status: 400 }
      );
    }

    let processedCount = 0;
    let totalDistance = 0;
    let calculationMethod: string = 'haversine';
    const errors: string[] = [];

    // Create GPS logs in batch
    const gpsLogsToCreate = coordsToProcess.map(coord => {
      const logData: {
        sessionId: string;
        latitude: number;
        longitude: number;
        timestamp: Date;
        accuracy?: number;
        speed?: number;
        altitude?: number;
      } = {
        sessionId: gpsSession.id,
        latitude: Number(coord.latitude),
        longitude: Number(coord.longitude),
        timestamp: coord.timestamp ? new Date(coord.timestamp) : new Date()
      };
      
      // Only include optional fields if they have valid values
      if (coord.accuracy !== undefined && coord.accuracy !== null && !isNaN(Number(coord.accuracy))) {
        logData.accuracy = Number(coord.accuracy);
      }
      
      if (coord.speed !== undefined && coord.speed !== null && !isNaN(Number(coord.speed))) {
        logData.speed = Number(coord.speed);
      }
      
      if (coord.altitude !== undefined && coord.altitude !== null && !isNaN(Number(coord.altitude))) {
        logData.altitude = Number(coord.altitude);
      }
      
      return logData;
    });

    try {
      // Validate GPS logs data before insertion
      console.log('Attempting to insert', gpsLogsToCreate.length, 'GPS logs');
      console.log('Sample GPS log data:', gpsLogsToCreate[0]);
      
      // Insert GPS logs
      const result = await prisma.gPSLog.createMany({
        data: gpsLogsToCreate
      });

      processedCount = result.count;
      console.log('Successfully inserted', processedCount, 'GPS logs');

      // Calculate distance increment using Google Routes API with fallback

      if (gpsSession.gpsLogs.length > 0 && coordsToProcess.length > 0) {
        const lastKnownCoord = {
          latitude: gpsSession.gpsLogs[0].latitude,
          longitude: gpsSession.gpsLogs[0].longitude
        };

        try {
          // Use GOD-LEVEL routing engine for coordinate distance calculation
          const coordsToCalculate = [lastKnownCoord, ...coordsToProcess];
          console.log(`🧠 [COORDS-GOD-LEVEL] Calculating distance for ${coordsToCalculate.length} coordinates...`);
          
          const result = await calculateGodLevelRoute(coordsToCalculate);
          
          if (result.success) {
            totalDistance = result.distance;
            calculationMethod = result.method;
            
            console.log(`✅ [COORDS-GOD-LEVEL] Distance calculated using ${result.method}: ${totalDistance.toFixed(3)}km`);
            console.log(`   📈 Accuracy: ${result.optimizations.accuracy}`);
            console.log(`   🚀 Optimization: ${result.optimizations.originalPoints} → ${result.optimizations.processedPoints} points`);
            console.log(`   ⚡ Processing time: ${result.optimizations.calculationTime}ms`);
          } else {
            throw new Error(result.error || 'God-level routing failed');
          }
        } catch (error) {
          console.warn('❌ [COORDS-GOD-LEVEL] God-level routing failed, using Haversine fallback:', error);
          
          // Final fallback to Haversine calculation
          const firstNewCoord = coordsToProcess[0];
          const distanceToFirst = calculateTotalDistance([lastKnownCoord, firstNewCoord]);
          const distanceBetweenNew = calculateTotalDistance(coordsToProcess);
          totalDistance = distanceToFirst + distanceBetweenNew;
          calculationMethod = 'haversine_fallback';
        }
      } else if (coordsToProcess.length > 1) {
        try {
          // First coordinates for this session - use GOD-LEVEL routing engine
          console.log(`🧠 [COORDS-GOD-LEVEL-INIT] Calculating initial route for ${coordsToProcess.length} coordinates...`);
          
          const result = await calculateGodLevelRoute(coordsToProcess);
          
          if (result.success) {
            totalDistance = result.distance;
            calculationMethod = result.method;
            
            console.log(`✅ [COORDS-GOD-LEVEL-INIT] Initial distance calculated using ${result.method}: ${totalDistance.toFixed(3)}km`);
            console.log(`   📈 Accuracy: ${result.optimizations.accuracy}`);
            console.log(`   🚀 Optimization: ${result.optimizations.originalPoints} → ${result.optimizations.processedPoints} points`);
            console.log(`   ⚡ Processing time: ${result.optimizations.calculationTime}ms`);
          } else {
            throw new Error(result.error || 'God-level routing failed');
          }
        } catch (error) {
          console.warn('❌ [COORDS-GOD-LEVEL-INIT] God-level routing failed, using Haversine fallback:', error);
          totalDistance = calculateTotalDistance(coordsToProcess);
          calculationMethod = 'haversine_fallback';
          console.log(`✅ [COORDS-GOD-LEVEL-INIT] Haversine fallback distance: ${totalDistance.toFixed(3)}km`);
        }
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
        console.log('Updated session with total distance:', totalDistance);
      }

    } catch (dbError) {
      console.error('Database error in coordinate logging:', dbError);
      logError(dbError, 'POST /api/tracking/coordinates - database', user.id);
      
      return NextResponse.json(
        { 
          error: 'Database error',
          message: 'Failed to save GPS coordinates',
          details: dbError instanceof Error ? dbError.message : 'Unknown database error'
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
              mrId: user.id,
              date: today
            }
          },
          update: {
            totalKms: {
              increment: totalDistance
            }
          },
          create: {
            mrId: user.id,
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
        logError(summaryError, 'POST /api/tracking/coordinates - dailySummary', user.id);
      }
    }

    // Prepare response
    const response = {
      success: true,
      processed: processedCount,
      filtered: coordinates.length - sanitizedCoords.length, // Invalid coordinates filtered out
      accuracyFiltered: sanitizedCoords.length - coordsToProcess.length, // Filtered by accuracy threshold
      distanceAdded: Math.round(totalDistance * 1000) / 1000,
      distanceCalculationMethod: calculationMethod,
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
    if (coordinates.length > coordsToProcess.length) {
      (response as Record<string, unknown>).filteringInfo = {
        originalCount: coordinates.length,
        validCount: sanitizedCoords.length,
        processedCount: coordsToProcess.length,
        accuracyThreshold: parseFloat(process.env.GPS_ACCURACY_THRESHOLD || '50'),
        fallbackUsed: filteredCoords.length === 0 && coordsToProcess.length > 0
      };
    }

    return NextResponse.json(response, { status: 200 });

  } catch (err) {
    logError(err, 'POST /api/tracking/coordinates');
    return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to log GPS coordinates', 500);
  }
}

// GET method to retrieve GPS logs for a session
export async function GET(request: NextRequest) {
  try {
    // Auth supports both JWT (mobile) and session (web)
    const user = await getAuthenticatedUser(request);
    if (!user) {
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

    // Verify session ownership or team access for Lead MR
    const gpsSession = await prisma.gPSSession.findUnique({
      where: { id: sessionId },
      select: { userId: true, checkIn: true, checkOut: true, user: { select: { leadMrId: true } } }
    });

    if (!gpsSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Check access permissions
    const hasAccess = gpsSession.userId === user.id || 
                     user.role === 'ADMIN' || 
                     (user.role === 'LEAD_MR' && gpsSession.user?.leadMrId === user.id) ||
                     (user.role === 'MR' && gpsSession.userId === user.id);

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

  } catch {
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to retrieve GPS coordinates'
      },
      { status: 500 }
    );
  }
}
