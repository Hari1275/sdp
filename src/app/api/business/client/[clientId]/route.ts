import { NextRequest } from 'next/server';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  getAuthenticatedUser,
  successResponse,
  errorResponse,
  logError,
  rateLimit,
  parseQueryParams
} from '@/lib/api-utils';

// GET /api/business/client/[clientId] - Get business entries for specific client
export async function GET(
  request: NextRequest,
  { params }: { params: { clientId: string } }
) {
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

    const { clientId } = params;
    const { page, limit } = parseQueryParams(request);
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Verify client exists and user has access
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { 
        id: true, 
        name: true, 
        mrId: true, 
        regionId: true,
        mr: { 
          select: { 
            leadMrId: true 
          } 
        }
      }
    });

    if (!client) {
      return errorResponse('CLIENT_NOT_FOUND', 'Client not found', 404);
    }

    // Check access permissions based on role
    switch (user.role) {
      case UserRole.MR:
        // MR can only access their own clients
        if (client.mrId !== user.id) {
          return errorResponse('FORBIDDEN', 'You can only access your own clients', 403);
        }
        break;
      case UserRole.LEAD_MR:
        // Lead MR can access clients in their region or assigned to their team
        if (client.regionId !== user.regionId && client.mr.leadMrId !== user.id) {
          return errorResponse('FORBIDDEN', 'You can only access clients in your region or team', 403);
        }
        break;
      case UserRole.ADMIN:
        // Admin can access all clients
        break;
      default:
        return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    }

    // Build query filters
    const whereClause: Record<string, unknown> = {
      clientId: clientId
    };

    // Date range filtering
    if (dateFrom || dateTo) {
      whereClause.createdAt = {};
      if (dateFrom) {
        try {
          whereClause.createdAt.gte = new Date(dateFrom);
        } catch {
          return errorResponse('VALIDATION_ERROR', 'Invalid dateFrom format. Use ISO date format.');
        }
      }
      if (dateTo) {
        try {
          whereClause.createdAt.lte = new Date(dateTo);
        } catch {
          return errorResponse('VALIDATION_ERROR', 'Invalid dateTo format. Use ISO date format.');
        }
      }
    }

    // Get total count
    const total = await prisma.businessEntry.count({ where: whereClause });

    // Get business entries with related data
    const businessEntries = await prisma.businessEntry.findMany({
      where: whereClause,
      select: {
        id: true,
        amount: true,
        notes: true,
        latitude: true,
        longitude: true,
        createdAt: true,
        updatedAt: true,
        client: {
          select: {
            id: true,
            name: true,
            businessType: true,
            phone: true,
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
        }
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' }
    });

    // Calculate totals for the client
    const totalAmount = await prisma.businessEntry.aggregate({
      where: { clientId: clientId },
      _sum: {
        amount: true
      }
    });

    const response = {
      data: businessEntries,
      client: {
        id: client.id,
        name: client.name,
        totalAmount: totalAmount._sum.amount || 0,
        totalEntries: total
      },
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
    logError(error, `GET /api/business/client/${params.clientId}`, user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch client business entries', 500);
  }
}
