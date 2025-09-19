import { z } from "zod";
import {
  UserRole,
  BusinessType,
  TaskStatus,
  Priority,
  UserStatus,
  NotificationType,
} from "@prisma/client";

// User validation schemas
export const createUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(30),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  phone: z
    .string()
    .regex(/^[0-9]{10}$/, "Phone number must be 10 digits")
    .optional(),
  role: z.nativeEnum(UserRole).default(UserRole.MR),
  regionId: z.string().optional(),
  leadMrId: z.string().optional(),
});

export const updateUserSchema = createUserSchema.partial().extend({
  status: z.nativeEnum(UserStatus).optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .optional(),
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// Region validation schemas
export const createRegionSchema = z.object({
  name: z.string().min(2, "Region name must be at least 2 characters").max(100),
  description: z.string().optional(),
});

export const updateRegionSchema = createRegionSchema.partial();

// Area validation schemas
export const createAreaSchema = z.object({
  name: z.string().min(2, "Area name must be at least 2 characters").max(100),
  description: z.string().optional(),
  regionId: z.string().min(1, "Region is required"),
});

export const updateAreaSchema = createAreaSchema
  .partial()
  .omit({ regionId: true });

// Client validation schemas
export const createClientSchema = z.object({
  name: z.string().min(2, "Client name must be at least 2 characters").max(200),
  phone: z
    .string()
    .regex(/^[0-9]{10}$/, "Phone number must be 10 digits")
    .optional(),
  businessType: z.nativeEnum(BusinessType),
  areaId: z.string().min(1, "Area is required"),
  regionId: z.string().min(1, "Region is required"),
  latitude: z.number().min(-90).max(90, "Invalid latitude"),
  longitude: z.number().min(-180).max(180, "Invalid longitude"),
  address: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
  mrId: z.string().min(1, "MR is required"),
});

export const updateClientSchema = createClientSchema.partial().omit({
  latitude: true,
  longitude: true,
  mrId: true,
});

// Business Entry validation schemas
export const createBusinessEntrySchema = z.object({
  amount: z.number().min(0, "Amount must be positive"),
  notes: z.string().max(500).optional(),
  clientId: z.string().min(1, "Client is required"),
  latitude: z.number().min(-90).max(90, "Invalid latitude"),
  longitude: z.number().min(-180).max(180, "Invalid longitude"),
  documentLink: z.string().optional(),
});

// Task validation schemas
export const createTaskSchema = z.object({
  title: z.string().min(5, "Task title must be at least 5 characters").max(200),
  description: z.string().max(1000).optional(),
  regionId: z.string().min(1, "Region is required"),
  areaId: z.string().optional(),
  assigneeId: z.string().min(1, "Assignee is required"),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  dueDate: z.string().datetime().optional(),
});

export const updateTaskSchema = createTaskSchema
  .partial()
  .omit({
    regionId: true,
  })
  .extend({
    status: z.nativeEnum(TaskStatus).optional(),
  });

export const updateTaskStatusSchema = z.object({
  status: z.nativeEnum(TaskStatus),
  completedAt: z.string().datetime().optional(),
});

// Task assignment schemas
export const assignTaskSchema = z.object({
  assigneeId: z.string().min(1, "Assignee is required"),
  reason: z.string().max(500).optional(),
});

export const bulkAssignTaskSchema = z.object({
  taskIds: z.array(z.string().min(1)).min(1, "At least one taskId required"),
  assigneeId: z.string().min(1, "Assignee is required"),
  reason: z.string().max(500).optional(),
});

// Task notification schemas
export const sendTaskNotificationSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  type: z.nativeEnum(NotificationType).default(NotificationType.TASK_UPDATE),
  message: z.string().min(1, "Message is required").max(1000),
  taskId: z.string().optional(),
  title: z.string().optional(),
});

// Task analytics filter schemas
export const taskAnalyticsCompletionRateSchema = z.object({
  userId: z.string().optional(),
  regionId: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export const taskAnalyticsEfficiencySchema = z.object({
  userId: z.string().optional(),
  regionId: z.string().optional(),
  period: z.enum(["daily", "weekly", "monthly"]).default("daily"),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export const taskAnalyticsOverdueSchema = z.object({
  userId: z.string().optional(),
  regionId: z.string().optional(),
});

// GPS validation schemas
export const createGPSSessionSchema = z.object({
  checkInTime: z.string().datetime(),
  latitude: z.number().min(-90).max(90, "Invalid latitude"),
  longitude: z.number().min(-180).max(180, "Invalid longitude"),
});

export const updateGPSSessionSchema = z.object({
  checkOutTime: z.string().datetime(),
  totalHours: z.number().min(0).optional(),
  totalKms: z.number().min(0).optional(),
});

export const createGPSLogSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
  latitude: z.number().min(-90).max(90, "Invalid latitude"),
  longitude: z.number().min(-180).max(180, "Invalid longitude"),
  accuracy: z.number().min(0).optional(),
  speed: z.number().min(0).optional(),
});

// Filter schemas
export const userFilterSchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  regionId: z.string().optional(),
  leadMrId: z.string().optional(),
  search: z.string().optional(),
});

export const clientFilterSchema = z.object({
  businessType: z.nativeEnum(BusinessType).optional(),
  regionId: z.string().optional(),
  areaId: z.string().optional(),
  mrId: z.string().optional(),
  search: z.string().optional(),
});

export const taskFilterSchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  regionId: z.string().optional(),
  areaId: z.string().optional(),
  assigneeId: z.string().optional(),
  createdById: z.string().optional(),
  search: z.string().optional(),
  dueDateFrom: z.string().datetime().optional(),
  dueDateTo: z.string().datetime().optional(),
});

// Report filter schemas
export const reportFilterSchema = z.object({
  dateFrom: z.string().date(),
  dateTo: z.string().date(),
  regionId: z.string().optional(),
  mrId: z.string().optional(),
  type: z.enum(["daily", "monthly", "custom"]).default("daily"),
});

// Pagination schema
export const paginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// Type exports
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateRegionInput = z.infer<typeof createRegionSchema>;
export type UpdateRegionInput = z.infer<typeof updateRegionSchema>;
export type CreateAreaInput = z.infer<typeof createAreaSchema>;
export type UpdateAreaInput = z.infer<typeof updateAreaSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type CreateBusinessEntryInput = z.infer<
  typeof createBusinessEntrySchema
>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
export type CreateGPSSessionInput = z.infer<typeof createGPSSessionSchema>;
export type UpdateGPSSessionInput = z.infer<typeof updateGPSSessionSchema>;
export type CreateGPSLogInput = z.infer<typeof createGPSLogSchema>;
export type UserFilterInput = z.infer<typeof userFilterSchema>;
export type ClientFilterInput = z.infer<typeof clientFilterSchema>;
export type TaskFilterInput = z.infer<typeof taskFilterSchema>;
export type ReportFilterInput = z.infer<typeof reportFilterSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type AssignTaskInput = z.infer<typeof assignTaskSchema>;
export type BulkAssignTaskInput = z.infer<typeof bulkAssignTaskSchema>;
export type SendTaskNotificationInput = z.infer<
  typeof sendTaskNotificationSchema
>;
export type TaskAnalyticsCompletionRateInput = z.infer<
  typeof taskAnalyticsCompletionRateSchema
>;
export type TaskAnalyticsEfficiencyInput = z.infer<
  typeof taskAnalyticsEfficiencySchema
>;
export type TaskAnalyticsOverdueInput = z.infer<
  typeof taskAnalyticsOverdueSchema
>;
