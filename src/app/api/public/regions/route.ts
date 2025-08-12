import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-utils';

// GET /api/public/regions - List regions (public endpoint for forms)
export async function GET() {
  try {
  // console.log('[PublicRegions] Fetching regions...');
    
    // Get regions - simple query for dropdown usage
    const regions = await prisma.region.findMany({
      where: {
        status: 'ACTIVE' // Only active regions
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
      orderBy: { 
        name: 'asc' 
      }
    });

  // console.log('[PublicRegions] Found regions:', regions.length);

    return successResponse(regions);
  } catch (error) {
    console.error('[PublicRegions] Error fetching regions:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch regions', 500);
  }
}
