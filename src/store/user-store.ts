import { create } from "zustand";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";

type User = {
  id: string;
  username: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: "MR" | "LEAD_MR" | "ADMIN";
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  regionId: string | null;
  region?: { id: string; name: string } | null;
  leadMrId: string | null;
  leadMr?: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    clients: number;
    assignedTasks: number;
    teamMembers: number;
  };
};

type Region = {
  id: string;
  name: string;
  description?: string | null;
  status: "ACTIVE" | "INACTIVE";
};

type LeadMr = {
  id: string;
  name: string;
  username: string;
};

type CreateUserData = {
  username: string;
  name: string;
  email?: string;
  phone?: string;
  password?: string;
  role: "MR" | "LEAD_MR" | "ADMIN";
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  regionId?: string;
  leadMrId?: string;
};

type UpdateUserData = Partial<CreateUserData>;

interface UserStore {
  // State
  users: User[];
  regions: Region[];
  leadMrs: LeadMr[];
  isLoading: boolean;
  error: string | null;

  // Pagination state
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };

  // Sheet state
  isSheetOpen: boolean;
  selectedUser: User | null;

  // Actions
  fetchUsers: (page?: number, limit?: number) => Promise<void>;
  fetchRegions: () => Promise<void>;
  fetchLeadMrs: () => Promise<void>;
  createUser: (data: CreateUserData) => Promise<void>;
  updateUser: (id: string, data: UpdateUserData) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  toggleUserStatus: (id: string, currentStatus: string) => Promise<void>;

  // Sheet actions
  openUserSheet: (user?: User) => void;
  closeUserSheet: () => void;
}

export const useUserStore = create<UserStore>((set, get) => ({
  // Initial state
  users: [],
  regions: [],
  leadMrs: [],
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  },
  isSheetOpen: false,
  selectedUser: null,

  // Fetch users
  fetchUsers: async (page = 1, limit = 10) => {
    set({ isLoading: true, error: null });
    try {
      const url = `/api/users?page=${page}&limit=${limit}`;
      const result = await fetch(url);

      if (!result.ok) {
        throw new Error(`HTTP ${result.status}: ${result.statusText}`);
      }

      const response = await result.json();

      if (!response.success) {
        throw new Error(response.error || "Failed to fetch users");
      }

      set({
        users: response.data.data || [],
        pagination: response.data.pagination || {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
        isLoading: false,
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      set({
        users: [],
        error: error instanceof Error ? error.message : "Failed to fetch users",
        isLoading: false,
      });
    }
  },

  // Fetch regions
  fetchRegions: async () => {
    try {
      const regions = await apiGet<Region>("/api/regions");
      set({ regions });
    } catch (error) {
      console.error("Failed to fetch regions:", error);
      set({ regions: [] });
    }
  },

  // Fetch lead MRs
  fetchLeadMrs: async () => {
    try {
      const usersData = await apiGet<User>("/api/users?role=LEAD_MR");

      // Map users to lead MR format
      const leadMrs = usersData.map((user: User) => ({
        id: user.id,
        name: user.name,
        username: user.username,
      }));
      set({ leadMrs });
    } catch (error) {
      console.error("Failed to fetch lead MRs:", error);
      set({ leadMrs: [] });
    }
  },

  // Create user
  createUser: async (data: CreateUserData) => {
    try {
      const result = await apiPost("/api/users", data);

      if (!result.success) {
        throw new Error(result.error || "Failed to create user");
      }

      // Refresh users list
      await get().fetchUsers();
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  },

  // Update user
  updateUser: async (id: string, data: UpdateUserData) => {
    const result = await apiPut(`/api/users/${id}`, data);

    if (!result.success) {
      throw new Error(result.error);
    }

    // Refresh users list
    await get().fetchUsers();
  },

  // Delete user
  deleteUser: async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this user? This action cannot be undone."
      )
    ) {
      return;
    }

    const result = await apiDelete(`/api/users/${id}`);

    if (!result.success) {
      throw new Error(result.error);
    }

    // Remove user from local state
    set((state) => ({
      users: state.users.filter((user) => user.id !== id),
    }));
  },

  // Toggle user status
  toggleUserStatus: async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    try {
      await get().updateUser(id, { status: newStatus });
    } catch (error) {
      throw error;
    }
  },

  // Open user sheet
  openUserSheet: (user?: User) => {
    set({ isSheetOpen: true, selectedUser: user || null });
  },

  // Close user sheet
  closeUserSheet: () => {
    set({ isSheetOpen: false, selectedUser: null });
  },
}));
