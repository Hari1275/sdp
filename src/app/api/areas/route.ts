import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  getAuthenticatedUser,
  hasPermission,
  successResponse,
  errorResponse,
  validateRequest,
  logError,
  rateLimit,
  parseQueryParams,
} from '@/lib/api-utils';
import { z } from 'zod';

// Validation schemas
const createAreaSchema = z.object({
  name: z.string().min(2).max(100),
  regionId: z.string().uuid(),
  description: z.string().optional()
});

// GET /api/areas - List areas
export async function GET(request: NextRequest) {
  let user;

  try {
    // Rate limiting
    if (!rateLimit(request)) {
      return errorResponse(
        'RATE_LIMIT_EXCEEDED',
        'Too many requests. Please try again later.',
        429
      );
    }

    // Authentication
    user = await getAuthenticatedUser(request);
    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { page, limit, search, regionId } = parseQueryParams(request);

    // Build base query
    const whereClause: Record<string, unknown> = {};

    // Apply search filter
    if (search) {
      whereClause.name = {
        contains: search,
        mode: 'insensitive'
      };
    }

    // Apply region filter
    if (regionId) {
      whereClause.regionId = regionId;
    }

    // Apply role-based filtering for region access
    if (user.role === UserRole.LEAD_MR || user.role === UserRole.MR) {
      whereClause.regionId = user.regionId;
    }

    // Get total count
    const total = await prisma.area.count({ where: whereClause });

    // Get areas with related data
    const areas = await prisma.area.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        description: true,
        regionId: true,
        createdAt: true,
        updatedAt: true,
        region: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            clients: true,
            tasks: true
          }
        }
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: 'asc' }
    });

    const response = {
      data: areas,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    };

    return successResponse(response);
  } catch (error) {
    logError(error, 'GET /api/areas', user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch areas', 500);
  }
}

// POST /api/areas - Create new area (Admin only)
export async function POST(request: NextRequest) {
  let user;

  try {
    // Rate limiting
    if (!rateLimit(request)) {
      return errorResponse(
        'RATE_LIMIT_EXCEEDED',
        'Too many requests. Please try again later.',
        429
      );
    }

    // Authentication
    user = await getAuthenticatedUser(request);
    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    // Authorization - Only admins can create areas
    if (!hasPermission(user.role, [UserRole.ADMIN])) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    }

    const body = await request.json();

    // Validate input
    const validation = validateRequest(createAreaSchema, body);
    if (!validation.success) {
      return errorResponse('VALIDATION_ERROR', validation.error);
    }

    const areaData = validation.data;

    // Verify region exists
    const region = await prisma.region.findUnique({
      where: { id: areaData.regionId }
    });

    if (!region) {
      return errorResponse('INVALID_REGION', 'Region not found');
    }

    // Check for duplicate area name in the same region
    const existingArea = await prisma.area.findFirst({
      where: {
        name: areaData.name,
        regionId: areaData.regionId
      }
    });

    if (existingArea) {
      return errorResponse('AREA_EXISTS', 'Area name already exists in this region');
    }

    // Create area
    const newArea = await prisma.area.create({
      data: areaData,
      select: {
        id: true,
        name: true,
        description: true,
        regionId: true,
        createdAt: true,
        updatedAt: true,
        region: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            clients: true,
            tasks: true
          }
        }
      }
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Area created successfully',
        data: newArea
      },
      { status: 201 }
    );
  } catch (error) {
    logError(error, 'POST /api/areas', user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to create area', 500);
  }
}
