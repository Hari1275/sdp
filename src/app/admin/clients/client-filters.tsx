"use client";

import { useState, useEffect } from 'react';
import { ClientFilters as FilterType } from '@/store/client-store';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { X, Calendar, MapPin, Building2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Types for regions and areas
type Region = {
  id: string;
  name: string;
  description?: string;
};

type Area = {
  id: string;
  name: string;
  description?: string;
  regionId: string;
};

interface ClientFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: Partial<FilterType>) => void;
  onClearFilters: () => void;
}

// Business types are static
const businessTypes = [
  { value: 'CLINIC', label: 'Clinic' },
  { value: 'HOSPITAL', label: 'Hospital' },
  { value: 'PHARMACY', label: 'Pharmacy' },
  { value: 'MEDICAL_STORE', label: 'Medical Store' },
  { value: 'HEALTHCARE_CENTER', label: 'Healthcare Center' },
];

// Types for MRs
type MR = {
  id: string;
  name: string;
  email?: string;
  role: string;
  regionId?: string;
};

// Fetch regions and areas data
const fetchRegions = async (): Promise<Region[]> => {
  try {
    const response = await fetch('/api/public/regions');
    if (!response.ok) throw new Error('Failed to fetch regions');
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching regions:', error);
    return [];
  }
};

const fetchAreas = async (): Promise<Area[]> => {
  try {
    const response = await fetch('/api/public/areas');
    if (!response.ok) throw new Error('Failed to fetch areas');
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching areas:', error);
    return [];
  }
};

const fetchMRs = async (): Promise<MR[]> => {
  try {
    const response = await fetch('/api/public/users?role=MR');
    if (!response.ok) throw new Error('Failed to fetch MRs');
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching MRs:', error);
    return [];
  }
};

export function ClientFilters({ filters, onFiltersChange, onClearFilters }: ClientFiltersProps) {
  const [localFilters, setLocalFilters] = useState<FilterType>(filters);
  const [regions, setRegions] = useState<Region[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [mrs, setMrs] = useState<MR[]>([]);
  const [isLoadingRegions, setIsLoadingRegions] = useState(true);
  const [isLoadingAreas, setIsLoadingAreas] = useState(true);
  const [isLoadingMrs, setIsLoadingMrs] = useState(true);

  // Fetch regions, areas, and MRs on component mount
  useEffect(() => {
    const loadData = async () => {
      const [regionsData, areasData, mrsData] = await Promise.all([
        fetchRegions(),
        fetchAreas(),
        fetchMRs()
      ]);
      setRegions(regionsData);
      setAreas(areasData);
      setMrs(mrsData);
      setIsLoadingRegions(false);
      setIsLoadingAreas(false);
      setIsLoadingMrs(false);
    };
    loadData();
  }, []);

  // Update local state when filters prop changes
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Filter areas based on selected region
  const filteredAreas = areas.filter(area => 
    !localFilters.regionId || area.regionId === localFilters.regionId
  );

  const handleFilterChange = (key: keyof FilterType, value: string | undefined) => {
    // Convert 'all' value to undefined for clearing filters
    const processedValue = value === 'all' ? undefined : value;
    const newFilters = { ...localFilters, [key]: processedValue };
    
    // Clear area if region is changed
    if (key === 'regionId' && processedValue !== localFilters.regionId) {
      newFilters.areaId = undefined;
    }
    
    setLocalFilters(newFilters);
    onFiltersChange({ [key]: processedValue });
  };

  const getActiveFiltersCount = () => {
    return Object.values(localFilters).filter(Boolean).length;
  };

  const clearAllFilters = () => {
    setLocalFilters({});
    onClearFilters();
  };

  const removeFilter = (key: keyof FilterType) => {
    const newFilters = { ...localFilters };
    delete newFilters[key];
    setLocalFilters(newFilters);
    onFiltersChange({ [key]: undefined });
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Filter Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Filters</h3>
            {getActiveFiltersCount() > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFilters}
                className="text-muted-foreground"
              >
                Clear all ({getActiveFiltersCount()})
              </Button>
            )}
          </div>

          {/* Active Filters */}
          {getActiveFiltersCount() > 0 && (
            <div className="flex flex-wrap gap-2">
              {localFilters.businessType && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {businessTypes.find(bt => bt.value === localFilters.businessType)?.label}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1"
                    onClick={() => removeFilter('businessType')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {localFilters.regionId && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {regions.find(r => r.id === localFilters.regionId)?.name}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1"
                    onClick={() => removeFilter('regionId')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {localFilters.areaId && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {filteredAreas.find(a => a.id === localFilters.areaId)?.name}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1"
                    onClick={() => removeFilter('areaId')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {localFilters.mrId && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {mrs.find(mr => mr.id === localFilters.mrId)?.name}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1"
                    onClick={() => removeFilter('mrId')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
            </div>
          )}

          {/* Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Business Type Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Business Type
              </Label>
              <Select
                value={localFilters.businessType || 'all'}
                onValueChange={(value) => handleFilterChange('businessType', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All business types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All business types</SelectItem>
                  {businessTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Region Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Region
              </Label>
              <Select
                value={localFilters.regionId || 'all'}
                onValueChange={(value) => handleFilterChange('regionId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All regions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All regions</SelectItem>
                  {regions.map((region) => (
                    <SelectItem key={region.id} value={region.id}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Area Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Area
              </Label>
              <Select
                value={localFilters.areaId || 'all'}
                onValueChange={(value) => handleFilterChange('areaId', value)}
                disabled={!localFilters.regionId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={localFilters.regionId ? "Select area" : "Select region first"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All areas</SelectItem>
                  {filteredAreas.map((area) => (
                    <SelectItem key={area.id} value={area.id}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* MR Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Marketing Representative
              </Label>
              <Select
                value={localFilters.mrId || 'all'}
                onValueChange={(value) => handleFilterChange('mrId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All MRs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All MRs</SelectItem>
                  {mrs.map((mr) => (
                    <SelectItem key={mr.id} value={mr.id}>
                      {mr.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date From Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Created From
              </Label>
              <Input
                type="date"
                value={localFilters.dateFrom || ''}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>

            {/* Date To Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Created To
              </Label>
              <Input
                type="date"
                value={localFilters.dateTo || ''}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                min={localFilters.dateFrom}
              />
            </div>
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                handleFilterChange('dateFrom', oneWeekAgo.toISOString().split('T')[0]);
                handleFilterChange('dateTo', '');
              }}
            >
              Last 7 days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const oneMonthAgo = new Date();
                oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
                handleFilterChange('dateFrom', oneMonthAgo.toISOString().split('T')[0]);
                handleFilterChange('dateTo', '');
              }}
            >
              Last 30 days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const thisMonth = new Date();
                thisMonth.setDate(1);
                handleFilterChange('dateFrom', thisMonth.toISOString().split('T')[0]);
                handleFilterChange('dateTo', '');
              }}
            >
              This month
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
