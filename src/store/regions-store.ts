import { create } from 'zustand';
import { apiPost, apiPut, apiDelete } from '@/lib/api-client';

type Region = {
  id: string;
  name: string;
  description?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
  _count: {
    areas: number;
    users: number;
  };
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

type Area = {
  id: string;
  name: string;
  description?: string | null;
  regionId: string;
  region?: { id: string; name: string };
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
  _count: {
    clients: number;
    tasks: number;
  };
};

type CreateRegionData = {
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
};

type UpdateRegionData = Partial<CreateRegionData>;

type CreateAreaData = {
  name: string;
  description?: string;
  regionId: string;
  status: 'ACTIVE' | 'INACTIVE';
};

type UpdateAreaData = Partial<CreateAreaData>;

interface RegionsStore {
  // State
  regions: Region[];
  areas: Area[];
  isLoading: boolean;
  error: string | null;
  
  // Pagination state
  regionsPagination: Pagination | null;
  areasPagination: Pagination | null;
  currentRegionPage: number;
  currentAreaPage: number;
  searchQuery: string;
  selectedRegionFilter: string | null;
  
  // Sheet/Dialog state
  isRegionDialogOpen: boolean;
  isAreaDialogOpen: boolean;
  selectedRegion: Region | null;
  selectedArea: Area | null;

  // Actions
  fetchRegions: (page?: number, search?: string) => Promise<void>;
  fetchAreas: (page?: number, regionId?: string, search?: string) => Promise<void>;
  createRegion: (data: CreateRegionData) => Promise<void>;
  updateRegion: (id: string, data: UpdateRegionData) => Promise<void>;
  deleteRegion: (id: string) => Promise<void>;
  toggleRegionStatus: (id: string, currentStatus: string) => Promise<void>;
  
  createArea: (data: CreateAreaData) => Promise<void>;
  updateArea: (id: string, data: UpdateAreaData) => Promise<void>;
  deleteArea: (id: string) => Promise<void>;
  toggleAreaStatus: (id: string, currentStatus: string) => Promise<void>;
  
  // Pagination actions
  setRegionPage: (page: number) => void;
  setAreaPage: (page: number) => void;
  setSearchQuery: (query: string) => void;
  setRegionFilter: (regionId: string | null) => void;
  
  // Dialog actions
  openRegionDialog: (region?: Region) => void;
  closeRegionDialog: () => void;
  openAreaDialog: (area?: Area) => void;
  closeAreaDialog: () => void;
}

export const useRegionsStore = create<RegionsStore>((set, get) => ({
  // Initial state
  regions: [],
  areas: [],
  isLoading: false,
  error: null,
  
  // Pagination state
  regionsPagination: null,
  areasPagination: null,
  currentRegionPage: 1,
  currentAreaPage: 1,
  searchQuery: '',
  selectedRegionFilter: null,
  
  isRegionDialogOpen: false,
  isAreaDialogOpen: false,
  selectedRegion: null,
  selectedArea: null,

  // Fetch regions
  fetchRegions: async (page?: number, search?: string) => {
    const state = get();
    const currentPage = page || state.currentRegionPage;
    const searchQuery = search || state.searchQuery;
    
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10'
      });
      
      if (searchQuery) {
        params.append('search', searchQuery);
      }
      
      const response = await fetch(`/api/regions?${params}`);
      const result = await response.json();
      
      if (result.success) {
        set({ 
          regions: result.data.data,
          regionsPagination: result.data.pagination,
          currentRegionPage: currentPage,
          searchQuery,
          isLoading: false 
        });
      } else {
        throw new Error(result.message || 'Failed to fetch regions');
      }
    } catch (error) {
      console.error('Error fetching regions:', error);
      set({ 
        regions: [],
        error: error instanceof Error ? error.message : 'Failed to fetch regions',
        isLoading: false 
      });
    }
  },

  // Fetch areas
  fetchAreas: async (page?: number, regionId?: string, search?: string) => {
    const state = get();
    const currentPage = page || state.currentAreaPage;
    const filterRegionId = regionId || state.selectedRegionFilter;
    const searchQuery = search || state.searchQuery;
    
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10'
      });
      
      if (filterRegionId) {
        params.append('regionId', filterRegionId);
      }
      
      if (searchQuery) {
        params.append('search', searchQuery);
      }
      
      const response = await fetch(`/api/areas?${params}`);
      const result = await response.json();
      
      if (result.success) {
        set({ 
          areas: result.data.data,
          areasPagination: result.data.pagination,
          currentAreaPage: currentPage,
          selectedRegionFilter: filterRegionId,
          searchQuery
        });
      } else {
        throw new Error(result.message || 'Failed to fetch areas');
      }
    } catch (error) {
      console.error('Error fetching areas:', error);
      set({ 
        areas: [],
        error: error instanceof Error ? error.message : 'Failed to fetch areas'
      });
    }
  },

  // Create region
  createRegion: async (data: CreateRegionData) => {
    try {
      const result = await apiPost('/api/regions', data);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create region');
      }

      // Refresh regions list
      await get().fetchRegions();
    } catch (error) {
      console.error('Error creating region:', error);
      throw error;
    }
  },

  // Update region
  updateRegion: async (id: string, data: UpdateRegionData) => {
    try {
      const result = await apiPut(`/api/regions/${id}`, data);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update region');
      }

      // Refresh regions list
      await get().fetchRegions();
    } catch (error) {
      console.error('Error updating region:', error);
      throw error;
    }
  },

  // Delete region
  deleteRegion: async (id: string) => {
    if (!confirm('Are you sure you want to delete this region? This will also delete all associated areas. This action cannot be undone.')) {
      return;
    }

    try {
      const result = await apiDelete(`/api/regions/${id}`);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete region');
      }

      // Remove region from local state
      set(state => ({
        regions: state.regions.filter(region => region.id !== id),
        areas: state.areas.filter(area => area.regionId !== id)
      }));
    } catch (error) {
      console.error('Error deleting region:', error);
      throw error;
    }
  },

  // Toggle region status
  toggleRegionStatus: async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    
    try {
      await get().updateRegion(id, { status: newStatus });
    } catch (error) {
      throw error;
    }
  },

  // Create area
  createArea: async (data: CreateAreaData) => {
    try {
      const result = await apiPost('/api/areas', data);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create area');
      }

      // Refresh areas list
      await get().fetchAreas();
      // Also refresh regions to update counts
      await get().fetchRegions();
    } catch (error) {
      console.error('Error creating area:', error);
      throw error;
    }
  },

  // Update area
  updateArea: async (id: string, data: UpdateAreaData) => {
    try {
      const result = await apiPut(`/api/areas/${id}`, data);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update area');
      }

      // Refresh areas list
      await get().fetchAreas();
      // Also refresh regions to update counts
      await get().fetchRegions();
    } catch (error) {
      console.error('Error updating area:', error);
      throw error;
    }
  },

  // Delete area
  deleteArea: async (id: string) => {
    if (!confirm('Are you sure you want to delete this area? This action cannot be undone.')) {
      return;
    }

    try {
      const result = await apiDelete(`/api/areas/${id}`);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete area');
      }

      // Remove area from local state
      set(state => ({
        areas: state.areas.filter(area => area.id !== id)
      }));
      // Also refresh regions to update counts
      await get().fetchRegions();
    } catch (error) {
      console.error('Error deleting area:', error);
      throw error;
    }
  },

  // Toggle area status
  toggleAreaStatus: async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    
    try {
      await get().updateArea(id, { status: newStatus });
    } catch (error) {
      throw error;
    }
  },

  // Open region dialog
  openRegionDialog: (region?: Region) => {
    set({ isRegionDialogOpen: true, selectedRegion: region || null });
  },

  // Close region dialog
  closeRegionDialog: () => {
    set({ isRegionDialogOpen: false, selectedRegion: null });
  },

  // Open area dialog
  openAreaDialog: (area?: Area) => {
    set({ isAreaDialogOpen: true, selectedArea: area || null });
  },

  // Close area dialog
  closeAreaDialog: () => {
    set({ isAreaDialogOpen: false, selectedArea: null });
  },
  
  // Pagination methods
  setRegionPage: (page: number) => {
    set({ currentRegionPage: page });
  },
  
  setAreaPage: (page: number) => {
    set({ currentAreaPage: page });
  },
  
  setSearchQuery: (query: string) => {
    set({ searchQuery: query, currentRegionPage: 1, currentAreaPage: 1 });
  },
  
  setRegionFilter: (regionId: string | null) => {
    set({ selectedRegionFilter: regionId, currentAreaPage: 1 });
  },
}));
