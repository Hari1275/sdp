import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-utils';

// GET /api/public/areas - List areas (public endpoint for forms)
export async function GET(request: NextRequest) {
  try {
    console.log('[PublicAreas] Fetching areas...');
    
    // Get areas - simple query for dropdown usage
    const areas = await prisma.area.findMany({
      where: {
        status: 'ACTIVE' // Only active areas
      },
      select: {
        id: true,
        name: true,
        description: true,
        regionId: true,
      },
      orderBy: [
        { regionId: 'asc' },
        { name: 'asc' }
      ]
    });

    console.log('[PublicAreas] Found areas:', areas.length);

    return successResponse(areas);
  } catch (error) {
    console.error('[PublicAreas] Error fetching areas:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch areas', 500);
  }
}
