import { NextRequest, NextResponse } from "next/server";
import { UserRole, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getAuthenticatedUser,
  hasPermission,
  successResponse,
  errorResponse,
  validateRequest,
  logError,
  rateLimit,
  parseQueryParams,
} from "@/lib/api-utils";
import { createTaskSchema, CreateTaskInput } from "@/lib/validations";

// GET /api/tasks - List tasks with role-based filtering
export async function GET(request: NextRequest) {
  let user;

  try {
    // Rate limiting
    if (!rateLimit(request)) {
      return errorResponse(
        "RATE_LIMIT_EXCEEDED",
        "Too many requests. Please try again later.",
        429
      );
    }

    // Authentication
    user = await getAuthenticatedUser(request);
    if (!user) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    const { page, limit, sortBy, sortOrder } = parseQueryParams(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as TaskStatus | null;
    const assignedTo = searchParams.get("assignedTo");
    const regionId = searchParams.get("regionId");
    const areaId = searchParams.get("areaId");
    const priority = searchParams.get("priority");
    const createdById = searchParams.get("createdById");
    const search = searchParams.get("search") || undefined;
    const dueDateFrom = searchParams.get("dueDateFrom") || undefined;
    const dueDateTo = searchParams.get("dueDateTo") || undefined;

    // Build base query with role-based filtering
    const whereClause: Record<string, unknown> = {};

    // Apply role-based data access
    switch (user.role) {
      case UserRole.MR:
        // MR can only see tasks assigned to them
        whereClause.assigneeId = user.id;
        break;
      case UserRole.LEAD_MR:
        // Lead MR can see tasks assigned to their team or themselves, and tasks they created
        whereClause.OR = [
          { assignee: { leadMrId: user.id } },
          { assigneeId: user.id },
          { createdById: user.id },
        ];
        break;
      case UserRole.ADMIN:
        // Admin can see all tasks
        break;
      default:
        return errorResponse("FORBIDDEN", "Insufficient permissions", 403);
    }

    // Apply filters
    if (status) {
      whereClause.status = status;
    }

    if (assignedTo && user.role === UserRole.ADMIN) {
      whereClause.assigneeId = assignedTo;
    }

    if (regionId) {
      // Verify user has access to this region
      if (user.role === UserRole.LEAD_MR && regionId !== user.regionId) {
        return errorResponse(
          "FORBIDDEN",
          "You can only access tasks in your region",
          403
        );
      }
      if (user.role === UserRole.MR) {
        return errorResponse(
          "FORBIDDEN",
          "MR users cannot filter by region",
          403
        );
      }
      whereClause.regionId = regionId;
    }

    if (areaId) {
      whereClause.areaId = areaId;
    }

    if (priority) {
      whereClause.priority = priority;
    }

    if (createdById && user.role === UserRole.ADMIN) {
      whereClause.createdById = createdById;
    }

    // Apply search filters
    if (search) {
      const orConditions: Array<Record<string, unknown>> = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { assignee: { name: { contains: search, mode: "insensitive" } } },
      ];
      if (Array.isArray((whereClause as { OR?: unknown }).OR)) {
        (whereClause as { OR: Array<Record<string, unknown>> }).OR.push(
          ...orConditions
        );
      } else {
        (whereClause as { OR: Array<Record<string, unknown>> }).OR =
          orConditions;
      }
    }

    // Due date range filters
    if (dueDateFrom || dueDateTo) {
      const dueDateFilter: { gte?: Date; lte?: Date } = {};
      if (dueDateFrom) dueDateFilter.gte = new Date(dueDateFrom);
      if (dueDateTo) dueDateFilter.lte = new Date(dueDateTo);
      (whereClause as { dueDate?: { gte?: Date; lte?: Date } }).dueDate =
        dueDateFilter;
    }

    // Get total count
    const total = await prisma.task.count({ where: whereClause });

    // Get tasks with related data
    const tasks = await prisma.task.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        region: {
          select: {
            id: true,
            name: true,
          },
        },
        area: {
          select: {
            id: true,
            name: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    });

    const response = {
      data: tasks.map((t) => ({
        ...t,
        isOverdue: t.dueDate
          ? t.dueDate < new Date() && t.status !== TaskStatus.COMPLETED
          : false,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };

    return successResponse(response);
  } catch (error) {
    logError(error, "GET /api/tasks", user?.id);
    return errorResponse("INTERNAL_ERROR", "Failed to fetch tasks", 500);
  }
}

// POST /api/tasks - Create new task
export async function POST(request: NextRequest) {
  let user;

  try {
    // Rate limiting
    if (!rateLimit(request)) {
      return errorResponse(
        "RATE_LIMIT_EXCEEDED",
        "Too many requests. Please try again later.",
        429
      );
    }

    // Authentication
    user = await getAuthenticatedUser(request);
    if (!user) {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    // Authorization - Lead MR and Admin can create tasks
    if (!hasPermission(user.role, [UserRole.ADMIN, UserRole.LEAD_MR])) {
      return errorResponse(
        "FORBIDDEN",
        "Only Lead MR and Admin can create tasks",
        403
      );
    }

    const body = await request.json();

    // Validate input
    const validation = validateRequest(createTaskSchema, body);
    if (!validation.success) {
      return errorResponse("VALIDATION_ERROR", validation.error);
    }

    const taskData = validation.data as CreateTaskInput;

    // Verify region exists and user has access
    const region = await prisma.region.findUnique({
      where: { id: taskData.regionId },
      select: { id: true, name: true },
    });

    if (!region) {
      return errorResponse("REGION_NOT_FOUND", "Region not found", 404);
    }

    // Lead MR can only create tasks in their region
    if (user.role === UserRole.LEAD_MR && taskData.regionId !== user.regionId) {
      return errorResponse(
        "FORBIDDEN",
        "You can only create tasks in your region",
        403
      );
    }

    // Verify area exists (if provided)
    if (taskData.areaId) {
      const area = await prisma.area.findUnique({
        where: { id: taskData.areaId },
        select: { id: true, regionId: true },
      });

      if (!area) {
        return errorResponse("AREA_NOT_FOUND", "Area not found", 404);
      }

      if (area.regionId !== taskData.regionId) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Area must belong to the specified region"
        );
      }
    }

    // Verify assignee exists and has appropriate access
    const assignee = await prisma.user.findUnique({
      where: { id: taskData.assigneeId },
      select: {
        id: true,
        name: true,
        role: true,
        regionId: true,
        leadMrId: true,
      },
    });

    if (!assignee) {
      return errorResponse("ASSIGNEE_NOT_FOUND", "Assignee not found", 404);
    }

    // Verify assignee permissions based on creator role
    if (user.role === UserRole.LEAD_MR) {
      // Lead MR can only assign to MRs in their region or their team
      if (assignee.role === UserRole.MR) {
        if (
          assignee.regionId !== user.regionId &&
          assignee.leadMrId !== user.id
        ) {
          return errorResponse(
            "FORBIDDEN",
            "You can only assign tasks to MRs in your region or team",
            403
          );
        }
      } else {
        return errorResponse(
          "FORBIDDEN",
          "Lead MR can only assign tasks to MR users",
          403
        );
      }
    }

    // Create task with creator information
    const newTask = await prisma.task.create({
      data: {
        ...taskData,
        createdById: user.id,
        status: TaskStatus.PENDING,
        dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        region: {
          select: {
            id: true,
            name: true,
          },
        },
        area: {
          select: {
            id: true,
            name: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Task created successfully",
        data: newTask,
      },
      { status: 201 }
    );
  } catch (error) {
    logError(error, "POST /api/tasks", user?.id);
    return errorResponse("INTERNAL_ERROR", "Failed to create task", 500);
  }
}
