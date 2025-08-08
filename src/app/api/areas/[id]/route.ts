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
const updateAreaSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().optional(),
  regionId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid region ID format').optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional()
});

// GET /api/areas/[id] - Get single area
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

    // Validate area ID
    if (!validateObjectId(id)) {
      return errorResponse('INVALID_ID', 'Invalid area ID format');
    }

    // Get area with related data
    const area = await prisma.area.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        regionId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        region: {
          select: {
            id: true,
            name: true,
            status: true
          }
        },
        clients: {
          select: {
            id: true,
            name: true,
            status: true
          },
          orderBy: { name: 'asc' }
        },
        _count: {
          select: {
            clients: true,
            tasks: true
          }
        }
      }
    });

    if (!area) {
      return errorResponse('AREA_NOT_FOUND', 'Area not found', 404);
    }

    // Check role-based access
    if ((user.role === UserRole.LEAD_MR || user.role === UserRole.MR) && 
        area.regionId !== user.regionId) {
      return errorResponse('FORBIDDEN', 'Access denied to this area', 403);
    }

    return successResponse(area);
  } catch (error) {
    logError(error, `GET /api/areas/${id}`, user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch area', 500);
  }
}

// PUT /api/areas/[id] - Update area (Admin only)
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

    // Authorization - Only admins can update areas
    if (!hasPermission(user.role, [UserRole.ADMIN])) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    }

    // Validate area ID
    if (!validateObjectId(id)) {
      return errorResponse('INVALID_ID', 'Invalid area ID format');
    }

    const body = await request.json();

    // Validate input
    const validation = validateRequest(updateAreaSchema, body);
    if (!validation.success) {
      return errorResponse('VALIDATION_ERROR', validation.error);
    }

    const updateData = validation.data;

    // Check if area exists
    const existingArea = await prisma.area.findUnique({
      where: { id }
    });

    if (!existingArea) {
      return errorResponse('AREA_NOT_FOUND', 'Area not found', 404);
    }

    // If regionId is being updated, verify the new region exists
    if (updateData.regionId && updateData.regionId !== existingArea.regionId) {
      const region = await prisma.region.findUnique({
        where: { id: updateData.regionId }
      });

      if (!region) {
        return errorResponse('INVALID_REGION', 'Region not found');
      }
    }

    // Check for duplicate name (if name is being updated)
    if (updateData.name && updateData.name !== existingArea.name) {
      const duplicateArea = await prisma.area.findFirst({
        where: { 
          name: updateData.name,
          regionId: updateData.regionId || existingArea.regionId,
          id: { not: id }
        }
      });

      if (duplicateArea) {
        return errorResponse('AREA_EXISTS', 'Area name already exists in this region');
      }
    }

    // Update area
    const updatedArea = await prisma.area.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        description: true,
        regionId: true,
        status: true,
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

    return successResponse({
      message: 'Area updated successfully',
      data: updatedArea
    });
  } catch (error) {
    logError(error, `PUT /api/areas/${id}`, user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to update area', 500);
  }
}

// DELETE /api/areas/[id] - Delete area (Admin only)
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

    // Authorization - Only admins can delete areas
    if (!hasPermission(user.role, [UserRole.ADMIN])) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    }

    // Validate area ID
    if (!validateObjectId(id)) {
      return errorResponse('INVALID_ID', 'Invalid area ID format');
    }

    // Check if area exists
    const existingArea = await prisma.area.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            clients: true,
            tasks: true
          }
        }
      }
    });

    if (!existingArea) {
      return errorResponse('AREA_NOT_FOUND', 'Area not found', 404);
    }

    // Check if area has associated data
    if (existingArea._count.clients > 0 || existingArea._count.tasks > 0) {
      return errorResponse(
        'AREA_HAS_DEPENDENCIES',
        'Cannot delete area with associated clients or tasks. Please reassign or remove them first.'
      );
    }

    // Delete area
    await prisma.area.delete({
      where: { id }
    });

    return successResponse({
      message: 'Area deleted successfully'
    });
  } catch (error) {
    logError(error, `DELETE /api/areas/${id}`, user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to delete area', 500);
  }
}
