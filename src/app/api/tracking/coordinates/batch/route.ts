import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sanitizeCoordinate } from '@/lib/gps-validation';
import { calculateTotalDistance, filterByAccuracy } from '@/lib/gps-utils';
import { getAuthenticatedUser, errorResponse, logError } from '@/lib/api-utils';

interface BatchUploadStats {
  totalReceived: number;
  totalProcessed: number;
  totalSkipped: number;
  distanceAdded: number;
  errors: string[];
  warnings: string[];
  processingTime: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Support JWT (mobile) and session (web)
    const user = await getAuthenticatedUser(request);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    // Parse request body
    const body = await request.json();
    const { sessionId, coordinates, syncToken } = body;

    // Validate basic request structure
    if (!sessionId || !Array.isArray(coordinates)) {
      return NextResponse.json(
        { error: 'Session ID and coordinates array are required' },
        { status: 400 }
      );
    }

    // Check for reasonable batch size
    if (coordinates.length > 5000) {
      return NextResponse.json(
        { error: 'Batch size too large. Maximum 5000 coordinates per request.' },
        { status: 413 }
      );
    }

    if (coordinates.length === 0) {
      return NextResponse.json(
        { error: 'Empty coordinates array' },
        { status: 400 }
      );
    }

    // Initialize batch upload stats
    const stats: BatchUploadStats = {
      totalReceived: coordinates.length,
      totalProcessed: 0,
      totalSkipped: 0,
      distanceAdded: 0,
      errors: [],
      warnings: [],
      processingTime: 0
    };

    // Verify session exists and belongs to user
    const gpsSession = await prisma.gPSSession.findUnique({
      where: { id: sessionId },
      include: {
        user: { select: { leadMrId: true } },
        gpsLogs: {
          orderBy: { timestamp: 'desc' },
          take: 1
        }
      }
    });

    if (!gpsSession) {
      return NextResponse.json(
        { error: 'GPS session not found' },
        { status: 404 }
      );
    }

    if (gpsSession.userId !== user.id && !(user.role === 'ADMIN' || (user.role === 'LEAD_MR' && gpsSession.user?.leadMrId === user.id))) {
      return errorResponse('FORBIDDEN', 'Unauthorized - not your session', 403);
    }

    // Check if session is still active
    if (gpsSession.checkOut) {
      return NextResponse.json(
        { error: 'Cannot add coordinates to closed session' },
        { status: 400 }
      );
    }

    // Process coordinates in chunks for better performance
    const chunkSize = 500;
    let totalDistance = 0;
    let lastCoordinate = gpsSession.gpsLogs.length > 0 ? {
      latitude: gpsSession.gpsLogs[0].latitude,
      longitude: gpsSession.gpsLogs[0].longitude,
      timestamp: gpsSession.gpsLogs[0].timestamp
    } : null;

    // Process coordinates in chunks
    for (let i = 0; i < coordinates.length; i += chunkSize) {
      const chunk = coordinates.slice(i, i + chunkSize);
      
      try {
        const result = await processCoordinateChunk(
          chunk,
          sessionId,
          lastCoordinate
        );
        
        stats.totalProcessed += result.processed;
        stats.totalSkipped += result.skipped;
        stats.distanceAdded += result.distanceAdded;
        stats.errors.push(...result.errors);
        stats.warnings.push(...result.warnings);
        
        // Update last coordinate for next chunk
        if (result.lastCoordinate) {
          lastCoordinate = result.lastCoordinate;
        }
        
        totalDistance += result.distanceAdded;
        
      } catch (chunkError) {
        // console.error(`Error processing chunk ${i}-${i + chunkSize}:`, chunkError);
        stats.errors.push(`Chunk ${i}-${i + chunkSize}: ${chunkError}`);
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

      // Update daily summary
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
        logError(summaryError, 'POST /api/tracking/coordinates/batch - dailySummary', user.id);
        stats.warnings.push('Failed to update daily summary');
      }
    }

    // Calculate processing statistics
    stats.processingTime = Date.now() - startTime;
    const processingRate = stats.totalProcessed / (stats.processingTime / 1000);

    // Prepare response
    const response = {
      success: true,
      sessionId: sessionId,
      stats: {
        ...stats,
        distanceAdded: Math.round(stats.distanceAdded * 1000) / 1000,
        processingRate: Math.round(processingRate * 10) / 10, // coordinates per second
        successRate: ((stats.totalProcessed / stats.totalReceived) * 100).toFixed(1) + '%'
      },
      syncStatus: {
        syncToken: syncToken || null,
        timestamp: new Date().toISOString(),
        nextSyncRecommended: Date.now() + (30 * 1000) // 30 seconds from now
      }
    };

    // Add performance warnings
    if (stats.processingTime > 30000) { // 30 seconds
      stats.warnings.push('Slow batch processing - consider smaller batch sizes');
    }

    if (stats.totalSkipped / stats.totalReceived > 0.5) {
      stats.warnings.push('High skip rate - check GPS accuracy settings');
    }

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    logError(error, 'POST /api/tracking/coordinates/batch');
    return errorResponse('INTERNAL_SERVER_ERROR', 'Failed to process batch GPS coordinates', 500);
  }
}

