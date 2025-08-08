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
  parseQueryParams
} from '@/lib/api-utils';
import { z } from 'zod';

// Validation schemas
const createRegionSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE')
});


// GET /api/regions - List regions
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

    // All authenticated users can view regions
    const { page, limit, search } = parseQueryParams(request);

    // Build query
    const whereClause = search ? {
      name: {
        contains: search,
        mode: 'insensitive' as const
      }
    } : {};

    // Get total count
    const total = await prisma.region.count({ where: whereClause });

    // Get regions with related data
    const regions = await prisma.region.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
            areas: true,
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
      data: regions,
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
    logError(error, 'GET /api/regions', user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch regions', 500);
  }
}

// POST /api/regions - Create new region (Admin only)
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

    // Authorization - Only admins can create regions
    if (!hasPermission(user.role, [UserRole.ADMIN])) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    }

    const body = await request.json();

    // Validate input
    const validation = validateRequest(createRegionSchema, body);
    if (!validation.success) {
      return errorResponse('VALIDATION_ERROR', validation.error);
    }

    const regionData = validation.data;

    // Check for duplicate region name
    const existingRegion = await prisma.region.findFirst({
      where: { name: regionData.name }
    });

    if (existingRegion) {
      return errorResponse('REGION_EXISTS', 'Region name already exists');
    }

    // Create region
    const newRegion = await prisma.region.create({
      data: regionData,
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
            areas: true,
            clients: true,
            tasks: true
          }
        }
      }
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Region created successfully',
        data: newRegion
      },
      { status: 201 }
    );
  } catch (error) {
    logError(error, 'POST /api/regions', user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to create region', 500);
  }
}
