import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser, errorResponse } from '@/lib/api-utils';
import { calculateGodLevelRoute } from '@/lib/advanced-gps-engine';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== 'ADMIN') {
      return errorResponse('FORBIDDEN', 'Admin access required', 403);
    }

    const { force = false, limit = 50 } = await request.json();

    console.log('🔄 [BATCH-RECALC] Starting batch distance recalculation...');

    // Find sessions that need distance recalculation
    const whereConditions: any = {
      checkOut: { not: null }, // Only completed sessions
    };

    if (!force) {
      // Only recalculate sessions with 0 or null distance
      whereConditions.OR = [
        { totalKm: null },
        { totalKm: 0 },
        { totalKm: { lte: 0.001 } }, // Very small distances that might be calculation errors
      ];
    }

    const sessions = await prisma.gPSSession.findMany({
      where: whereConditions,
      include: {
        gpsLogs: {
          orderBy: { timestamp: 'asc' },
          select: {
            latitude: true,
            longitude: true,
            timestamp: true
          }
        },
        user: {
          select: {
            name: true,
            username: true
          }
        }
      },
      take: limit,
      orderBy: { checkIn: 'desc' }
    });

    console.log(`📊 [BATCH-RECALC] Found ${sessions.length} sessions to recalculate`);

    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [] as string[],
      details: [] as any[]
    };

    for (const session of sessions) {
      try {
        results.processed++;

        if (session.gpsLogs.length < 2) {
          console.log(`⚠️ [BATCH-RECALC] Session ${session.id} has insufficient GPS data (${session.gpsLogs.length} points)`);
          results.errors.push(`Session ${session.id}: Insufficient GPS data (${session.gpsLogs.length} points)`);
          results.failed++;
          continue;
        }

        const coordinates = session.gpsLogs.map(log => ({
          latitude: log.latitude,
          longitude: log.longitude,
          timestamp: log.timestamp
        }));

        console.log(`🧠 [BATCH-RECALC] Processing session ${session.id} (${session.user.name}) with ${coordinates.length} GPS points...`);

        // Use god-level routing engine
        const result = await calculateGodLevelRoute(coordinates);

        if (!result.success) {
          throw new Error(result.error || 'Route calculation failed');
        }

        // Update the session with new route data
        const updatedSession = await prisma.gPSSession.update({
          where: { id: session.id },
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
              batchRecalculation: true
            })
          }
        });

        results.successful++;
        results.details.push({
          sessionId: session.id,
          userName: session.user.name,
          originalDistance: session.totalKm,
          newDistance: result.distance,
          duration: result.duration,
          method: result.method,
          accuracy: result.optimizations?.accuracy,
          gpsPoints: coordinates.length,
          optimizedPoints: result.optimizations?.processedPoints
        });

        console.log(`✅ [BATCH-RECALC] Session ${session.id} updated: ${result.distance.toFixed(3)}km (${result.method})`);

        // Add small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ [BATCH-RECALC] Failed to recalculate session ${session.id}:`, error);
        results.failed++;
        results.errors.push(`Session ${session.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`🏁 [BATCH-RECALC] Batch recalculation complete!`);
    console.log(`   📊 Processed: ${results.processed}`);
    console.log(`   ✅ Successful: ${results.successful}`);
    console.log(`   ❌ Failed: ${results.failed}`);

    return NextResponse.json({
      message: 'Batch distance recalculation completed',
      summary: {
        processed: results.processed,
        successful: results.successful,
        failed: results.failed,
        errorCount: results.errors.length
      },
      errors: results.errors,
      details: results.details,
      completedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [BATCH-RECALC] Batch recalculation failed:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to perform batch recalculation'
      },
      { status: 500 }
    );
  }
}