// Helper function to process coordinate chunks
async function processCoordinateChunk(
  coordinates: Array<Record<string, unknown>>,
  sessionId: string,
  lastCoordinate: { latitude: number; longitude: number; timestamp: Date } | null
): Promise<{
  processed: number;
  skipped: number;
  distanceAdded: number;
  errors: string[];
  warnings: string[];
  lastCoordinate: { latitude: number; longitude: number; timestamp: Date } | null;
}> {
  const result = {
    processed: 0,
    skipped: 0,
    distanceAdded: 0,
    errors: [] as string[],
    warnings: [] as string[],
    lastCoordinate: lastCoordinate
  };

  // Sanitize coordinates
  const sanitizedCoords = [];
  for (let i = 0; i < coordinates.length; i++) {
    const coord = sanitizeCoordinate(coordinates[i]);
    if (coord) {
      // Add index for tracking
      (coord as unknown as Record<string, unknown>).originalIndex = i;
      sanitizedCoords.push(coord);
    } else {
      result.skipped++;
    }
  }

  if (sanitizedCoords.length === 0) {
    return result;
  }

  // Filter by accuracy
  const filteredCoords = filterByAccuracy(sanitizedCoords);
  result.skipped += (sanitizedCoords.length - filteredCoords.length);

  if (filteredCoords.length === 0) {
    return result;
  }

  // Sort by timestamp to ensure proper ordering
  filteredCoords.sort((a, b) => {
    const timeA = a.timestamp ? a.timestamp.getTime() : Date.now();
    const timeB = b.timestamp ? b.timestamp.getTime() : Date.now();
    return timeA - timeB;
  });

  // Calculate distance if we have a previous coordinate
  let cumulativeDistance = 0;
  if (lastCoordinate && filteredCoords.length > 0) {
    const coordsWithLast = [lastCoordinate, ...filteredCoords];
    cumulativeDistance = calculateTotalDistance(coordsWithLast) - 
      (lastCoordinate ? calculateTotalDistance([lastCoordinate]) : 0);
  } else if (filteredCoords.length > 1) {
    cumulativeDistance = calculateTotalDistance(filteredCoords);
  }

  // Prepare GPS logs for batch insert
  const gpsLogsToCreate = filteredCoords.map(coord => ({
    sessionId: sessionId,
    latitude: coord.latitude,
    longitude: coord.longitude,
    timestamp: coord.timestamp || new Date(),
    accuracy: coord.accuracy,
    speed: coord.speed,
    altitude: coord.altitude
  }));

  try {
    // Batch insert GPS logs
    const insertResult = await prisma.gPSLog.createMany({
      data: gpsLogsToCreate
    });

    result.processed = insertResult.count;
    result.distanceAdded = cumulativeDistance;
    
    // Update last coordinate
    if (filteredCoords.length > 0) {
      const lastFiltered = filteredCoords[filteredCoords.length - 1];
      result.lastCoordinate = {
        latitude: lastFiltered.latitude,
        longitude: lastFiltered.longitude,
        timestamp: lastFiltered.timestamp || new Date()
      };
    }

  } catch (dbError) {
  // console.error('Database error in batch coordinate processing:', dbError);
    result.errors.push(`Database error: ${dbError}`);
  }

  return result;
}

// GET method for batch upload status
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

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Get session info and recent upload activity
    const gpsSession = await prisma.gPSSession.findUnique({
      where: { id: sessionId },
      include: {
        gpsLogs: {
          select: {
            timestamp: true
          },
          orderBy: { timestamp: 'desc' },
          take: 10
        },
        _count: {
          select: {
            gpsLogs: true
          }
        }
      }
    });

    if (!gpsSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (gpsSession.userId !== session.user.id && !(session.user.role === 'ADMIN' || (session.user.role === 'LEAD_MR' && (gpsSession as { user?: { leadMrId?: string | null } }).user?.leadMrId === session.user.id))) {
      return NextResponse.json(
        { error: 'Unauthorized - not your session' },
        { status: 403 }
      );
    }

    // Calculate upload statistics
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const recentUploads = gpsSession.gpsLogs.filter(log => log.timestamp > fiveMinutesAgo);

    return NextResponse.json({
      sessionId: sessionId,
      status: gpsSession.checkOut ? 'completed' : 'active',
      totalCoordinates: gpsSession._count.gpsLogs,
      recentActivity: {
        lastUpload: gpsSession.gpsLogs.length > 0 ? gpsSession.gpsLogs[0].timestamp : null,
        uploadsInLastFiveMinutes: recentUploads.length,
        averageUploadRate: recentUploads.length / 5 // per minute
      },
      recommendations: {
        nextSyncTime: new Date(Date.now() + 30 * 1000), // 30 seconds from now
        maxBatchSize: 1000,
        minAccuracy: parseFloat(process.env.GPS_ACCURACY_THRESHOLD || '10')
      }
    });

  } catch {
  // console.error('Batch upload status error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to get batch upload status'
      },
      { status: 500 }
    );
  }
}
