import { create } from "zustand";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";
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
  completedFrom?: string;
  completedTo?: string;
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
    set({
      isLoading: true,
      error: null,
      pagination: { ...get().pagination, page, limit },
    });
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      const { filters } = get();
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
      });
      const list = await apiGet<Task & { isOverdue?: boolean }>(
        `/api/tasks?${params.toString()}`
      );
      set({ tasks: list, isLoading: false });
    } catch (error) {
      // console.error("Failed to fetch tasks", error);
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

  deleteTask: async (taskId) => {
    await apiDelete(`/api/tasks/${taskId}`);
    await get().fetchTasks(get().pagination.page, get().pagination.limit);
  },
}));
