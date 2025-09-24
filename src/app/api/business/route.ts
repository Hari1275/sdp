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
import { getBusinessFilter } from '@/lib/role-filters';
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

    const { page, limit } = parseQueryParams(request)
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const mrId = searchParams.get('mrId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build base query with role-based filtering
    const baseWhereClause = getBusinessFilter(user);

    // Apply filters
    const whereClause: Record<string, unknown> = { ...baseWhereClause };
    
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
      if (user.role === UserRole.MR && client.regionId !== user.regionId) {
        return errorResponse('FORBIDDEN', 'You can only access clients in your region', 403);
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
      whereClause.createdAt = {} as Record<string, Date>;
      if (dateFrom) {
        (whereClause.createdAt as Record<string, Date>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        // Add 23:59:59 to include the entire day
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        (whereClause.createdAt as Record<string, Date>).lte = endDate;
      }
    }

    // Get total count
    console.log('[BusinessGET] whereClause:', whereClause);
    const total = await prisma.businessEntry.count({ where: whereClause });

    // Get business entries with related data
    // Debug log for criteria
    console.log('[BusinessGET] Fetching business entries with criteria:', {
      user: { id: user.id, role: user.role },
      whereClause,
      pagination: { page, limit },
      clientId,
      mrId,
      dateRange: { dateFrom, dateTo }
    });

    const businessEntries = await prisma.businessEntry.findMany({
      where: whereClause,
      select: {
        id: true,
        amount: true,
        notes: true,
        latitude: true,
        longitude: true,
        documentLink: true,
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

    console.log('[BusinessGET] Fetched business entries:', {
      total,
      fetchedCount: businessEntries.length,
      entries: businessEntries.map(entry => ({
        id: entry.id,
        amount: entry.amount,
        clientId: entry.client.id,
        clientMrId: entry.client.mr?.id,
        createdAt: entry.createdAt
      }))
    });

    return successResponse(response);
  } catch (error) {
    logError(error, 'GET /api/business', user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch business entries', 500);
  }
}

// POST /api/business - Create new business entry
export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const authHeader = request.headers.get('authorization');
  const contentType = request.headers.get('content-type');
  console.log('[BusinessPOST] Starting business entry creation', {
    method: request.method,
    contentType,
    hasAuth: !!authHeader,
  });
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
    console.log('[BusinessPOST] Authenticated user:', user.name, '(', user.role, ')');

    // Authorization - MR, Lead MR, and Admin can create business entries
    if (!hasPermission(user.role, [UserRole.ADMIN, UserRole.LEAD_MR, UserRole.MR])) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    }

    const body = await request.json();
    console.log('[BusinessPOST] Received request body:', body);

    // Validate input
    console.log('[BusinessPOST] Starting validation with schema');
    const validation = validateRequest(createBusinessEntrySchema, body);
    if (!validation.success) {
      console.log('[BusinessPOST] Validation failed:', validation.error);
      return errorResponse('VALIDATION_ERROR', validation.error);
    }

    const businessData = validation.data as CreateBusinessEntryInput;
    console.log('[BusinessPOST] Payload after validation:', businessData);

    // Verify client exists and user has access
    console.log('[BusinessPOST] Verifying client exists and access...');
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
      console.log('[BusinessPOST] Client not found:', businessData.clientId);
      return errorResponse('CLIENT_NOT_FOUND', 'Client not found', 404);
    }

    // Check access permissions
    if (user.role === UserRole.MR && client.regionId !== user.regionId) {
      console.log('[BusinessPOST] Forbidden: MR not in region', { userRegion: user.regionId, clientRegion: client.regionId });
      return errorResponse('FORBIDDEN', 'You can only create entries for clients in your region', 403);
    }
    if (user.role === UserRole.LEAD_MR && 
        client.regionId !== user.regionId && 
        client.mr.leadMrId !== user.id) {
      console.log('[BusinessPOST] Forbidden: Lead MR not region/team');
      return errorResponse('FORBIDDEN', 'You can only create entries for clients in your region or team', 403);
    }

    // Create business entry
    console.log('[BusinessPOST] Creating business entry...');
    const createData = {
      ...businessData,
      mrId: user.id // The MR who is creating the entry
    };
    console.log('[BusinessPOST] Creating business entry with data:', createData);
    const newBusinessEntry = await prisma.businessEntry.create({
      data: {
        ...businessData,
        mrId: user.id // Attribute the entry to the creating MR, not the client's MR
      },
      select: {
        id: true,
        amount: true,
        notes: true,
        latitude: true,
        longitude: true,
        documentLink: true,
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

    console.log('[BusinessPOST] Business entry created:', newBusinessEntry.id);

    console.log('[BusinessPOST] Success! Total time ms:', Date.now() - startedAt);
    const responsePayload = {
      success: true,
      message: 'Business entry created successfully',
      data: newBusinessEntry
    };
    console.log('[BusinessPOST] Responding with:', {
      id: newBusinessEntry.id,
      hasDocumentLink: (newBusinessEntry as unknown as { documentLink?: string | null }).documentLink ? true : false
    });

    return NextResponse.json(
      responsePayload,
      { status: 201 }
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[BusinessPOST] Error details:', {
      message: err.message,
      stack: err.stack,
      userId: user?.id
    });
    logError(error, 'POST /api/business', user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to create business entry', 500);
  }
}
