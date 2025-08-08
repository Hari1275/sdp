import { NextRequest } from 'next/server';
import { UserRole, UserStatus } from '@prisma/client';
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
import { updateUserSchema, UpdateUserInput } from '@/lib/validations';

// GET /api/users/[id] - Get single user
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

    // Authorization
    if (!hasPermission(user.role, [UserRole.ADMIN, UserRole.LEAD_MR, UserRole.MR])) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    }

    // Check role-based permissions
    if (user.role === UserRole.MR && user.id !== id) {
      return errorResponse(
        'FORBIDDEN',
        'You can only view your own profile',
        403
      );
    }

    if (user.role === UserRole.LEAD_MR) {
      // Lead MR can view themselves and their team members
      const targetUser = await prisma.user.findUnique({
        where: { id },
        select: { id: true, leadMrId: true }
      });

      if (
        !targetUser ||
        (targetUser.id !== user.id && targetUser.leadMrId !== user.id)
      ) {
        return errorResponse(
          'FORBIDDEN',
          'You can only view your team members',
          403
        );
      }
    }

    // Fetch user data
    const userData = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        regionId: true,
        leadMrId: true,
        createdAt: true,
        updatedAt: true,
        region: {
          select: {
            id: true,
            name: true
          }
        },
        leadMr: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            clients: true,
            assignedTasks: true,
            createdTasks: true,
            teamMembers: true
          }
        }
      }
    });

    if (!userData) {
      return errorResponse('NOT_FOUND', 'User not found', 404);
    }

    return successResponse(userData);
  } catch (error) {
    logError(error, `GET /api/users/${id}`, user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch user', 500);
  }
}

// PUT /api/users/[id] - Update user (Admin only)
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

    // Authorization - Only admins can update users
    if (!hasPermission(user.role, [UserRole.ADMIN])) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    }

    const body = await request.json();

    // Validate input
    const validation = validateRequest(updateUserSchema, body);
    if (!validation.success) {
      return errorResponse('VALIDATION_ERROR', validation.error);
    }

    const updateData = validation.data as UpdateUserInput;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return errorResponse('NOT_FOUND', 'User not found', 404);
    }

    // Check for duplicate username/email if being updated
    if (updateData.username || updateData.email) {
      const orConditions: Array<Record<string, string>> = [];
      if (updateData.username) {
        orConditions.push({ username: updateData.username });
      }
      if (updateData.email) {
        orConditions.push({ email: updateData.email });
      }

      const duplicateUser = await prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            { OR: orConditions }
          ]
        }
      });

      if (duplicateUser) {
        return errorResponse(
          'USER_EXISTS',
          'Username or email already exists'
        );
      }
    }

    // Validate regionId if provided
    if (updateData.regionId) {
      const region = await prisma.region.findUnique({
        where: { id: updateData.regionId }
      });
      if (!region) {
        return errorResponse('INVALID_REGION', 'Invalid region specified');
      }
    }

    // Validate leadMrId if provided
    if (updateData.leadMrId) {
      const leadMr = await prisma.user.findUnique({
        where: { id: updateData.leadMrId }
      });
      if (!leadMr || leadMr.role !== UserRole.LEAD_MR) {
        return errorResponse('INVALID_LEAD_MR', 'Invalid Lead MR specified');
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        regionId: true,
        leadMrId: true,
        createdAt: true,
        updatedAt: true,
        region: {
          select: {
            id: true,
            name: true
          }
        },
        leadMr: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return successResponse(updatedUser, 'User updated successfully');
  } catch (error) {
    logError(error, `PUT /api/users/${id}`, user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to update user', 500);
  }
}

// DELETE /api/users/[id] - Deactivate user (Admin only) - Soft delete
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

    // Authorization - Only admins can delete users
    if (!hasPermission(user.role, [UserRole.ADMIN])) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return errorResponse('NOT_FOUND', 'User not found', 404);
    }

    // Prevent self-deletion
    if (id === user.id) {
      return errorResponse(
        'FORBIDDEN',
        'Cannot deactivate your own account',
        403
      );
    }

    // Soft delete - set status to INACTIVE instead of hard delete
    await prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.INACTIVE,
        updatedAt: new Date()
      }
    });

    return successResponse(
      { success: true },
      'User deactivated successfully'
    );
  } catch (error) {
    logError(error, `DELETE /api/users/${id}`, user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to deactivate user', 500);
  }
}
