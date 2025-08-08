import { NextRequest } from 'next/server';
import { UserRole, TaskStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  getAuthenticatedUser,
  hasPermission,
  successResponse,
  errorResponse,
  validateRequest,
  logError,
  rateLimit
} from '@/lib/api-utils';
import { updateTaskSchema, UpdateTaskInput } from '@/lib/validations';

// GET /api/tasks/[id] - Get individual task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;

    // Find task with full details
    const task = await prisma.task.findUnique({
      where: { id },
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
        assigneeId: true,
        createdById: true,
        regionId: true,
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
        assignee: {
          select: {
            id: true,
            name: true,
            username: true,
            leadMrId: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            username: true
          }
        }
      }
    });

    if (!task) {
      return errorResponse('TASK_NOT_FOUND', 'Task not found', 404);
    }

    // Check access permissions based on role
    switch (user.role) {
      case UserRole.MR:
        // MR can only access tasks assigned to them
        if (task.assigneeId !== user.id) {
          return errorResponse('FORBIDDEN', 'You can only access tasks assigned to you', 403);
        }
        break;
      case UserRole.LEAD_MR:
        // Lead MR can access tasks in their region or assigned to their team
        if (task.regionId !== user.regionId && 
            task.assignee?.leadMrId !== user.id && 
            task.assigneeId !== user.id && 
            task.createdById !== user.id) {
          return errorResponse('FORBIDDEN', 'You can only access tasks in your region or assigned to your team', 403);
        }
        break;
      case UserRole.ADMIN:
        // Admin can access all tasks
        break;
      default:
        return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    }

    return successResponse(task);
  } catch (error) {
    logError(error, `GET /api/tasks/${(await params).id}`, user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch task', 500);
  }
}

// PUT /api/tasks/[id] - Update task details
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Authorization - Lead MR and Admin can update tasks
    if (!hasPermission(user.role, [UserRole.ADMIN, UserRole.LEAD_MR])) {
      return errorResponse('FORBIDDEN', 'Only Lead MR and Admin can update tasks', 403);
    }

    const { id } = await params;
    const body = await request.json();

    // Validate input
    const validation = validateRequest(updateTaskSchema, body);
    if (!validation.success) {
      return errorResponse('VALIDATION_ERROR', validation.error);
    }

    const updateData = validation.data as UpdateTaskInput;

    // Find existing task
    const existingTask = await prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        regionId: true,
        assigneeId: true,
        createdById: true,
        status: true,
        assignee: {
          select: {
            leadMrId: true
          }
        }
      }
    });

    if (!existingTask) {
      return errorResponse('TASK_NOT_FOUND', 'Task not found', 404);
    }

    // Check update permissions based on role
    if (user.role === UserRole.LEAD_MR) {
      // Lead MR can only update tasks in their region or assigned to their team
      if (existingTask.regionId !== user.regionId && 
          existingTask.assignee?.leadMrId !== user.id && 
          existingTask.createdById !== user.id) {
        return errorResponse('FORBIDDEN', 'You can only update tasks in your region or assigned to your team', 403);
      }
    }

    // Verify area exists and belongs to task's region (if provided)
    if (updateData.areaId) {
      const area = await prisma.area.findUnique({
        where: { id: updateData.areaId },
        select: { id: true, regionId: true }
      });

      if (!area) {
        return errorResponse('AREA_NOT_FOUND', 'Area not found', 404);
      }

      if (area.regionId !== existingTask.regionId) {
        return errorResponse('VALIDATION_ERROR', 'Area must belong to the task region');
      }
    }

    // Verify assignee exists and has appropriate access (if provided)
    if (updateData.assigneeId) {
      const assignee = await prisma.user.findUnique({
        where: { id: updateData.assigneeId },
        select: { 
          id: true, 
          name: true, 
          role: true, 
          regionId: true,
          leadMrId: true
        }
      });

      if (!assignee) {
        return errorResponse('ASSIGNEE_NOT_FOUND', 'Assignee not found', 404);
      }

      // Verify assignee permissions based on updater role
      if (user.role === UserRole.LEAD_MR) {
        // Lead MR can only assign to MRs in their region or their team
        if (assignee.role === UserRole.MR) {
          if (assignee.regionId !== user.regionId && assignee.leadMrId !== user.id) {
            return errorResponse('FORBIDDEN', 'You can only assign tasks to MRs in your region or team', 403);
          }
        } else {
          return errorResponse('FORBIDDEN', 'Lead MR can only assign tasks to MR users', 403);
        }
      }
    }

    // Cannot directly update status to COMPLETED via this endpoint
    if (updateData.status === TaskStatus.COMPLETED) {
      return errorResponse('VALIDATION_ERROR', 'Use the completion endpoint to mark tasks as completed');
    }

    // Prepare update data
    const updateFields: Record<string, unknown> = { ...updateData };
    if (updateData.dueDate) {
      updateFields.dueDate = new Date(updateData.dueDate);
    }

    // Update task
    const updatedTask = await prisma.task.update({
      where: { id },
      data: updateFields,
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
            name: true
          }
        },
        area: {
          select: {
            id: true,
            name: true
          }
        },
        assignee: {
          select: {
            id: true,
            name: true,
            username: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            username: true
          }
        }
      }
    });

    return successResponse(updatedTask, 'Task updated successfully');
  } catch (error) {
    logError(error, `PUT /api/tasks/${(await params).id}`, user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to update task', 500);
  }
}

// DELETE /api/tasks/[id] - Delete task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Authorization - Lead MR and Admin can delete tasks
    if (!hasPermission(user.role, [UserRole.ADMIN, UserRole.LEAD_MR])) {
      return errorResponse('FORBIDDEN', 'Only Lead MR and Admin can delete tasks', 403);
    }

    const { id } = await params;

    // Find existing task
    const existingTask = await prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        regionId: true,
        createdById: true,
        assignee: {
          select: {
            leadMrId: true
          }
        }
      }
    });

    if (!existingTask) {
      return errorResponse('TASK_NOT_FOUND', 'Task not found', 404);
    }

    // Check delete permissions based on role
    if (user.role === UserRole.LEAD_MR) {
      // Lead MR can only delete tasks in their region or created by them
      if (existingTask.regionId !== user.regionId && 
          existingTask.createdById !== user.id) {
        return errorResponse('FORBIDDEN', 'You can only delete tasks in your region or created by you', 403);
      }
    }

    // Delete task
    await prisma.task.delete({
      where: { id }
    });

    return successResponse(null, 'Task deleted successfully');
  } catch (error) {
    logError(error, `DELETE /api/tasks/${(await params).id}`, user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to delete task', 500);
  }
}
