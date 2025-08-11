"use client";

import { useEffect, useMemo } from 'react';
import { useClientStore } from '@/store/client-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  PlusCircle, 
  Building2, 
  TrendingUp, 
  TrendingDown, 
  Activity,
  Search,
  Filter,
  Download,
  MapPin,
  DollarSign
} from 'lucide-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClientTable } from './client-table';
import { ClientFilters } from './client-filters';
import { ClientForm } from './client-form';
import { useState } from 'react';

export default function ClientManagementPage() {
  const {
    clients,
    statistics,
    isLoading,
    error,
    filters,
    searchQuery,
    isSearching,
    isExporting,
    page,
    limit,
    totalPages,
    hasNext,
    hasPrev,
    fetchClients,
    fetchStatistics,
    searchClients,
    openClientSheet,
    setSearchQuery,
    setFilters,
    clearFilters,
    exportClients,
    clearError,
    setPage,
    setLimit
  } = useClientStore();

  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  // Refetch clients when pagination or filters change
  useEffect(() => {
    // Avoid refetching if user is typing/searching; search handler manages list
    if (!isSearching && !searchInput.trim()) {
      fetchClients();
    }
  }, [fetchClients, page, limit, filters, isSearching, searchInput]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== searchQuery) {
        setSearchQuery(searchInput);
        if (searchInput.trim()) {
          searchClients({ search: searchInput.trim() });
        } else {
          fetchClients();
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, searchQuery, searchClients, fetchClients, setSearchQuery]);

  // Filter clients based on applied filters with enhanced safety
  const filteredClients = useMemo(() => {
    // Enhanced safety checks with debugging
    console.log('[ClientsPage] Filtering clients:', {
      clientsType: typeof clients,
      clientsArray: Array.isArray(clients),
      clientsLength: Array.isArray(clients) ? clients.length : 'N/A',
      clientsRaw: clients,
      isLoading,
      error,
      searchQuery,
      filters
    });

    const safeClients = Array.isArray(clients) ? clients : [];
    let result = safeClients;

    // Log raw client data
    if (safeClients.length > 0) {
      console.log('[ClientsPage] Sample client data:', safeClients[0]);
    }

    if (filters.businessType) {
      result = result.filter(client => client?.businessType === filters.businessType);
      console.log('[ClientsPage] After businessType filter:', result.length);
    }
    if (filters.regionId) {
      result = result.filter(client => client?.region?.id === filters.regionId);
      console.log('[ClientsPage] After regionId filter:', result.length);
    }
    if (filters.areaId) {
      result = result.filter(client => client?.area?.id === filters.areaId);
      console.log('[ClientsPage] After areaId filter:', result.length);
    }

    console.log('[ClientsPage] Final filtered result:', {
      originalLength: safeClients.length,
      filteredLength: result.length,
      filters: filters
    });

    return result;
  }, [clients, filters, error, isLoading, searchQuery]);

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      await exportClients({ format, filters });
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const getGrowthIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getGrowthColor = (trend: string) => {
    switch (trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <span>Error loading clients: {error}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  clearError();
                  fetchClients();
                  fetchStatistics();
                }}
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Client Management</h1>
          <p className="text-muted-foreground">
            Manage healthcare facilities and track business relationships.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isExporting}>
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? 'Exporting...' : 'Export'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Export Format</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('excel')}>
                Export as Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => openClientSheet()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Client
          </Button>
        </div>
      </div>

      {/* Statistics Cards */
      }
      {statistics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statistics.overview.totalClients}</div>
              <p className="text-xs text-muted-foreground">
                {statistics.overview.recentClients} added this month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
              <Activity className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {statistics.overview.activeClients}
              </div>
              <p className="text-xs text-muted-foreground">
                {statistics.overview.activityRate}% activity rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Business Clients</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {statistics.overview.clientsWithBusiness}
              </div>
              <p className="text-xs text-muted-foreground">
                {statistics.overview.clientsWithoutBusiness} without business
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Growth Rate</CardTitle>
              {getGrowthIcon(statistics.growth.growthTrend)}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getGrowthColor(statistics.growth.growthTrend)}`}>
                {statistics.growth.growthRate > 0 ? '+' : ''}
                {statistics.growth.growthRate}%
              </div>
              <p className="text-xs text-muted-foreground">
                vs previous period
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Business Type Distribution and Top Areas moved to top level */}
      {statistics?.businessTypes && statistics.businessTypes.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Business Type Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {statistics.businessTypes.map((type) => (
                  <div key={type.businessType} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium">
                        {type.businessType.replace('_', ' ')}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {type.count}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {type.percentage}%
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Top Areas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {statistics.areas.slice(0, 5).map((area) => (
                  <div key={area.areaId} className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium">
                        {area.areaName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {area.regionName}
                      </div>
                    </div>
                    <Badge variant="outline">
                      {area.count}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>Client Directory</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search clients..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Button
                variant={showFilters ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="mr-2 h-4 w-4" />
                Filters
                {Object.keys(filters).length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {Object.keys(filters).length}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {showFilters && (
          <CardContent className="pt-0">
            <ClientFilters
              filters={filters}
              onFiltersChange={setFilters}
              onClearFilters={clearFilters}
            />
          </CardContent>
        )}
        
        <CardContent className={showFilters ? "pt-0" : ""}>
          <ClientTable 
            clients={filteredClients}
            isLoading={isLoading || isSearching}
            searchQuery={searchInput}
          />
          {/* Pagination controls consistent with Users page */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium">Rows per page</p>
              <Select
                value={`${limit}`}
                onValueChange={(value) => setLimit(Number(value))}
              >
                <SelectTrigger className="h-8 w-[80px]">
                  <SelectValue placeholder={limit} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[5, 10, 20, 30, 40, 50].map((size) => (
                    <SelectItem key={size} value={`${size}`}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-6 lg:space-x-8">
              <div className="flex w-[120px] items-center justify-center text-sm font-medium">
                Page {page} of {Math.max(1, totalPages || 1)}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => hasPrev && setPage(page - 1)}
                  disabled={!hasPrev}
                >
                  <span className="sr-only">Go to previous page</span>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => hasNext && setPage(page + 1)}
                  disabled={!hasNext}
                >
                  <span className="sr-only">Go to next page</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Removed duplicate charts previously at bottom */}

      <ClientForm />
    </div>
  );
}
