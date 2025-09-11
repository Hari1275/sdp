const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function calculateGodLevelRouteNode(coordinates) {
  // Simple fallback distance calculation using Haversine formula
  function calculateDistance(coord1, coord2) {
    const R = 6371.0088; // Earth's radius in km
    const lat1Rad = coord1.latitude * Math.PI / 180;
    const lat2Rad = coord2.latitude * Math.PI / 180;
    const deltaLatRad = (coord2.latitude - coord1.latitude) * Math.PI / 180;
    const deltaLngRad = (coord2.longitude - coord1.longitude) * Math.PI / 180;
    
    const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
             Math.cos(lat1Rad) * Math.cos(lat2Rad) *
             Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  if (coordinates.length < 2) return { distance: 0, method: 'insufficient_data' };

  let totalDistance = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    totalDistance += calculateDistance(coordinates[i], coordinates[i + 1]);
  }

  return { 
    distance: totalDistance, 
    method: 'haversine_script',
    duration: totalDistance * 2 // Estimate: 2 minutes per km
  };
}

async function fixDistances() {
  console.log('🔧 [FIX-DISTANCES] Starting distance fix for sessions...');

  try {
    // Find sessions with zero or null totalKm
    const sessions = await prisma.gPSSession.findMany({
      where: {
        checkOut: { not: null }, // Only completed sessions
        OR: [
          { totalKm: null },
          { totalKm: 0 },
          { totalKm: { lte: 0.001 } }
        ]
      },
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
      take: 50 // Limit to avoid overwhelming the system
    });

    console.log(`📊 [FIX-DISTANCES] Found ${sessions.length} sessions to fix`);

    let successful = 0;
    let failed = 0;

    for (const session of sessions) {
      try {
        if (session.gpsLogs.length < 2) {
          console.log(`⚠️ [FIX-DISTANCES] Skipping session ${session.id}: insufficient GPS data (${session.gpsLogs.length} points)`);
          failed++;
          continue;
        }

        const coordinates = session.gpsLogs.map(log => ({
          latitude: log.latitude,
          longitude: log.longitude,
          timestamp: log.timestamp
        }));

        console.log(`🧠 [FIX-DISTANCES] Processing session ${session.id} (${session.user.name}) with ${coordinates.length} GPS points...`);

        const result = await calculateGodLevelRouteNode(coordinates);

        if (result.distance > 0) {
          await prisma.gPSSession.update({
            where: { id: session.id },
            data: {
              totalKm: result.distance,
              estimatedDuration: result.duration,
              calculationMethod: result.method,
              routeAccuracy: 'standard'
            }
          });

          console.log(`✅ [FIX-DISTANCES] Updated session ${session.id}: ${result.distance.toFixed(3)}km (${result.method})`);
          successful++;
        } else {
          console.log(`⚠️ [FIX-DISTANCES] Session ${session.id} calculated 0 distance`);
          failed++;
        }

      } catch (error) {
        console.error(`❌ [FIX-DISTANCES] Failed to fix session ${session.id}:`, error.message);
        failed++;
      }
    }

    console.log(`🏁 [FIX-DISTANCES] Distance fix complete!`);
    console.log(`   ✅ Successful: ${successful}`);
    console.log(`   ❌ Failed: ${failed}`);

  } catch (error) {
    console.error('❌ [FIX-DISTANCES] Script failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixDistances().catch(console.error);
