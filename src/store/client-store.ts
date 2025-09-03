import { create } from 'zustand';
import { Client } from '@/types';

export interface ClientFilters {
  search?: string;
  businessType?: string;
  regionId?: string;
  areaId?: string;
  mrId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ClientStatistics {
  overview: {
    totalClients: number;
    activeClients: number;
    inactiveClients: number;
    recentClients: number;
    clientsWithBusiness: number;
    clientsWithoutBusiness: number;
    activityRate: string;
  };
  growth: {
    currentPeriodClients: number;
    previousPeriodClients: number;
    growthRate: number;
    growthTrend: 'up' | 'down' | 'stable';
  };
  businessTypes: Array<{
    businessType: string;
    count: number;
    percentage: string;
  }>;
  regions: Array<{
    regionId: string;
    regionName: string;
    count: number;
  }>;
  areas: Array<{
    areaId: string;
    areaName: string;
    regionName: string;
    count: number;
  }>;
  topMRs: Array<{
    mrId: string;
    mrName: string;
    mrUsername: string;
    count: number;
  }>;
}

export interface BusinessEntry {
  id: string;
  amount: number;
  notes?: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  updatedAt: string;
  mr: {
    id: string;
    name: string;
    username: string;
  };
}

export interface BusinessHistory {
  client: {
    id: string;
    name: string;
  };
  businessEntries: BusinessEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  statistics: {
    totalAmount: number;
    averageAmount: number;
    totalEntries: number;
    minAmount: number;
    maxAmount: number;
    growthRate: number;
  };
  trends: {
    monthlyData: Array<{
      month: string;
      count: number;
      totalAmount: number;
      avgAmount: number;
    }>;
  };
  recentActivity: {
    last30Days: number;
    last7Days: number;
    lastEntry?: BusinessEntry;
  };
}

interface ClientStore {
  // State
  clients: Client[];
  selectedClient: Client | null;
  isLoading: boolean;
  isBusinessLoading: boolean;
  error: string | null;
  filters: ClientFilters;
  isSheetOpen: boolean;
  statistics: ClientStatistics | null;
  businessHistory: BusinessHistory | null;
  // Pagination
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  
  // Search & Export
  searchResults: Client[];
  isSearching: boolean;
  searchQuery: string;
  isExporting: boolean;

