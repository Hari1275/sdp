"use client";

import { useState, useEffect, useCallback } from "react";
import { ClientFilters as FilterType } from "@/store/client-store";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  X,
  Calendar,
  MapPin,
  Building2,
  Users,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { apiGet } from "@/lib/api-client";

interface ClientFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: Partial<FilterType>) => void;
  onClearFilters: () => void;
}

// Types for API data
interface BusinessType {
  value: string;
  label: string;
}

interface Region {
  id: string;
  name: string;
  description?: string;
}

interface Area {
  id: string;
  name: string;
  description?: string;
  regionId: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  regionId?: string;
}

export function ClientFilters({
  filters,
  onFiltersChange,
  onClearFilters,
}: ClientFiltersProps) {
  const [localFilters, setLocalFilters] = useState<FilterType>(filters);

  // Dynamic data state
  const [businessTypes, setBusinessTypes] = useState<BusinessType[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [mrs, setMrs] = useState<User[]>([]);

  // Loading states
  const [loadingBusinessTypes, setLoadingBusinessTypes] = useState(false);
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [loadingMrs, setLoadingMrs] = useState(false);

  // Update local state when filters prop changes
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Fetch all dropdown data
  const fetchDropdownData = useCallback(async () => {
    await Promise.all([
      fetchBusinessTypes(),
      fetchRegions(),
      fetchAreas(),
      fetchMrs(),
    ]);
  }, []);

  // Fetch dropdown data on component mount
  useEffect(() => {
    fetchDropdownData();
  }, [fetchDropdownData]);

  // Fetch business types
  const fetchBusinessTypes = async () => {
    setLoadingBusinessTypes(true);
    try {
      const data = await apiGet<BusinessType>("/api/public/business-types");
      setBusinessTypes(data);
    } catch (error) {
      console.error("Failed to fetch business types:", error);
      setBusinessTypes([]);
    } finally {
      setLoadingBusinessTypes(false);
    }
  };

  // Fetch regions
  const fetchRegions = async () => {
    setLoadingRegions(true);
    try {
      const data = await apiGet<Region>("/api/public/regions");
      setRegions(data);
    } catch (error) {
      console.error("Failed to fetch regions:", error);
      setRegions([]);
    } finally {
      setLoadingRegions(false);
    }
  };

  // Fetch areas
  const fetchAreas = async () => {
    setLoadingAreas(true);
    try {
      const data = await apiGet<Area>("/api/public/areas");
      setAreas(data);
    } catch (error) {
      console.error("Failed to fetch areas:", error);
      setAreas([]);
    } finally {
      setLoadingAreas(false);
    }
  };

  // Fetch MRs (Marketing Representatives)
  const fetchMrs = async () => {
    setLoadingMrs(true);
    try {
      const data = await apiGet<User>("/api/public/users?role=MR");
      setMrs(data);
    } catch (error) {
      console.error("Failed to fetch MRs:", error);
      setMrs([]);
    } finally {
      setLoadingMrs(false);
    }
  };

  // Filter areas based on selected region
  const filteredAreas = areas.filter(
    (area) => !localFilters.regionId || area.regionId === localFilters.regionId
  );

  const handleFilterChange = (
    key: keyof FilterType,
    value: string | undefined
  ) => {
    // Convert 'all' value to undefined for clearing filters
    const processedValue = value === "all" ? undefined : value;
    const newFilters = { ...localFilters, [key]: processedValue };

    // Clear area if region is changed
    if (key === "regionId" && processedValue !== localFilters.regionId) {
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
            <div className="flex gap-2">
              {getActiveFiltersCount() > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear all ({getActiveFiltersCount()})
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-muted-foreground hover:text-foreground"
                title="Reset all filters"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Active Filters */}
          {getActiveFiltersCount() > 0 && (
            <div className="flex flex-wrap gap-2">
              {localFilters.businessType && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {
                    businessTypes.find(
                      (bt) => bt.value === localFilters.businessType
                    )?.label
                  }
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1"
                    onClick={() => removeFilter("businessType")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {localFilters.regionId && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {regions.find((r) => r.id === localFilters.regionId)?.name}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1"
                    onClick={() => removeFilter("regionId")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {localFilters.areaId && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {
                    filteredAreas.find((a) => a.id === localFilters.areaId)
                      ?.name
                  }
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1"
                    onClick={() => removeFilter("areaId")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {localFilters.mrId && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {mrs.find((mr) => mr.id === localFilters.mrId)?.name}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1"
                    onClick={() => removeFilter("mrId")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {localFilters.dateFrom && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  From: {localFilters.dateFrom}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1"
                    onClick={() => removeFilter("dateFrom")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {localFilters.dateTo && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  To: {localFilters.dateTo}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1"
                    onClick={() => removeFilter("dateTo")}
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
                {loadingBusinessTypes && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
              </Label>
              <Select
                value={localFilters.businessType || "all"}
                onValueChange={(value) =>
                  handleFilterChange("businessType", value)
                }
                disabled={loadingBusinessTypes}
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
                {loadingRegions && <Loader2 className="h-3 w-3 animate-spin" />}
              </Label>
              <Select
                value={localFilters.regionId || "all"}
                onValueChange={(value) => handleFilterChange("regionId", value)}
                disabled={loadingRegions}
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
                {loadingAreas && <Loader2 className="h-3 w-3 animate-spin" />}
              </Label>
              <Select
                value={localFilters.areaId || "all"}
                onValueChange={(value) => handleFilterChange("areaId", value)}
                disabled={!localFilters.regionId || loadingAreas}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      localFilters.regionId
                        ? "Select area"
                        : "Select region first"
                    }
                  />
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
                {loadingMrs && <Loader2 className="h-3 w-3 animate-spin" />}
              </Label>
              <Select
                value={localFilters.mrId || "all"}
                onValueChange={(value) => handleFilterChange("mrId", value)}
                disabled={loadingMrs}
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
                value={localFilters.dateFrom || ""}
                onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
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
                value={localFilters.dateTo || ""}
                onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                min={localFilters.dateFrom}
              />
            </div>
          </div>

          {/* Quick Filter Buttons and Reset */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = new Date();
                  const oneWeekAgo = new Date();
                  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                  handleFilterChange(
                    "dateFrom",
                    oneWeekAgo.toISOString().split("T")[0]
                  );
                  handleFilterChange(
                    "dateTo",
                    today.toISOString().split("T")[0]
                  );
                }}
              >
                Last 7 days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = new Date();
                  const oneMonthAgo = new Date();
                  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
                  handleFilterChange(
                    "dateFrom",
                    oneMonthAgo.toISOString().split("T")[0]
                  );
                  handleFilterChange(
                    "dateTo",
                    today.toISOString().split("T")[0]
                  );
                }}
              >
                Last 30 days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = new Date();
                  const thisMonth = new Date();
                  thisMonth.setDate(1);
                  handleFilterChange(
                    "dateFrom",
                    thisMonth.toISOString().split("T")[0]
                  );
                  handleFilterChange(
                    "dateTo",
                    today.toISOString().split("T")[0]
                  );
                }}
              >
                This month
              </Button>
            </div>

            {/* Separator and Reset Button */}
            {getActiveFiltersCount() > 0 && (
              <>
                <div className="h-4 w-px bg-border mx-2" />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset Filters
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
