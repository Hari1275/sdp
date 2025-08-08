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
import { createBusinessEntrySchema, CreateBusinessEntryInput } from '@/lib/validations';

// GET /api/business - List business entries with role-based filtering
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

    const { page, limit, search } = parseQueryParams(request);
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const mrId = searchParams.get('mrId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build base query with role-based filtering
    const whereClause: Record<string, unknown> = {};

    // Apply role-based data access
    switch (user.role) {
      case UserRole.MR:
        // MR can only see their own business entries
        whereClause.client = { mrId: user.id };
        break;
      case UserRole.LEAD_MR:
        // Lead MR can see their region's entries and their team's entries
        whereClause.OR = [
          { client: { regionId: user.regionId } },
          { client: { mr: { leadMrId: user.id } } }
        ];
        break;
      case UserRole.ADMIN:
        // Admin can see all entries
        break;
    }

    // Apply filters
    if (clientId) {
      // Verify user has access to this client
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { mrId: true, regionId: true, mr: { select: { leadMrId: true } } }
      });

      if (!client) {
        return errorResponse('CLIENT_NOT_FOUND', 'Client not found', 404);
      }

      // Check access permissions
      if (user.role === UserRole.MR && client.mrId !== user.id) {
        return errorResponse('FORBIDDEN', 'You can only access your own clients', 403);
      }
      if (user.role === UserRole.LEAD_MR && 
          client.regionId !== user.regionId && 
          client.mr.leadMrId !== user.id) {
        return errorResponse('FORBIDDEN', 'You can only access clients in your region or team', 403);
      }

      whereClause.clientId = clientId;
    }

    if (mrId && user.role === UserRole.ADMIN) {
      whereClause.client = { mrId };
    }

    // Date range filtering
    if (dateFrom || dateTo) {
      whereClause.createdAt = {};
      if (dateFrom) {
        whereClause.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        whereClause.createdAt.lte = new Date(dateTo);
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

    const response = {
      data: businessEntries,
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
    logError(error, 'GET /api/business', user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch business entries', 500);
  }
}

// POST /api/business - Create new business entry
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

    // Authorization - MR, Lead MR, and Admin can create business entries
    if (!hasPermission(user.role, [UserRole.ADMIN, UserRole.LEAD_MR, UserRole.MR])) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    }

    const body = await request.json();

    // Validate input
    const validation = validateRequest(createBusinessEntrySchema, body);
    if (!validation.success) {
      return errorResponse('VALIDATION_ERROR', validation.error);
    }

    const businessData = validation.data as CreateBusinessEntryInput;

    // Verify client exists and user has access
    const client = await prisma.client.findUnique({
      where: { id: businessData.clientId },
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

    // Check access permissions
    if (user.role === UserRole.MR && client.mrId !== user.id) {
      return errorResponse('FORBIDDEN', 'You can only create entries for your own clients', 403);
    }
    if (user.role === UserRole.LEAD_MR && 
        client.regionId !== user.regionId && 
        client.mr.leadMrId !== user.id) {
      return errorResponse('FORBIDDEN', 'You can only create entries for clients in your region or team', 403);
    }

    // Create business entry
    const newBusinessEntry = await prisma.businessEntry.create({
      data: businessData,
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
      }
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Business entry created successfully',
        data: newBusinessEntry
      },
      { status: 201 }
    );
  } catch (error) {
    logError(error, 'POST /api/business', user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to create business entry', 500);
  }
}
