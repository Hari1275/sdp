import { NextRequest } from 'next/server';
import { UserRole, TaskStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  successResponse,
  errorResponse,
  logError,
  validateRequest,
  withAuth,
} from '@/lib/api-utils';
import { z } from 'zod';

// Schema for optional completion data
const taskCompletionSchema = z.object({
  notes: z.string().max(500, 'Completion notes must not exceed 500 characters').optional()
}).optional();

// type TaskCompletionInput = z.infer<typeof taskCompletionSchema>;

// Internal handler wrapped with auth. We'll export typed Next.js handlers below.
const putHandler = withAuth(
  async (
    request: NextRequest,
    user,
    context?: { params?: Promise<{ id: string }> }
  ) => {
    try {
      const awaitedParams = (await context?.params) as { id?: string } | undefined;
      const id = awaitedParams?.id as string;

      // Validate input (optional completion data)
      try {
        const body = await request.text();
        if (body.trim()) {
          const parsedBody = JSON.parse(body);
          const validation = validateRequest(taskCompletionSchema, parsedBody);
          if (!validation.success) {
            return errorResponse('VALIDATION_ERROR', validation.error);
          }
        }
      } catch {
        // Ignore JSON parsing errors for empty body - completion doesn't require body
      }

      // Find existing task with detailed information
      const existingTask = await prisma.task.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          status: true,
          assigneeId: true,
          createdById: true,
          regionId: true,
          assignee: {
            select: {
              id: true,
              name: true,
              leadMrId: true,
            },
          },
        },
      });

      if (!existingTask) {
        return errorResponse('TASK_NOT_FOUND', 'Task not found', 404);
      }

      // Check if task is already completed
      if (existingTask.status === TaskStatus.COMPLETED) {
        return errorResponse(
          'TASK_ALREADY_COMPLETED',
          'Task is already completed',
          400
        );
      }

      // Check completion permissions based on role
      let canComplete = false;

      switch (user.role) {
        case UserRole.MR:
          // MR can only complete tasks assigned to them
          if (existingTask.assigneeId === user.id) {
            canComplete = true;
          }
          break;
        case UserRole.LEAD_MR:
          // Lead MR can complete:
          // 1. Tasks assigned to them
          // 2. Tasks in their region
          // 3. Tasks assigned to their team members
          // 4. Tasks created by them
          if (
            existingTask.assigneeId === user.id ||
            existingTask.regionId === user.regionId ||
            existingTask.assignee?.leadMrId === user.id ||
            existingTask.createdById === user.id
          ) {
            canComplete = true;
          }
          break;
        case UserRole.ADMIN:
          // Admin can complete any task
          canComplete = true;
          break;
        default:
          return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
      }

      if (!canComplete) {
        return errorResponse(
          'FORBIDDEN',
          'You are not authorized to complete this task',
          403
        );
      }

      // Mark task as completed
      const completedTask = await prisma.task.update({
        where: { id },
        data: {
          status: TaskStatus.COMPLETED,
          completedAt: new Date(),
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

      // Log the completion action for audit trail
      // console.log(
      //   `Task completed: ${completedTask.id} by user: ${user.id} (${user.name}) at ${new Date().toISOString()}`
      // );

      return successResponse(
        {
          task: completedTask,
          completedBy: {
            id: user.id,
            name: user.name,
            username: user.username,
          },
          completionTimestamp: completedTask.completedAt,
        },
        'Task marked as completed successfully'
      );
    } catch (error) {
      let errId: string | undefined;
      try {
        const p = (await context?.params) as { id?: string } | undefined;
        errId = p?.id;
      } catch {}
      logError(error, `PUT /api/tasks/${errId}/complete`, user?.id);
      return errorResponse('INTERNAL_ERROR', 'Failed to complete task', 500);
    }
  }
);

// PUT /api/tasks/[id]/complete - Mark task as completed
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return putHandler(request, { params });
}

// POST /api/tasks/[id]/complete - Alternative endpoint for task completion
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return putHandler(request, { params });
}
