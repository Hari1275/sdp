const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Generate realistic GPS coordinates for a route from one location to another
function generateRealisticRoute(startLat, startLng, endLat, endLng, numPoints = 20) {
  const coordinates = [];
  
  // Add some randomness to simulate real GPS tracking
  function addNoise(value, scale = 0.0001) {
    return value + (Math.random() - 0.5) * scale;
  }
  
  for (let i = 0; i < numPoints; i++) {
    const ratio = i / (numPoints - 1);
    const lat = startLat + (endLat - startLat) * ratio;
    const lng = startLng + (endLng - startLng) * ratio;
    
    coordinates.push({
      latitude: addNoise(lat),
      longitude: addNoise(lng),
      timestamp: new Date(Date.now() - (numPoints - i) * 5 * 60 * 1000) // 5 minutes apart
    });
  }
  
  return coordinates;
}

async function createTestSession() {
  console.log('🚀 [CREATE-TEST] Creating realistic test GPS session...');

  try {
    // Find a user to create the session for
    const user = await prisma.user.findFirst({
      where: { role: 'MR' }
    });

    if (!user) {
      console.error('❌ [CREATE-TEST] No MR user found');
      return;
    }

    console.log(`👤 [CREATE-TEST] Creating session for user: ${user.name}`);

    // Generate a realistic route (e.g., from one part of a city to another)
    // Delhi coordinates: Connaught Place to India Gate
    const startLat = 28.6307;
    const startLng = 77.2177;
    const endLat = 28.6129;
    const endLng = 77.2295;

    const routeCoordinates = generateRealisticRoute(startLat, startLng, endLat, endLng, 25);

    const checkInTime = routeCoordinates[0].timestamp;
    const checkOutTime = routeCoordinates[routeCoordinates.length - 1].timestamp;

    // Create the GPS session
    const session = await prisma.gPSSession.create({
      data: {
        userId: user.id,
        checkIn: checkInTime,
        checkOut: checkOutTime,
        startLat: routeCoordinates[0].latitude,
        startLng: routeCoordinates[0].longitude,
        endLat: routeCoordinates[routeCoordinates.length - 1].latitude,
        endLng: routeCoordinates[routeCoordinates.length - 1].longitude,
        totalKm: 0 // Will be calculated by the god-level engine
      }
    });

    console.log(`📍 [CREATE-TEST] Created session ${session.id}`);

    // Add GPS logs
    const gpsLogs = routeCoordinates.map(coord => ({
      sessionId: session.id,
      latitude: coord.latitude,
      longitude: coord.longitude,
      timestamp: coord.timestamp,
      accuracy: 5 + Math.random() * 10, // 5-15 meters accuracy
      speed: 20 + Math.random() * 30,   // 20-50 km/h speed
      altitude: 200 + Math.random() * 50 // 200-250m altitude
    }));

    await prisma.gPSLog.createMany({
      data: gpsLogs
    });

    console.log(`📊 [CREATE-TEST] Added ${gpsLogs.length} GPS points to session`);
    console.log(`⏰ [CREATE-TEST] Route duration: ${Math.round((checkOutTime - checkInTime) / 1000 / 60)} minutes`);
    console.log(`🗺️ [CREATE-TEST] Route: ${startLat.toFixed(4)},${startLng.toFixed(4)} → ${endLat.toFixed(4)},${endLng.toFixed(4)}`);

    // The system will automatically calculate the distance using god-level routing when accessed

    console.log('✅ [CREATE-TEST] Test session created successfully!');
    console.log(`   Session ID: ${session.id}`);
    console.log(`   User: ${user.name}`);
    console.log(`   GPS Points: ${gpsLogs.length}`);
    console.log('   💡 Distance will be calculated automatically when viewed in the dashboard');

  } catch (error) {
    console.error('❌ [CREATE-TEST] Failed to create test session:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Create multiple test sessions
async function createMultipleTestSessions() {
  console.log('🚀 [CREATE-TEST] Creating multiple realistic test sessions...');

  const testRoutes = [
    // Route 1: Delhi - Connaught Place to India Gate
    { 
      startLat: 28.6307, startLng: 77.2177, 
      endLat: 28.6129, endLng: 77.2295, 
      name: 'CP to India Gate' 
    },
    // Route 2: Delhi - Red Fort to Lotus Temple
    { 
      startLat: 28.6562, startLng: 77.2410, 
      endLat: 28.5535, endLng: 77.2588, 
      name: 'Red Fort to Lotus Temple' 
    },
    // Route 3: Delhi - Qutub Minar to Humayun's Tomb
    { 
      startLat: 28.5244, startLng: 77.1855, 
      endLat: 28.5933, endLng: 77.2507, 
      name: 'Qutub Minar to Humayuns Tomb' 
    }
  ];

  for (const route of testRoutes) {
    try {
      const user = await prisma.user.findFirst({ where: { role: 'MR' } });
      if (!user) continue;

      const routeCoordinates = generateRealisticRoute(
        route.startLat, route.startLng, 
        route.endLat, route.endLng, 
        15 + Math.floor(Math.random() * 20) // 15-35 points
      );

      const session = await prisma.gPSSession.create({
        data: {
          userId: user.id,
          checkIn: routeCoordinates[0].timestamp,
          checkOut: routeCoordinates[routeCoordinates.length - 1].timestamp,
          startLat: routeCoordinates[0].latitude,
          startLng: routeCoordinates[0].longitude,
          endLat: routeCoordinates[routeCoordinates.length - 1].latitude,
          endLng: routeCoordinates[routeCoordinates.length - 1].longitude,
          totalKm: 0
        }
      });

      const gpsLogs = routeCoordinates.map(coord => ({
        sessionId: session.id,
        latitude: coord.latitude,
        longitude: coord.longitude,
        timestamp: coord.timestamp,
        accuracy: 3 + Math.random() * 12,
        speed: 15 + Math.random() * 40,
        altitude: 180 + Math.random() * 80
      }));

      await prisma.gPSLog.createMany({ data: gpsLogs });

      console.log(`✅ [CREATE-TEST] Created session: ${route.name} (${gpsLogs.length} points)`);

    } catch (error) {
      console.error(`❌ [CREATE-TEST] Failed to create session for ${route.name}:`, error.message);
    }
  }

  console.log('🏁 [CREATE-TEST] Multiple test sessions creation complete!');
  await prisma.$disconnect();
}

// Run the script to create multiple test sessions
createMultipleTestSessions().catch(console.error);
