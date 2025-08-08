import { NextRequest } from 'next/server';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  getAuthenticatedUser,
  hasPermission,
  successResponse,
  errorResponse,
  logError,
  rateLimit
} from '@/lib/api-utils';

// GET /api/users/[id]/team - Get team members for Lead MR
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

    // Authorization - Only Lead MR and Admin can access team data
    if (!hasPermission(user.role, [UserRole.ADMIN, UserRole.LEAD_MR])) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    }

    // For Lead MR, they can only access their own team
    if (user.role === UserRole.LEAD_MR && user.id !== id) {
      return errorResponse('FORBIDDEN', 'You can only access your own team', 403);
    }

    // Verify the Lead MR exists
    const leadMr = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, name: true }
    });

    if (!leadMr) {
      return errorResponse('NOT_FOUND', 'Lead MR not found', 404);
    }

    if (leadMr.role !== UserRole.LEAD_MR) {
      return errorResponse('INVALID_REQUEST', 'User is not a Lead MR', 400);
    }

    // Get team members
    const teamMembers = await prisma.user.findMany({
      where: {
        leadMrId: id,
        role: UserRole.MR
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        phone: true,
        status: true,
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
            assignedTasks: true,
            createdTasks: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Get team statistics
    const teamStats = await prisma.user.aggregate({
      where: {
        leadMrId: id,
        role: UserRole.MR
      },
      _count: {
        id: true
      }
    });

    const response = {
      leadMr: {
        id: leadMr.id,
        name: leadMr.name
      },
      teamMembers,
      stats: {
        totalMembers: teamStats._count.id,
        activeMembers: teamMembers.filter(member => member.status === 'ACTIVE').length
      }
    };

    return successResponse(response);
  } catch (error) {
    logError(error, `GET /api/users/${id}/team`, user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch team data', 500);
  }
}