  // Actions
  fetchClients: () => Promise<void>;
  searchClients: (params: { search?: string; filters?: ClientFilters }) => Promise<void>;
  fetchClientById: (id: string) => Promise<void>;
  createClient: (data: Partial<Client>) => Promise<void>;
  updateClient: (id: string, data: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  fetchStatistics: (filters?: ClientFilters) => Promise<void>;
  fetchBusinessHistory: (clientId: string, filters?: { dateFrom?: string; dateTo?: string; page?: number; limit?: number }) => Promise<void>;
  exportClients: (params: { format: 'csv' | 'excel'; filters?: ClientFilters; fields?: string[] }) => Promise<void>;

  // UI Actions
  openClientSheet: (client?: Client) => void;
  closeClientSheet: () => void;
  setFilters: (filters: Partial<ClientFilters>) => void;
  clearFilters: () => void;
  setSearchQuery: (query: string) => void;
  clearError: () => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
}

export const useClientStore = create<ClientStore>((set, get) => ({
  // Initial state
  clients: [],
  selectedClient: null,
  isLoading: false,
  isBusinessLoading: false,
  error: null,
  filters: {},
  isSheetOpen: false,
  statistics: null,
  businessHistory: null,
  // Pagination defaults
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
  searchResults: [],
  isSearching: false,
  searchQuery: '',
  isExporting: false,

  // Fetch all clients
  fetchClients: async () => {
    set({ isLoading: true, error: null });
    try {
      // console.log('[ClientStore] Starting fetchClients...');
      
      const { filters, page, limit } = get();
      const queryParams = new URLSearchParams();
      
      // Add pagination
      queryParams.append('page', String(page));
      queryParams.append('limit', String(limit));
      
      // Add filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== '') {
          queryParams.append(key, value);
        }
      });

      const url = `/api/clients?${queryParams.toString()}`;
      // console.log('[ClientStore] Fetching from:', url);
      
      const response = await fetch(url);
      // console.log('[ClientStore] Response status:', response.status, response.statusText);
      
      const result = await response.json();
      // console.log('[ClientStore] Response data:', result);

      if (!response.ok) {
        // Check if it's an authentication error
        if (response.status === 401) {
          // console.warn('[ClientStore] Authentication failed. User may not be logged in.');
          throw new Error('Please log in to view clients');
        }
        throw new Error(result.message || `Failed to fetch clients (${response.status})`);
      }

      // Handle nested data structure: result.data.data contains the clients array
      const clientsData = result.data?.data || result.data || [];
      const clients = Array.isArray(clientsData) ? clientsData : [];
      // console.log('[ClientStore] Setting clients:', clients.length, 'items');
      // console.log('[ClientStore] Client data structure check:', {
      //   resultData: result.data,
      //   clientsData,
      //   isArray: Array.isArray(clientsData),
      //   firstClient: clients[0]
      // });
      // Extract pagination if available
      const pagination = result.data?.pagination || result.pagination || null;
      if (pagination) {
        set({
          clients,
          isLoading: false,
          page: pagination.page ?? page,
          limit: pagination.limit ?? limit,
          total: pagination.total ?? clients.length,
          totalPages: pagination.totalPages ?? Math.ceil((pagination.total ?? clients.length) / (pagination.limit ?? limit)),
          hasNext: Boolean(pagination.hasNext),
          hasPrev: Boolean(pagination.hasPrev),
        });
      } else {
        // Fallback when API doesn't return pagination
        const total = clients.length;
        set({
          clients,
          isLoading: false,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: false,
          hasPrev: page > 1,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      // console.error('[ClientStore] fetchClients error:', errorMessage);
      set({ 
        error: errorMessage,
        isLoading: false,
        clients: [] // Ensure clients is always an array
      });
    }
  },

  // Search clients
  searchClients: async ({ search, filters: searchFilters }) => {
    set({ isSearching: true, error: null });
    try {
      const queryParams = new URLSearchParams();
      
      if (search) queryParams.append('search', search);
      
      // Add search filters
      if (searchFilters) {
        Object.entries(searchFilters).forEach(([key, value]) => {
          if (value && value !== '') {
            queryParams.append(key, value);
          }
        });
      }

      const response = await fetch(`/api/clients/search?${queryParams.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Search failed');
      }

      // Update main clients list with search results when searching
      set({ 
        searchResults: result.data || [],
        clients: result.data || [],  // Also update main clients list
        searchQuery: search || '',
        isSearching: false 
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Search failed',
        isSearching: false 
      });
    }
  },

  // Fetch single client
  fetchClientById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/clients/${id}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to fetch client');
      }

      set({ selectedClient: result.data, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred',
        isLoading: false 
      });
    }
  },

  // Create client
  createClient: async (data: Partial<Client>) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to create client');
      }

      // Refresh clients list and statistics
      await get().fetchClients();
      await get().fetchStatistics();
      set({ isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred',
        isLoading: false 
      });
      throw error;
    }
  },

  // Update client
  updateClient: async (id: string, data: Partial<Client>) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/clients/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to update client');
      }

      // Update local state
      const { clients } = get();
      const updatedClients = clients.map(client => 
        client.id === id ? { ...client, ...result.data } : client
      );

      set({ clients: updatedClients, isLoading: false });
      // Refresh statistics after update
      get().fetchStatistics();
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred',
        isLoading: false 
      });
      throw error;
    }
  },

  // Delete client
  deleteClient: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/clients/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to delete client');
      }

      // Remove from local state
      const { clients } = get();
      const updatedClients = clients.filter(client => client.id !== id);

      set({ clients: updatedClients, isLoading: false });
      // Refresh statistics after delete
      get().fetchStatistics();
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred',
        isLoading: false 
      });
      throw error;
    }
  },

  // Fetch statistics
  fetchStatistics: async (filters?: ClientFilters) => {
    set({ isLoading: true, error: null });
    try {
      // console.log('[ClientStore] Starting fetchStatistics...');
      
      const queryParams = new URLSearchParams();
      
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value && value !== '') {
            queryParams.append(key, value);
          }
        });
      }

      const url = `/api/clients/statistics?${queryParams.toString()}`;
      // console.log('[ClientStore] Fetching statistics from:', url);
      
      const response = await fetch(url);
      // console.log('[ClientStore] Statistics response status:', response.status, response.statusText);
      
      const result = await response.json();
      // console.log('[ClientStore] Statistics response data:', result);

      if (!response.ok) {
        // Check if it's an authentication error
        if (response.status === 401) {
          // console.warn('[ClientStore] Authentication failed for statistics. User may not be logged in.');
          // For statistics, we can set a default empty state instead of showing an error
          set({ 
            statistics: null, 
            isLoading: false 
          });
          return;
        }
        throw new Error(result.message || `Failed to fetch statistics (${response.status})`);
      }

      // console.log('[ClientStore] Setting statistics data');
      set({ statistics: result.data, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      // console.error('[ClientStore] fetchStatistics error:', errorMessage);
      set({ 
        error: errorMessage,
        isLoading: false,
        statistics: null
      });
    }
  },

  // Fetch business history
  fetchBusinessHistory: async (clientId: string, filters = {}) => {
    set({ isBusinessLoading: true, error: null });
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          queryParams.append(key, value.toString());
        }
      });
      // Primary API path (rich structure)
      const primaryUrl = `/api/clients/${clientId}/business?${queryParams.toString()}`;
      let response = await fetch(primaryUrl);
      let result = await response.json();

      if (response.ok && result?.data) {
        set({ businessHistory: result.data as BusinessHistory, isBusinessLoading: false });
        return;
      }

      // If unauthorized, set safe empty state and stop
      if (!response.ok && response.status === 401) {
        set({ 
          businessHistory: {
            client: { id: clientId, name: 'Unknown' },
            businessEntries: [],
            pagination: { page: 1, limit: 10, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
            statistics: { totalAmount: 0, averageAmount: 0, totalEntries: 0, minAmount: 0, maxAmount: 0, growthRate: 0 },
            trends: { monthlyData: [] },
            recentActivity: { last30Days: 0, last7Days: 0 }
          },
          isBusinessLoading: false
        });
        return;
      }

      // Fallback to alternate API path and map
      const fallbackUrl = `/api/business/client/${clientId}?${queryParams.toString()}`;
      response = await fetch(fallbackUrl);
      result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `Failed to fetch business history (${response.status})`);
      }

      type ApiBusinessEntry = {
        id: string;
        amount: number;
        notes?: string;
        latitude: number;
        longitude: number;
        createdAt: string;
        updatedAt: string;
        mr?: { id?: string; name?: string; username?: string };
        client?: { mr?: { id?: string; name?: string; username?: string } };
      };

      const apiData: {
        client?: { id?: string; name?: string; totalAmount?: number; totalEntries?: number };
        data?: ApiBusinessEntry[];
        pagination?: { page?: number; limit?: number; total?: number; totalPages?: number; hasNext?: boolean; hasPrev?: boolean };
      } = result.data || {};

      const apiEntries = Array.isArray(apiData.data) ? apiData.data : [];
      const entries: BusinessEntry[] = apiEntries.map((e: ApiBusinessEntry) => ({
        id: e.id,
        amount: e.amount,
        notes: e.notes,
        latitude: e.latitude,
        longitude: e.longitude,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
        mr: {
          id: e.mr?.id || e.client?.mr?.id || '',
          name: e.mr?.name || e.client?.mr?.name || 'Unknown',
          username: e.mr?.username || e.client?.mr?.username || 'unknown',
        },
      }));

      const totalEntries = typeof apiData?.client?.totalEntries === 'number' ? apiData.client.totalEntries : (apiData.pagination?.total || entries.length || 0);
      const totalAmount = typeof apiData?.client?.totalAmount === 'number' ? apiData.client.totalAmount : entries.reduce((sum: number, e: BusinessEntry) => sum + (Number(e.amount) || 0), 0);
      const avgAmount = totalEntries > 0 ? totalAmount / totalEntries : 0;
      const amounts = entries.map((e: BusinessEntry) => Number(e.amount) || 0);
      const minAmount = amounts.length ? Math.min(...amounts) : 0;
      const maxAmount = amounts.length ? Math.max(...amounts) : 0;

      const now = Date.now();
      const ms7 = 7 * 24 * 60 * 60 * 1000;
      const ms30 = 30 * 24 * 60 * 60 * 1000;
      const last7Days = entries.filter((entry: BusinessEntry) => now - new Date(entry.createdAt).getTime() <= ms7).length;
      const last30Days = entries.filter((entry: BusinessEntry) => now - new Date(entry.createdAt).getTime() <= ms30).length;

      const mapped: BusinessHistory = {
        client: {
          id: apiData?.client?.id || clientId,
          name: apiData?.client?.name || 'Unknown',
        },
        businessEntries: entries,
        pagination: {
          page: apiData?.pagination?.page || 1,
          limit: apiData?.pagination?.limit || 10,
          total: apiData?.pagination?.total || entries.length,
          totalPages: apiData?.pagination?.totalPages || 1,
          hasNext: Boolean(apiData?.pagination?.hasNext),
          hasPrev: Boolean(apiData?.pagination?.hasPrev),
        },
        statistics: {
          totalAmount,
          averageAmount: avgAmount,
          totalEntries,
          minAmount,
          maxAmount,
          growthRate: 0,
        },
        trends: { monthlyData: [] },
        recentActivity: { last30Days, last7Days },
      };

      set({ businessHistory: mapped, isBusinessLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      set({ 
        error: errorMessage,
        isBusinessLoading: false,
        businessHistory: {
          client: { id: clientId, name: 'Unknown' },
          businessEntries: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
          statistics: { totalAmount: 0, averageAmount: 0, totalEntries: 0, minAmount: 0, maxAmount: 0, growthRate: 0 },
          trends: { monthlyData: [] },
          recentActivity: { last30Days: 0, last7Days: 0 }
        }
      });
    }
  },

  // Export clients
  exportClients: async ({ format, filters, fields }) => {
    set({ isExporting: true, error: null });
    try {
      const response = await fetch('/api/clients/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format,
          filters: filters || get().filters,
          fields: fields || []
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || 'Export failed');
      }

      if (format === 'csv') {
        // Handle CSV download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `clients_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        // Handle Excel format (JSON response)
        await response.json();
        // You could implement Excel export logic here
      }

      set({ isExporting: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Export failed',
        isExporting: false 
      });
      throw error;
    }
  },

  // UI Actions
  openClientSheet: (client?: Client) => {
    set({ selectedClient: client || null, isSheetOpen: true });
  },

  closeClientSheet: () => {
    set({ isSheetOpen: false, selectedClient: null });
  },

  setFilters: (newFilters: Partial<ClientFilters>) => {
    const { filters } = get();
    set({ 
      filters: { ...filters, ...newFilters },
      page: 1,
    });
  },

  clearFilters: () => {
    set({ filters: {} });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  clearError: () => {
    set({ error: null });
  },
  setPage: (newPage: number) => {
    set({ page: Math.max(1, newPage) });
  },
  setLimit: (newLimit: number) => {
    set({ limit: newLimit, page: 1 });
  },
}));
