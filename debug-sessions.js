// Debug script to check GPS session data
// Run with: node debug-sessions.js

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugSessions() {
  try {
    console.log('🔍 Checking GPS sessions with their distances...\n');
    
    // Get sessions for the user mentioned in logs
    const sessions = await prisma.gPSSession.findMany({
      where: {
        userId: '6894732a0fd748f7b93fa229' // User ID from logs
      },
      select: {
        id: true,
        totalKm: true,
        calculationMethod: true,
        routeAccuracy: true,
        checkIn: true,
        checkOut: true,
        _count: {
          select: {
            gpsLogs: true
          }
        }
      },
      orderBy: {
        checkIn: 'desc'
      },
      take: 10
    });

    console.log(`Found ${sessions.length} sessions:\n`);

    sessions.forEach((session, index) => {
      console.log(`${index + 1}. Session ID: ${session.id}`);
      console.log(`   Total KM: ${session.totalKm}`);
      console.log(`   GPS Logs Count: ${session._count.gpsLogs}`);
      console.log(`   Calculation Method: ${session.calculationMethod || 'N/A'}`);
      console.log(`   Route Accuracy: ${session.routeAccuracy || 'N/A'}`);
      console.log(`   Check In: ${session.checkIn?.toISOString() || 'N/A'}`);
      console.log(`   Check Out: ${session.checkOut?.toISOString() || 'N/A'}`);
      console.log('');
    });

    // Specifically check the sessions we know about
    const specificSessions = [
      '68caa9fc7d5f140a5c39a107', // The one that was recalculated in logs
    ];

    console.log('\n🎯 Checking specific sessions:\n');

    for (const sessionId of specificSessions) {
      const session = await prisma.gPSSession.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          totalKm: true,
          calculationMethod: true,
          routeAccuracy: true,
          _count: {
            select: {
              gpsLogs: true
            }
          }
        }
      });

      if (session) {
        console.log(`✅ Session ${sessionId}:`);
        console.log(`   Total KM: ${session.totalKm}`);
        console.log(`   GPS Logs: ${session._count.gpsLogs}`);
        console.log(`   Method: ${session.calculationMethod || 'N/A'}`);
        console.log(`   Accuracy: ${session.routeAccuracy || 'N/A'}`);
      } else {
        console.log(`❌ Session ${sessionId}: NOT FOUND`);
      }
      console.log('');
    }

    // Look for sessions with around 1468 coordinates (the one showing 98.819km)
    console.log('\n🔍 Looking for sessions with ~1468 GPS logs:\n');
    
    const largeSessions = await prisma.gPSSession.findMany({
      where: {
        userId: '6894732a0fd748f7b93fa229',
        gpsLogs: {
          _count: {
            gte: 1400,
            lte: 1500
          }
        }
      },
      select: {
        id: true,
        totalKm: true,
        calculationMethod: true,
        _count: {
          select: {
            gpsLogs: true
          }
        }
      }
    });

    largeSessions.forEach(session => {
      console.log(`📍 Session ${session.id}:`);
      console.log(`   Total KM: ${session.totalKm} (this might be the 98.819km one!)`);
      console.log(`   GPS Logs: ${session._count.gpsLogs}`);
      console.log(`   Method: ${session.calculationMethod || 'N/A'}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error debugging sessions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugSessions();