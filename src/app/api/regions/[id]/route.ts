import { NextRequest } from 'next/server';
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
  validateObjectId
} from '@/lib/api-utils';
import { z } from 'zod';

// Validation schemas
const updateRegionSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional()
});

// GET /api/regions/[id] - Get single region
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    // Validate region ID
    if (!validateObjectId(id)) {
      return errorResponse('INVALID_ID', 'Invalid region ID format');
    }

    // Get region with related data
    const region = await prisma.region.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        areas: {
          select: {
            id: true,
            name: true,
            status: true,
            _count: {
              select: {
                clients: true,
                tasks: true
              }
            }
          },
          orderBy: { name: 'asc' }
        },
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

    if (!region) {
      return errorResponse('REGION_NOT_FOUND', 'Region not found', 404);
    }

    return successResponse(region);
  } catch (error) {
    logError(error, `GET /api/regions/${id}`, user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch region', 500);
  }
}

// PUT /api/regions/[id] - Update region (Admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    // Authorization - Only admins can update regions
    if (!hasPermission(user.role, [UserRole.ADMIN])) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    }

    // Validate region ID
    if (!validateObjectId(id)) {
      return errorResponse('INVALID_ID', 'Invalid region ID format');
    }

    const body = await request.json();

    // Validate input
    const validation = validateRequest(updateRegionSchema, body);
    if (!validation.success) {
      return errorResponse('VALIDATION_ERROR', validation.error);
    }

    const updateData = validation.data;

    // Check if region exists
    const existingRegion = await prisma.region.findUnique({
      where: { id }
    });

    if (!existingRegion) {
      return errorResponse('REGION_NOT_FOUND', 'Region not found', 404);
    }

    // Check for duplicate name (if name is being updated)
    if (updateData.name && updateData.name !== existingRegion.name) {
      const duplicateRegion = await prisma.region.findFirst({
        where: { 
          name: updateData.name,
          id: { not: id }
        }
      });

      if (duplicateRegion) {
        return errorResponse('REGION_EXISTS', 'Region name already exists');
      }
    }

    // Update region
    const updatedRegion = await prisma.region.update({
      where: { id },
      data: updateData,
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

    return successResponse({
      message: 'Region updated successfully',
      data: updatedRegion
    });
  } catch (error) {
    logError(error, `PUT /api/regions/${id}`, user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to update region', 500);
  }
}

// DELETE /api/regions/[id] - Delete region (Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    // Authorization - Only admins can delete regions
    if (!hasPermission(user.role, [UserRole.ADMIN])) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    }

    // Validate region ID
    if (!validateObjectId(id)) {
      return errorResponse('INVALID_ID', 'Invalid region ID format');
    }

    // Check if region exists
    const existingRegion = await prisma.region.findUnique({
      where: { id },
      include: {
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

    if (!existingRegion) {
      return errorResponse('REGION_NOT_FOUND', 'Region not found', 404);
    }

    // Check if region has associated data
    if (existingRegion._count.users > 0 || 
        existingRegion._count.areas > 0 || 
        existingRegion._count.clients > 0 || 
        existingRegion._count.tasks > 0) {
      return errorResponse(
        'REGION_HAS_DEPENDENCIES',
        'Cannot delete region with associated users, areas, clients, or tasks. Please reassign or remove them first.'
      );
    }

    // Delete region
    await prisma.region.delete({
      where: { id }
    });

    return successResponse({
      message: 'Region deleted successfully'
    });
  } catch (error) {
    logError(error, `DELETE /api/regions/${id}`, user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to delete region', 500);
  }
}
