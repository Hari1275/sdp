import { NextRequest, NextResponse } from 'next/server';
import { UserRole, UserStatus } from '@prisma/client';
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
import { createUserSchema, CreateUserInput } from '@/lib/validations';
import { hashPassword } from '@/lib/password';

// GET /api/users - List users with role-based filtering
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

    // Authorization
    if (!hasPermission(user.role, [UserRole.ADMIN, UserRole.LEAD_MR, UserRole.MR])) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    }

    // Parse query parameters
    const { page, limit, role, status, regionId, leadMrId, search } = parseQueryParams(request);
    const url = new URL(request.url);
    const assignable = url.searchParams.get('assignable') === 'true';

    // Build base query with role-safe filters for User model
    const whereClause: Record<string, unknown> = {};
    if (user.role === UserRole.MR) {
      // MR can only see themselves
      whereClause.id = user.id;
    } else if (user.role === UserRole.LEAD_MR) {
      // Lead MR scope
      if (assignable && role === UserRole.MR) {
        // For task assignment: allow MRs in same region or direct team, plus self
        whereClause.OR = [
          { leadMrId: user.id },
          { regionId: user.regionId || undefined },
          { id: user.id },
        ];
      } else {
        // Default list: self + direct team only
        whereClause.OR = [
          { id: user.id },
          { leadMrId: user.id },
        ];
      }
    }

    // Apply filters
    if (role && Object.values(UserRole).includes(role as UserRole)) {
      whereClause.role = role;
    }
    if (status && Object.values(UserStatus).includes(status as UserStatus)) {
      whereClause.status = status;
    }
    if (regionId) {
      whereClause.regionId = regionId;
    }
    if (leadMrId) {
      whereClause.leadMrId = leadMrId;
    }
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get total count
    const total = await prisma.user.count({ where: whereClause });

    // Get users with pagination
    const users = await prisma.user.findMany({
      where: whereClause,
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
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' }
    });

    const response = {
      data: users,
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
    logError(error, 'GET /api/users', user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch users', 500);
  }
}

// POST /api/users - Create new user (Admin only)
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

    // Authorization - Only admins can create users
    if (!hasPermission(user.role, [UserRole.ADMIN])) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    }

    const body = await request.json();

    // Validate input
    const validation = validateRequest(createUserSchema, body);
    if (!validation.success) {
      return errorResponse('VALIDATION_ERROR', validation.error);
    }

    const userData = validation.data as CreateUserInput;

    // Check for duplicate username/email
    const whereConditions: Array<{ username?: string; email?: string }> = [
      { username: userData.username }
    ];
    
    // Only check for email duplicates if email is provided
    if (userData.email) {
      whereConditions.push({ email: userData.email });
    }
    
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: whereConditions
      }
    });

    if (existingUser) {
      return errorResponse('USER_EXISTS', 'Username or email already exists');
    }

    // Validate regionId if provided
    if (userData.regionId) {
      const region = await prisma.region.findUnique({
        where: { id: userData.regionId }
      });
      if (!region) {
        return errorResponse('INVALID_REGION', 'Invalid region specified');
      }
    }

    // Validate leadMrId if provided
    if (userData.leadMrId) {
      const leadMr = await prisma.user.findUnique({
        where: { id: userData.leadMrId }
      });
      if (!leadMr || leadMr.role !== UserRole.LEAD_MR) {
        return errorResponse('INVALID_LEAD_MR', 'Invalid Lead MR specified');
      }
    }

    // Hash password before storing
    const hashedPassword = await hashPassword(userData.password);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword
      },
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

    return NextResponse.json(
      {
        success: true,
        message: 'User created successfully',
        data: newUser
      },
      { status: 201 }
    );
  } catch (error) {
    logError(error, 'POST /api/users', user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to create user', 500);
  }
}
