import { NextRequest, NextResponse } from 'next/server';
import { UserRole, BusinessType } from '@prisma/client';
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
import { createClientSchema, CreateClientInput } from '@/lib/validations';

// GET /api/clients - List clients with role-based filtering
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
    const { searchParams } = new URL(request.url);
    const businessType = searchParams.get('businessType');
    const areaId = searchParams.get('areaId');
    const mrId = searchParams.get('mrId');

    // Build base query with role-based filtering
    const whereClause: Record<string, unknown> = {};

    // Apply role-based data access
    switch (user.role) {
      case UserRole.MR:
        // MR can see all clients in their region
        if (user.regionId) {
          whereClause.regionId = user.regionId;
        } else {
          // If MR has no region assigned, they can't see any clients
          whereClause.id = 'non-existent-id';
        }
        break;
      case UserRole.LEAD_MR:
        // Lead MR can see their region's clients and their team's clients
        whereClause.OR = [
          { regionId: user.regionId },
          { mr: { leadMrId: user.id } }
        ];
        break;
      case UserRole.ADMIN:
        // Admin can see all clients - no additional filters
        break;
    }

    // Apply search filter
    if (search) {
      whereClause.name = {
        contains: search,
        mode: 'insensitive'
      };
    }

    // Apply other filters (for admin and authorized users)
    if (regionId && user.role === UserRole.ADMIN) {
      whereClause.regionId = regionId;
    }
    if (businessType && Object.values(BusinessType).includes(businessType as BusinessType)) {
      whereClause.businessType = businessType;
    }
    if (areaId) {
      whereClause.areaId = areaId;
    }
    if (mrId && user.role === UserRole.ADMIN) {
      whereClause.mrId = mrId;
    }

    // Get total count
    const total = await prisma.client.count({ where: whereClause });

    // Get clients with related data
    const clients = await prisma.client.findMany({
      where: whereClause,
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
        },
        _count: {
          select: {
            businessEntries: true
          }
        }
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' }
    });

    const response = {
      data: clients,
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
    logError(error, 'GET /api/clients', user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch clients', 500);
  }
}

// POST /api/clients - Create new client
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

    // Authorization - MR, Lead MR, and Admin can create clients
    if (!hasPermission(user.role, [UserRole.ADMIN, UserRole.LEAD_MR, UserRole.MR])) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    }

    const body = await request.json();

    // Validate input
    const validation = validateRequest(createClientSchema, body);
    if (!validation.success) {
      return errorResponse('VALIDATION_ERROR', validation.error);
    }

    let clientData = validation.data as CreateClientInput;

    // For MR users, automatically assign them as the MR for the client
    if (user.role === UserRole.MR) {
      clientData = {
        ...clientData,
        mrId: user.id,
        regionId: user.regionId! // MR must have a region
      };
    }

    // For Lead MR, validate the assigned MR is in their team
    if (user.role === UserRole.LEAD_MR && clientData.mrId !== user.id) {
      const assignedMr = await prisma.user.findUnique({
        where: { id: clientData.mrId },
        select: { leadMrId: true, regionId: true }
      });

      if (!assignedMr || assignedMr.leadMrId !== user.id) {
        return errorResponse('FORBIDDEN', 'You can only assign clients to your team members');
      }
    }

    // Verify region exists
    const region = await prisma.region.findUnique({
      where: { id: clientData.regionId }
    });
    if (!region) {
      return errorResponse('INVALID_REGION', 'Region not found');
    }

    // Verify area exists and belongs to the region
    const area = await prisma.area.findUnique({
      where: { id: clientData.areaId }
    });
    if (!area || area.regionId !== clientData.regionId) {
      return errorResponse('INVALID_AREA', 'Area not found or does not belong to the specified region');
    }

    // Verify MR exists and has proper role
    const assignedMr = await prisma.user.findUnique({
      where: { id: clientData.mrId },
      select: { role: true, regionId: true }
    });
    if (!assignedMr || assignedMr.role !== UserRole.MR) {
      return errorResponse('INVALID_MR', 'Assigned user is not an MR');
    }

    // Check for duplicate client (name + location + area)
    const existingClient = await prisma.client.findFirst({
      where: {
        name: clientData.name,
        areaId: clientData.areaId,
        businessType: clientData.businessType
      }
    });

    if (existingClient) {
      return errorResponse('CLIENT_EXISTS', 'Client with same name and business type already exists in this area');
    }

    // Create client
    const newClient = await prisma.client.create({
      data: clientData,
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

    return NextResponse.json(
      {
        success: true,
        message: 'Client created successfully',
        data: newClient
      },
      { status: 201 }
    );
  } catch (error) {
    logError(error, 'POST /api/clients', user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to create client', 500);
  }
}
