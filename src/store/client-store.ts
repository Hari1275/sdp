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
  error: string | null;
  filters: ClientFilters;
  isSheetOpen: boolean;
  statistics: ClientStatistics | null;
  businessHistory: BusinessHistory | null;
  
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
}

export const useClientStore = create<ClientStore>((set, get) => ({
  // Initial state
  clients: [],
  selectedClient: null,
  isLoading: false,
  error: null,
  filters: {},
  isSheetOpen: false,
  statistics: null,
  businessHistory: null,
  searchResults: [],
  isSearching: false,
  searchQuery: '',
  isExporting: false,

  // Fetch all clients
  fetchClients: async () => {
    set({ isLoading: true, error: null });
    try {
      console.log('[ClientStore] Starting fetchClients...');
      
      const { filters } = get();
      const queryParams = new URLSearchParams();
      
      // Add pagination
      queryParams.append('page', '1');
      queryParams.append('limit', '50');
      
      // Add filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== '') {
          queryParams.append(key, value);
        }
      });

      const url = `/api/clients?${queryParams.toString()}`;
      console.log('[ClientStore] Fetching from:', url);
      
      const response = await fetch(url);
      console.log('[ClientStore] Response status:', response.status, response.statusText);
      
      const result = await response.json();
      console.log('[ClientStore] Response data:', result);

      if (!response.ok) {
        // Check if it's an authentication error
        if (response.status === 401) {
          console.warn('[ClientStore] Authentication failed. User may not be logged in.');
          throw new Error('Please log in to view clients');
        }
        throw new Error(result.message || `Failed to fetch clients (${response.status})`);
      }

      // Handle nested data structure: result.data.data contains the clients array
      const clientsData = result.data?.data || result.data || [];
      const clients = Array.isArray(clientsData) ? clientsData : [];
      console.log('[ClientStore] Setting clients:', clients.length, 'items');
      console.log('[ClientStore] Client data structure check:', {
        resultData: result.data,
        clientsData,
        isArray: Array.isArray(clientsData),
        firstClient: clients[0]
      });
      set({ clients, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      console.error('[ClientStore] fetchClients error:', errorMessage);
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

      // Refresh clients list
      await get().fetchClients();
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
      console.log('[ClientStore] Starting fetchStatistics...');
      
      const queryParams = new URLSearchParams();
      
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value && value !== '') {
            queryParams.append(key, value);
          }
        });
      }

      const url = `/api/clients/statistics?${queryParams.toString()}`;
      console.log('[ClientStore] Fetching statistics from:', url);
      
      const response = await fetch(url);
      console.log('[ClientStore] Statistics response status:', response.status, response.statusText);
      
      const result = await response.json();
      console.log('[ClientStore] Statistics response data:', result);

      if (!response.ok) {
        // Check if it's an authentication error
        if (response.status === 401) {
          console.warn('[ClientStore] Authentication failed for statistics. User may not be logged in.');
          // For statistics, we can set a default empty state instead of showing an error
          set({ 
            statistics: null, 
            isLoading: false 
          });
          return;
        }
        throw new Error(result.message || `Failed to fetch statistics (${response.status})`);
      }

      console.log('[ClientStore] Setting statistics data');
      set({ statistics: result.data, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      console.error('[ClientStore] fetchStatistics error:', errorMessage);
      set({ 
        error: errorMessage,
        isLoading: false,
        statistics: null
      });
    }
  },

  // Fetch business history
  fetchBusinessHistory: async (clientId: string, filters = {}) => {
    set({ isLoading: true, error: null });
    try {
      const queryParams = new URLSearchParams();
      
      // Add filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const response = await fetch(`/api/clients/${clientId}/business?${queryParams.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to fetch business history');
      }

      set({ businessHistory: result.data, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'An error occurred',
        isLoading: false 
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
        const result = await response.json();
        // You could implement Excel export logic here
        console.log('Excel export data:', result);
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
    set({ filters: { ...filters, ...newFilters } });
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
}));
