import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Get basic counts
    const clientCount = await prisma.client.count();
    const regionCount = await prisma.region.count();
    const areaCount = await prisma.area.count();
    const userCount = await prisma.user.count();

    // Get sample data
    const clients = await prisma.client.findMany({
      take: 5,
      include: {
        region: true,
        area: true,
        mr: true,
        _count: {
          select: {
            businessEntries: true
          }
        }
      }
    });

    const regions = await prisma.region.findMany({
      take: 5,
      include: {
        _count: {
          select: {
            areas: true,
            clients: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        counts: {
          clients: clientCount,
          regions: regionCount,
          areas: areaCount,
          users: userCount
        },
        samples: {
          clients: clients.map(c => ({
            id: c.id,
            name: c.name,
            businessType: c.businessType,
            area: c.area?.name,
            region: c.region?.name,
            mr: c.mr?.name,
            businessEntries: c._count.businessEntries
          })),
          regions: regions.map(r => ({
            id: r.id,
            name: r.name,
            areas: r._count.areas,
            clients: r._count.clients
          }))
        }
      }
    });
  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error
      },
      { status: 500 }
    );
  }
}
