import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId parameter is required' }, { status: 400 });
    }

    // Get session data directly from database
    const session = await prisma.gPSSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        totalKm: true,
        calculationMethod: true,
        routeAccuracy: true,
        checkIn: true,
        checkOut: true,
        userId: true,
        user: {
          select: {
            name: true,
            username: true
          }
        }
      }
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    console.log(`🔍 [DEBUG] Session ${sessionId} current database state:`);
    console.log(`   totalKm: ${session.totalKm}km`);
    console.log(`   calculationMethod: ${session.calculationMethod}`);
    console.log(`   routeAccuracy: ${session.routeAccuracy}`);
    console.log(`   user: ${session.user.name} (${session.user.username})`);

    return NextResponse.json({
      sessionId: session.id,
      totalKm: session.totalKm,
      calculationMethod: session.calculationMethod,
      routeAccuracy: session.routeAccuracy,
      checkIn: session.checkIn,
      checkOut: session.checkOut,
      user: session.user,
      timestamp: new Date().toISOString(),
      message: 'Direct database query result'
    });

  } catch (error) {
    console.error('Debug session distance error:', error);
    return NextResponse.json(
      { error: 'Failed to query session distance' },
      { status: 500 }
    );
  }
}