import { AuthenticatedUser } from "@/types/api";
import { UserRole } from "@prisma/client";

/**
 * Base interface for role-based where conditions
 */
interface BaseWhereConditions {
  createdAt?: Record<string, unknown>;
  updatedAt?: Record<string, unknown>;
}

/**
 * Get the base where conditions for data filtered by lead MR team
 * @param user Authenticated user object
 * @returns Where conditions for Prisma
 */
function getTeamBasedConditions(user: AuthenticatedUser) {
  console.log("[TeamFilter] Computing team conditions for:", {
    userId: user.id,
    role: user.role,
    leadMrId: user?.leadMrId,
    regionId: user?.regionId
  });
  if (!user) return {};

  switch (user.role) {
    case UserRole.ADMIN:
      return {};
    case UserRole.LEAD_MR:
      return {
        OR: [
          { mrId: user.id },
          { mr: { leadMrId: user.id } },
        ],
      };
    case UserRole.MR:
      return { mrId: user.id };
    default:
      return {};
  }
}

/**
 * Filter tasks based on user role (Admin sees all, Lead MR sees team's, MR sees own)
 */
export function getTasksFilter(
  user: AuthenticatedUser,
  baseConditions: BaseWhereConditions = {}
) {
  console.log("[TaskFilter] Computing task filters for:", {
    userId: user.id,
    role: user.role,
    base: baseConditions
  });
  if (!user) return baseConditions;

  switch (user.role) {
    case UserRole.ADMIN:
      return baseConditions;
    case UserRole.LEAD_MR:
      const filter = {
        ...baseConditions,
        OR: [
          { assigneeId: user.id },
          { assignee: { leadMrId: user.id } },
          { creatorId: user.id },
        ],
      };
      console.log("[TaskFilter] Lead MR where clause:", filter);
      return filter;
    case UserRole.MR:
      return {
        ...baseConditions,
        OR: [
          { assigneeId: user.id },
          { creatorId: user.id },
        ],
      };
    default:
      return baseConditions;
  }
}

/**
 * Filter clients based on user role
 */
export function getClientsFilter(
  user: AuthenticatedUser,
  baseConditions: BaseWhereConditions = {}
) {
  console.log("[ClientFilter] Computing client filters for:", {
    userId: user.id,
    role: user.role,
    base: baseConditions
  });
  if (!user) return baseConditions;

  const teamConditions = getTeamBasedConditions(user);
  const filter = { ...baseConditions, ...teamConditions };
  console.log("[ClientFilter] Final where clause:", filter);
  return filter;
}

/**
 * Filter business entries based on user role
 */
export function getBusinessFilter(
  user: AuthenticatedUser,
  baseConditions: BaseWhereConditions = {}
) {
  console.log("[BusinessFilter] Computing business filters for:", {
    userId: user.id,
    role: user.role,
    base: baseConditions
  });
  if (!user) return baseConditions;

  const teamConditions = getTeamBasedConditions(user);
  const filter = { ...baseConditions, ...teamConditions };
  console.log("[BusinessFilter] Final where clause:", filter);
  return filter;
}

/**
 * Filter GPS sessions based on user role
 */
export function getGPSSessionFilter(
  user: AuthenticatedUser,
  baseConditions: BaseWhereConditions = {}
) {
  console.log("[GPSSessionFilter] Computing GPS session filters for:", {
    userId: user.id,
    role: user.role,
    base: baseConditions
  });
  if (!user) return baseConditions;

  switch (user.role) {
    case UserRole.ADMIN:
      return baseConditions;
    case UserRole.LEAD_MR:
      {
        const filter = {
          ...baseConditions,
          OR: [
            { userId: user.id },
            { user: { leadMrId: user.id } },
          ],
        };
        console.log("[GPSSessionFilter] Lead MR where clause:", filter);
        return filter;
      }
    case UserRole.MR:
      return {
        ...baseConditions,
        userId: user.id,
      };
    default:
      return baseConditions;
  }
}

/**
 * Filter team members (users) based on user role
 */
export function getTeamMembersFilter(
  user: AuthenticatedUser,
  baseConditions: BaseWhereConditions = {}
) {
  if (!user) return baseConditions;

  switch (user.role) {
    case UserRole.ADMIN:
      return baseConditions;
    case UserRole.LEAD_MR:
      return {
        ...baseConditions,
        OR: [
          { id: user.id },
          { leadMrId: user.id },
        ],
      };
    case UserRole.MR:
      return {
        ...baseConditions,
        id: user.id,
      };
    default:
      return baseConditions;
  }
}