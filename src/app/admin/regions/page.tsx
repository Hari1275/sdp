"use client";

import { useEffect, useMemo } from 'react';
import { useRegionsStore } from '@/store/regions-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  PlusCircle, 
  MapPin, 
  Building, 
  Users, 
  Edit,
  Trash2,
  MoreHorizontal,
  ChevronRight,
  Globe,
  Target
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RegionForm } from '@/components/admin/region-form';
import { AreaForm } from '@/components/admin/area-form';

export default function RegionsPage() {
  const {
    regions,
    areas,
    isLoading,
    error,
    fetchRegions,
    fetchAreas,
    deleteRegion,
    deleteArea,
    toggleRegionStatus,
    toggleAreaStatus,
    openRegionDialog,
    openAreaDialog,
  } = useRegionsStore();

  useEffect(() => {
    const loadData = async () => {
      console.log('Loading regions and areas...');
      await fetchRegions();
      await fetchAreas();
      console.log('Loaded regions:', regions.length);
      console.log('Loaded areas:', areas.length);
    };
    loadData();
  }, [fetchRegions, fetchAreas, regions.length, areas.length]);

  const regionStats = useMemo(() => {
    const totalRegions = regions.length;
    const activeRegions = regions.filter(region => region.status === 'ACTIVE').length;
    const totalAreas = areas.length;
    const activeAreas = areas.filter(area => area.status === 'ACTIVE').length;
    const totalUsers = regions.reduce((sum, region) => sum + region._count.users, 0);

    return {
      totalRegions,
      activeRegions,
      totalAreas,
      activeAreas,
      totalUsers
    };
  }, [regions, areas]);

  const getAreasByRegion = (regionId: string) => {
    const regionAreas = areas.filter(area => area.regionId === regionId);
    console.log(`Areas for region ${regionId}:`, regionAreas);
    return regionAreas;
  };

  const handleDeleteRegion = async (id: string) => {
    try {
      await deleteRegion(id);
    } catch {
      // console.error('Failed to delete region');
    }
  };

  const handleDeleteArea = async (id: string) => {
    try {
      await deleteArea(id);
    } catch {
      // console.error('Failed to delete area');
    }
  };

  const handleToggleRegionStatus = async (id: string, currentStatus: string) => {
    try {
      await toggleRegionStatus(id, currentStatus);
    } catch {
      // console.error('Failed to toggle region status');
    }
  };

  const handleToggleAreaStatus = async (id: string, currentStatus: string) => {
    try {
      await toggleAreaStatus(id, currentStatus);
    } catch {
      // console.error('Failed to toggle area status');
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-8">
            {[...Array(5)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                  <div className="h-8 bg-gray-200 rounded w-16"></div>
                </CardHeader>
              </Card>
            ))}
          </div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="h-6 bg-gray-200 rounded w-48"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-32"></div>
                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Regions & Areas Management</h1>
          <p className="text-muted-foreground">
            Manage geographical regions and their areas.
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => openAreaDialog()} className="w-full sm:w-auto">
            <Target className="mr-2 h-4 w-4" />
            Add Area
          </Button>
          <Button onClick={() => openRegionDialog()} className="w-full sm:w-auto">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Region
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Regions</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{regionStats.totalRegions}</div>
            <p className="text-xs text-muted-foreground">
              {regionStats.activeRegions} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Areas</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{regionStats.totalAreas}</div>
            <p className="text-xs text-muted-foreground">
              {regionStats.activeAreas} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{regionStats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              Across all regions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Coverage</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {regionStats.totalRegions > 0 ? Math.round((regionStats.activeRegions / regionStats.totalRegions) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Active regions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Area Coverage</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {regionStats.totalAreas > 0 ? Math.round((regionStats.activeAreas / regionStats.totalAreas) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Active areas
            </p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <span>Error loading regions: {error}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  fetchRegions();
                  fetchAreas();
                }}
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Regions and Areas Hierarchy */}
      <div className="space-y-6">
        <h2 className="text-xl md:text-2xl font-semibold">Regions Hierarchy</h2>
        
        {regions.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No regions found</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first region to start organizing your areas.
                </p>
                <Button onClick={() => openRegionDialog()}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Create First Region
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {regions.map((region) => {
              const regionAreas = getAreasByRegion(region.id);
              
              return (
                <Card key={region.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Globe className="h-5 w-5 text-blue-600" />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{region.name}</h3>
                            <Badge 
                              variant={region.status === 'ACTIVE' ? 'default' : 'secondary'}
                              className={
                                region.status === 'ACTIVE' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }
                            >
                              {region.status}
                            </Badge>
                          </div>
                          {region.description && (
                            <p className="text-sm text-muted-foreground">
                              {region.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {region._count.areas} areas
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {region._count.users} users
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            // Create a new area object with the region pre-selected
                            openAreaDialog({ regionId: region.id })
                          }}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Area
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openRegionDialog(region)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Region
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleToggleRegionStatus(region.id, region.status)}
                          >
                            {region.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                          </DropdownMenuItem>
                          <Separator />
                          <DropdownMenuItem 
                            onClick={() => handleDeleteRegion(region.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Region
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  
                  {regionAreas.length > 0 && (
                    <CardContent>
                      <div className="space-y-3">
                        {regionAreas.map((area) => (
                          <div key={area.id} className="flex items-center justify-between pl-8 py-2 border-l-2 border-gray-100">
                            <div className="flex items-center gap-3">
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              <MapPin className="h-4 w-4 text-green-600" />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{area.name}</span>
                                  <Badge 
                                    variant={area.status === 'ACTIVE' ? 'default' : 'secondary'}
                                    className={
                                      area.status === 'ACTIVE' 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-gray-100 text-gray-800'
                                    }
                                  >
                                    {area.status}
                                  </Badge>
                                </div>
                                {area.description && (
                                  <p className="text-sm text-muted-foreground">
                                    {area.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Building className="h-3 w-3" />
                                    {area._count.clients} clients
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Target className="h-3 w-3" />
                                    {area._count.tasks} tasks
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openAreaDialog(area)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Area
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleToggleAreaStatus(area.id, area.status)}
                                >
                                  {area.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                                </DropdownMenuItem>
                                <Separator />
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteArea(area.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Area
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Forms */}
      <RegionForm />
      <AreaForm />
    </div>
  );
}
