import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "./prisma";
import { getAuthenticatedUser, errorResponse } from "./api-utils";

export function withRoleAccess(
  handler: (request: NextRequest, user: any) => Promise<Response>,
  allowedRoles: UserRole[] = []
) {
  return async function (request: NextRequest): Promise<Response> {
    try {
      // Authentication
      const user = await getAuthenticatedUser(request);
      if (!user) {
        return errorResponse("UNAUTHORIZED", "Authentication required", 401);
      }

      // Authorization
      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        return errorResponse("FORBIDDEN", "Insufficient permissions", 403);
      }

      // Call the actual handler with the authenticated user
      return handler(request, user);
    } catch (error) {
      console.error("API Error:", error);
      return errorResponse("INTERNAL_SERVER_ERROR", "Internal server error", 500);
    }
  };
}

export function withLeadMRTeamAccess(
  handler: (request: NextRequest, user: any) => Promise<Response>
) {
  return async function (request: NextRequest): Promise<Response> {
    try {
      const user = await getAuthenticatedUser(request);
      if (!user) {
        return errorResponse("UNAUTHORIZED", "Authentication required", 401);
      }

      // For Lead MR, ensure they can only access their team's data
      if (user.role === UserRole.LEAD_MR) {
        // Get user/MR ID from query params or body
        const { searchParams } = new URL(request.url);
        const mrId = searchParams.get("mrId");

        if (mrId && mrId !== user.id) {
          // Verify this MR is part of the Lead MR's team
          try {
            const memberMr = await prisma.user.findUnique({
              where: { id: mrId },
              select: { leadMrId: true },
            });

            if (!memberMr || memberMr.leadMrId !== user.id) {
              return errorResponse("FORBIDDEN", "Cannot access data outside your team", 403);
            }
          } catch (error) {
            return errorResponse("INTERNAL_SERVER_ERROR", "Error verifying team access", 500);
          }
        }
      }

      return handler(request, user);
    } catch (error) {
      console.error("API Error:", error);
      return errorResponse("INTERNAL_SERVER_ERROR", "Internal server error", 500);
    }
  };
}

/**
 * Check if a user has permission to access a specific entity (task, client, business entry)
 * owned by another user.
 */
export async function hasEntityAccess(
  user: { id: string; role: UserRole; leadMrId?: string | null },
  ownerId: string
): Promise<boolean> {
  // Admin has access to all entities
  if (user.role === UserRole.ADMIN) {
    return true;
  }

  // Users can access their own entities
  if (user.id === ownerId) {
    return true;
  }

  // Lead MR can access their team members' entities
  if (user.role === UserRole.LEAD_MR) {
    try {
      const owner = await prisma.user.findUnique({
        where: { id: ownerId },
        select: { leadMrId: true },
      });
      return !!owner && owner.leadMrId === user.id;
    } catch {
      return false;
    }
  }

  // MR can only access their own entities
  return false;
}