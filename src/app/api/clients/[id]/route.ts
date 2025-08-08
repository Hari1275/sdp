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
  rateLimit
} from '@/lib/api-utils';
import { updateClientSchema, UpdateClientInput } from '@/lib/validations';

// GET /api/clients/[id] - Get single client
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
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

    // Get client with related data
    const client = await prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        phone: true,
        businessType: true,
        address: true,
        latitude: true,
        longitude: true,
        notes: true,
        regionId: true,
        areaId: true,
        mrId: true,
        createdAt: true,
        updatedAt: true,
        region: {
          select: {
            id: true,
            name: true
          }
        },
        area: {
          select: {
            id: true,
            name: true
          }
        },
        mr: {
          select: {
            id: true,
            name: true,
            leadMrId: true
          }
        },
        _count: {
          select: {
            businessEntries: true,
            tasks: true
          }
        }
      }
    });

    if (!client) {
      return errorResponse('NOT_FOUND', 'Client not found', 404);
    }

    // Apply role-based access control
    switch (user.role) {
      case UserRole.MR:
        if (client.mrId !== user.id) {
          return errorResponse('FORBIDDEN', 'You can only access your own clients', 403);
        }
        break;
      case UserRole.LEAD_MR:
        // Lead MR can access clients in their region or assigned to their team
        if (client.regionId !== user.regionId && client.mr.leadMrId !== user.id) {
          return errorResponse('FORBIDDEN', 'You can only access clients in your region or assigned to your team', 403);
        }
        break;
      case UserRole.ADMIN:
        // Admin can access all clients
        break;
    }

    return successResponse(client);
  } catch (error) {
    logError(error, `GET /api/clients/${id}`, user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch client', 500);
  }
}

// PUT /api/clients/[id] - Update client
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
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

    // Authorization - MR, Lead MR, and Admin can update clients
    if (!hasPermission(user.role, [UserRole.ADMIN, UserRole.LEAD_MR, UserRole.MR])) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    }

    const body = await request.json();

    // Validate input
    const validation = validateRequest(updateClientSchema, body);
    if (!validation.success) {
      return errorResponse('VALIDATION_ERROR', validation.error);
    }

    const updateData = validation.data as UpdateClientInput;

    // Check if client exists
    const existingClient = await prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        mrId: true,
        regionId: true,
        areaId: true,
        mr: {
          select: {
            leadMrId: true
          }
        }
      }
    });

    if (!existingClient) {
      return errorResponse('NOT_FOUND', 'Client not found', 404);
    }

    // Apply role-based access control for updates
    switch (user.role) {
      case UserRole.MR:
        if (existingClient.mrId !== user.id) {
          return errorResponse('FORBIDDEN', 'You can only update your own clients', 403);
        }
        break;
      case UserRole.LEAD_MR:
        if (existingClient.regionId !== user.regionId && existingClient.mr.leadMrId !== user.id) {
          return errorResponse('FORBIDDEN', 'You can only update clients in your region or assigned to your team', 403);
        }
        break;
      case UserRole.ADMIN:
        // Admin can update all clients
        break;
    }

    // Verify area exists and belongs to the region if being updated
    if (updateData.areaId) {
      const area = await prisma.area.findUnique({
        where: { id: updateData.areaId }
      });
      if (!area || area.regionId !== existingClient.regionId) {
        return errorResponse('INVALID_AREA', 'Area not found or does not belong to the client\'s region');
      }
    }

    // Check for duplicate client name in the same area if name is being updated
    if (updateData.name) {
      const duplicateClient = await prisma.client.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            { name: updateData.name },
            { areaId: updateData.areaId || existingClient.areaId },
            { businessType: updateData.businessType }
          ]
        }
      });

      if (duplicateClient) {
        return errorResponse('CLIENT_EXISTS', 'Client with same name and business type already exists in this area');
      }
    }

    // Update client
    const updatedClient = await prisma.client.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        phone: true,
        businessType: true,
        address: true,
        latitude: true,
        longitude: true,
        notes: true,
        regionId: true,
        areaId: true,
        mrId: true,
        createdAt: true,
        updatedAt: true,
        region: {
          select: {
            id: true,
            name: true
          }
        },
        area: {
          select: {
            id: true,
            name: true
          }
        },
        mr: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return successResponse(updatedClient, 'Client updated successfully');
  } catch (error) {
    logError(error, `PUT /api/clients/${id}`, user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to update client', 500);
  }
}

// DELETE /api/clients/[id] - Delete client (Admin only)
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
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

    // Authorization - Only admins can delete clients
    if (!hasPermission(user.role, [UserRole.ADMIN])) {
      return errorResponse('FORBIDDEN', 'Only administrators can delete clients', 403);
    }

    // Check if client exists
    const existingClient = await prisma.client.findUnique({
      where: { id },
      select: { 
        id: true,
        _count: {
          select: {
            businessEntries: true,
            tasks: true
          }
        }
      }
    });

    if (!existingClient) {
      return errorResponse('NOT_FOUND', 'Client not found', 404);
    }

    // Check if client has associated data
    if (existingClient._count.businessEntries > 0 || existingClient._count.tasks > 0) {
      return errorResponse(
        'CLIENT_HAS_DATA',
        'Cannot delete client with existing business entries or tasks',
        400
      );
    }

    // Delete client
    await prisma.client.delete({
      where: { id }
    });

    return successResponse({ success: true }, 'Client deleted successfully');
  } catch (error) {
    logError(error, `DELETE /api/clients/${id}`, user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to delete client', 500);
  }
}
