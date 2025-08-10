import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { UserRole } from "@prisma/client";
import { prisma } from "./prisma";
import { AuthenticatedUser, QueryParams, FilterWhere } from "../types/api";

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = unknown> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  code?: string;
}

// Response formatters
export function successResponse<T>(
  data?: T,
  message?: string
): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    message,
  });
}

export function paginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): NextResponse<PaginatedResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export function errorResponse(
  error: string,
  message: string,
  status = 400,
  code?: string
): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
      message,
      code,
    },
    { status }
  );
}

// Rate Limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(
  request: NextRequest,
  limit = 100,
  windowMs = 15 * 60 * 1000
): boolean {
  const ip =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "anonymous";
  const now = Date.now();
  const userLimit = rateLimitMap.get(ip);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(ip, {
      count: 1,
      resetTime: now + windowMs,
    });
    return true;
  }

  if (userLimit.count >= limit) {
    return false;
  }

  userLimit.count++;
  return true;
}

// Authentication helpers
export async function getAuthenticatedUser(request: NextRequest) {
  try {
    // First try JWT token from Authorization header (for mobile)
    const { extractTokenFromRequest, getAuthenticatedUserFromToken, JWTError } =
      await import("./jwt");

    const jwtToken = extractTokenFromRequest(request);
    if (jwtToken) {
      try {
        return await getAuthenticatedUserFromToken(jwtToken);
      } catch (error) {
        if (error instanceof JWTError) {
          console.log("JWT authentication failed:", error.message);
          // Continue to session-based authentication
        } else {
          console.error("JWT authentication error:", error);
        }
      }
    }

    // Fallback to session-based authentication (for web)
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        region: true,
        leadMr: true,
      },
    });

    return user;
  } catch (error) {
    console.error("Authentication error:", error);
    return null;
  }
}

// Role-based access control
export function hasPermission(
  userRole: UserRole,
  requiredRoles: UserRole[]
): boolean {
  return requiredRoles.includes(userRole);
}

export function isAdmin(userRole: UserRole): boolean {
  return userRole === UserRole.ADMIN;
}

export function isLeadMR(userRole: UserRole): boolean {
  return userRole === UserRole.LEAD_MR;
}

export function isMR(userRole: UserRole): boolean {
  return userRole === UserRole.MR;
}

// Authorization middleware wrapper
export function withAuth(
  handler: (
    request: NextRequest,
    user: AuthenticatedUser,
    context?: Record<string, unknown>
  ) => Promise<NextResponse>,
  requiredRoles?: UserRole[]
) {
  return async (request: NextRequest, context?: Record<string, unknown>) => {
    // Rate limiting
    if (!rateLimit(request)) {
      return errorResponse(
        "RATE_LIMIT_EXCEEDED",
        "Too many requests. Please try again later.",
        429
      );
    }

    // Authentication
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    // Authorization
    if (requiredRoles && !hasPermission(user.role, requiredRoles)) {
      return errorResponse("FORBIDDEN", "Insufficient permissions", 403);
    }

    try {
      return await handler(request, user, context);
    } catch (error) {
      logError(error, "Unhandled API Error", user.id);
      return errorResponse(
        "INTERNAL_SERVER_ERROR",
        "An unexpected error occurred",
        500
      );
    }
  };
}

// Validation middleware
export function validateRequest<T>(
  schema: { parse: (data: unknown) => T },
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const validatedData: T = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error: unknown) {
    const errorMessage =
      (error as { issues?: Array<{ message: string }> })?.issues
        ?.map((issue) => issue.message)
        .join(", ") || "Validation failed";
    return { success: false, error: errorMessage };
  }
}

// Query parameter parsing
export function getQueryParams(request: NextRequest): QueryParams {
  const { searchParams } = new URL(request.url);
  const params: QueryParams = {};

  searchParams.forEach((value, key) => {
    // Convert numeric strings to numbers
    if (!isNaN(Number(value))) {
      params[key] = Number(value);
    } else if (value === "true" || value === "false") {
      // Convert boolean strings to booleans
      params[key] = value === "true";
    } else {
      params[key] = value;
    }
  });

  return params;
}

// Pagination helpers
export function getPaginationParams(request: NextRequest) {
  const params = getQueryParams(request);
  return {
    page: (params.page as number) || 1,
    limit: Math.min((params.limit as number) || 10, 100), // Max 100 items per page
    sortBy: (params.sortBy as string) || "createdAt",
    sortOrder: (params.sortOrder as "asc" | "desc") || "desc",
  };
}

// Role-based data filtering
export function applyRoleBasedFilters(
  user: AuthenticatedUser,
  baseWhere: FilterWhere = {}
): FilterWhere {
  const where = { ...baseWhere };

  switch (user.role) {
    case UserRole.MR:
      // MR can only see their own data
      where.OR = [
        { mrId: user.id },
        { createdById: user.id },
        { assigneeId: user.id },
      ];
      break;
    case UserRole.LEAD_MR:
      // Lead MR can see their team's data and their region's data
      where.OR = [
        { regionId: user.regionId },
        { mr: { leadMrId: user.id } },
        { createdById: user.id },
        { assigneeId: user.id },
      ];
      break;
    case UserRole.ADMIN:
      // Admin can see all data - no additional filters
      break;
  }

  return where;
}

// Error logging
export function logError(
  error: Error | unknown,
  context: string,
  userId?: string
) {
  const errorObj =
    error instanceof Error
      ? error
      : new Error(typeof error === "string" ? error : "Unknown error");

  // Capture to Sentry with context and user
  Sentry.withScope((scope) => {
    scope.setContext("api", {
      context,
      timestamp: new Date().toISOString(),
    });
    if (userId) {
      scope.setUser({ id: userId });
    }
    Sentry.captureException(errorObj);
  });

  // Keep console output for local debugging and tests
  console.error(`[${context}] Error:`, {
    message: errorObj.message || "Unknown error",
    stack: errorObj.stack || "No stack trace",
    userId,
    timestamp: new Date().toISOString(),
  });
}

// File upload helpers (for future use)
export function validateFileUpload(
  file: File,
  allowedTypes: string[],
  maxSize: number
) {
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: "Invalid file type" };
  }

  if (file.size > maxSize) {
    return { valid: false, error: "File size too large" };
  }

  return { valid: true };
}

// Parse query parameters with proper typing
export function parseQueryParams(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  return {
    page: Math.max(1, parseInt(searchParams.get("page") || "1", 10)),
    limit: Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "10", 10))
    ),
    search: searchParams.get("search") || undefined,
    role: searchParams.get("role") || undefined,
    status: searchParams.get("status") || undefined,
    regionId: searchParams.get("regionId") || undefined,
    leadMrId: searchParams.get("leadMrId") || undefined,
    sortBy: searchParams.get("sortBy") || "createdAt",
    sortOrder: (searchParams.get("sortOrder") as "asc" | "desc") || "desc",
  };
}

// Object ID validation helper
export function validateObjectId(id: string): boolean {
  // MongoDB ObjectId validation pattern
  const objectIdPattern = /^[0-9a-fA-F]{24}$/;
  return typeof id === "string" && objectIdPattern.test(id);
}

// Health check helper
export async function checkDatabaseHealth() {
  try {
    // Use a simple query to check database connectivity
    await prisma.user.findFirst({ take: 1 });
    return { status: "healthy", message: "Database connection successful" };
  } catch (error) {
    return {
      status: "unhealthy",
      message: "Database connection failed",
      error,
    };
  }
}
