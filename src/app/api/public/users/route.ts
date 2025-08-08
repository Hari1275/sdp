import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, parseQueryParams } from '@/lib/api-utils';

// GET /api/public/users - List users (public endpoint for forms)
export async function GET(request: NextRequest) {
  try {
    console.log('[PublicUsers] Fetching users...');
    
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    
    // Build where clause
    const whereClause: any = {
      status: 'ACTIVE' // Only active users
    };
    
    // Filter by role if provided
    if (role) {
      whereClause.role = role;
    }
    
    // Get users - simple query for dropdown usage
    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        regionId: true,
      },
      orderBy: [
        { regionId: 'asc' },
        { name: 'asc' }
      ]
    });

    console.log('[PublicUsers] Found users:', users.length, 'with role:', role || 'all');
    console.log('[PublicUsers] Users data:', users.map(u => ({ 
      id: u.id, 
      name: u.name, 
      role: u.role, 
      regionId: u.regionId 
    })));

    return successResponse(users);
  } catch (error) {
    console.error('[PublicUsers] Error fetching users:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch users', 500);
  }
}
