import { create } from "zustand";
import { apiPost, apiPut, apiDelete, safeApiCall } from "@/lib/api-client";
import type { Task } from "@/types";

export type TaskFilters = {
  search?: string;
  status?: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  regionId?: string;
  areaId?: string;
  assigneeId?: string;
  createdById?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

interface TaskStore {
  tasks: Array<Task & { isOverdue?: boolean }>;
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: TaskFilters;

  isSheetOpen: boolean;
  selectedTask: (Task & { isOverdue?: boolean }) | null;

  fetchTasks: (page?: number, limit?: number) => Promise<void>;
  setFilters: (filters: Partial<TaskFilters>) => void;

  openTaskSheet: (task?: Task & { isOverdue?: boolean }) => void;
  closeTaskSheet: () => void;

  assignTask: (
    taskId: string,
    assigneeId: string,
    reason?: string
  ) => Promise<void>;
  bulkAssign: (
    taskIds: string[],
    assigneeId: string,
    reason?: string
  ) => Promise<void>;
  updateStatus: (
    taskId: string,
    status: "PENDING" | "IN_PROGRESS" | "CANCELLED"
  ) => Promise<void>;
  completeTask: (taskId: string, notes?: string) => Promise<void>;
  updateTask: (taskId: string, data: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  isLoading: false,
  error: null,
  pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
  filters: { sortBy: "createdAt", sortOrder: "desc" },

  isSheetOpen: false,
  selectedTask: null,

  fetchTasks: async (page = 1, limit = 10) => {
    set({ isLoading: true, error: null, pagination: { ...get().pagination, page, limit } });
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      const { filters } = get();
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
      });
      const result = await safeApiCall<{
        data: Array<Task & { isOverdue?: boolean }>;
        pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
      }>(`/api/tasks?${params.toString()}`);
      if (!result.success) {
        throw new Error(result.error);
      }
      type PaginatedTasks = {
        data: Array<Task & { isOverdue?: boolean }>;
        pagination: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
      };
      const payload = result.data as PaginatedTasks | Array<Task & { isOverdue?: boolean }>;
      let list: Array<Task & { isOverdue?: boolean }> = [];
      let pg = { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: page > 1 };
      if (Array.isArray(payload)) {
        list = payload;
        pg = { page, limit, total: payload.length, totalPages: Math.ceil(payload.length / limit), hasNext: false, hasPrev: page > 1 };
      } else if (payload && Array.isArray(payload.data)) {
        list = payload.data;
        pg = payload.pagination;
      }
      set({
        tasks: list,
        isLoading: false,
        pagination: {
          page: pg.page ?? page,
          limit: pg.limit ?? limit,
          total: pg.total ?? list.length,
          totalPages: pg.totalPages ?? Math.ceil((pg.total ?? list.length) / (pg.limit ?? limit)),
        },
      });
    } catch (error) {
      console.error("Failed to fetch tasks", error);
      set({
        tasks: [],
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to fetch tasks",
      });
    }
  },

  setFilters: (filters: Partial<TaskFilters>) => {
    set((state) => ({ filters: { ...state.filters, ...filters } }));
  },

  openTaskSheet: (task) =>
    set({ isSheetOpen: true, selectedTask: task || null }),
  closeTaskSheet: () => set({ isSheetOpen: false, selectedTask: null }),

  assignTask: async (taskId, assigneeId, reason) => {
    await apiPost(`/api/tasks/${taskId}/assign`, { assigneeId, reason });
    await get().fetchTasks(get().pagination.page, get().pagination.limit);
  },

  bulkAssign: async (taskIds, assigneeId, reason) => {
    await apiPost(`/api/tasks/assign-bulk`, { taskIds, assigneeId, reason });
    await get().fetchTasks(get().pagination.page, get().pagination.limit);
  },

  updateStatus: async (taskId, status) => {
    await apiPut(`/api/tasks/${taskId}/status`, { status });
    await get().fetchTasks(get().pagination.page, get().pagination.limit);
  },

  completeTask: async (taskId, notes) => {
    await apiPut(
      `/api/tasks/${taskId}/complete`,
      notes ? { notes } : undefined
    );
    await get().fetchTasks(get().pagination.page, get().pagination.limit);
  },

  // Additional actions
  updateTask: async (taskId: string, data: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>) => {
    await apiPut(`/api/tasks/${taskId}`, data);
    await get().fetchTasks(get().pagination.page, get().pagination.limit);
  },
  deleteTask: async (taskId: string) => {
    await apiDelete(`/api/tasks/${taskId}`);
    await get().fetchTasks(get().pagination.page, get().pagination.limit);
  },
}));
