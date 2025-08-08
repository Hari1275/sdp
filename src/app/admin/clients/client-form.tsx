"use client";

import { useState, useEffect } from 'react';
import { ClientOnly } from '@/components/client-only';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useClientStore } from '@/store/client-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Loader2, MapPin, Building2, Phone, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';

// Client form schema
const clientFormSchema = z.object({
  name: z.string().min(2, 'Client name must be at least 2 characters').max(200, 'Name is too long'),
  phone: z.string().regex(/^[0-9]{10}$/, 'Phone number must be 10 digits').optional().or(z.literal('')),
  businessType: z.enum(['CLINIC', 'HOSPITAL', 'PHARMACY', 'MEDICAL_STORE', 'HEALTHCARE_CENTER']),
  address: z.string().max(500, 'Address is too long').optional().or(z.literal('')),
  latitude: z.number().min(-90).max(90, 'Invalid latitude'),
  longitude: z.number().min(-180).max(180, 'Invalid longitude'),
  notes: z.string().max(1000, 'Notes are too long').optional().or(z.literal('')),
  regionId: z.string().min(1, 'Region is required'),
  areaId: z.string().min(1, 'Area is required'),
  mrId: z.string().min(1, 'Marketing representative is required'),
});

type ClientFormData = z.infer<typeof clientFormSchema>;

// Business types - static enum values
const businessTypes = [
  { value: 'CLINIC', label: 'Clinic' },
  { value: 'HOSPITAL', label: 'Hospital' },
  { value: 'PHARMACY', label: 'Pharmacy' },
  { value: 'MEDICAL_STORE', label: 'Medical Store' },
  { value: 'HEALTHCARE_CENTER', label: 'Healthcare Center' },
];

// Define types for API data
interface Region {
  id: string;
  name: string;
}

interface Area {
  id: string;
  name: string;
  regionId: string;
}

interface User {
  id: string;
  name: string;
  regionId?: string;
}

export function ClientForm() {
  const {
    isSheetOpen,
    selectedClient,
    closeClientSheet,
    createClient,
    updateClient,
  } = useClientStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: '',
      phone: '',
      businessType: 'CLINIC',
      address: '',
      latitude: 19.0760, // Default to Mumbai coordinates
      longitude: 72.8777,
      notes: '',
      regionId: '',
      areaId: '',
      mrId: '',
    },
  });

  const selectedRegionId = form.watch('regionId');
  
  // Ensure we always have arrays for filtering
  const safeRegions = Array.isArray(regions) ? regions : [];
  const safeAreas = Array.isArray(areas) ? areas : [];
  const safeUsers = Array.isArray(users) ? users : [];
  
  const filteredAreas = safeAreas.filter(area => area.regionId === selectedRegionId);
  const filteredMRs = safeUsers.filter(user => user.regionId === selectedRegionId);
  
  // Debug MR filtering
  console.log('[ClientForm] MR Filtering Debug:', {
    selectedRegionId,
    selectedRegionIdType: typeof selectedRegionId,
    allUsers: safeUsers.map(u => ({ 
      id: u.id, 
      name: u.name, 
      regionId: u.regionId,
      regionIdType: typeof u.regionId 
    })),
    filteredMRs: filteredMRs.map(u => ({ id: u.id, name: u.name, regionId: u.regionId })),
    filterLogic: safeUsers.map(u => ({ 
      name: u.name, 
      regionId: u.regionId, 
      selectedRegion: selectedRegionId,
      matches: u.regionId === selectedRegionId,
      strictEquals: u.regionId === selectedRegionId,
      looseEquals: u.regionId == selectedRegionId
    }))
  });
  
  // Debug the dropdown rendering
  console.log('[ClientForm] Dropdown render state:', {
    isSheetOpen,
    isLoadingData,
    regionsState: {
      rawRegions: regions,
      safeRegions,
      safeRegionsLength: safeRegions.length,
      isArray: Array.isArray(regions)
    },
    areasState: {
      rawAreas: areas,
      safeAreas,
      safeAreasLength: safeAreas.length,
    },
    usersState: {
      rawUsers: users,
      safeUsers,
      safeUsersLength: safeUsers.length,
    },
    selectedRegionId,
    filteredAreasLength: filteredAreas.length,
    filteredMRsLength: filteredMRs.length
  });

  // Mount effect
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch data when sheet opens
  useEffect(() => {
    if (isSheetOpen && isMounted) {
      fetchFormData();
    }
  }, [isSheetOpen, isMounted]);

  const fetchFormData = async () => {
    setIsLoadingData(true);
    try {
      console.log('[ClientForm] Starting to fetch form data...');
      
      // Fetch regions
      console.log('[ClientForm] Fetching regions...');
      const regionsResponse = await fetch('/api/public/regions');
      console.log('[ClientForm] Regions response status:', regionsResponse.status);
      
      if (regionsResponse.ok) {
        const regionsResult = await regionsResponse.json();
        console.log('[ClientForm] Regions raw response:', regionsResult);
        
        // More detailed logging
        if (regionsResult.success) {
          console.log('[ClientForm] Regions API success, data:', regionsResult.data);
          const regionData = Array.isArray(regionsResult.data) ? regionsResult.data : [];
          setRegions(regionData);
          console.log('[ClientForm] Set regions array with', regionData.length, 'items:', regionData);
        } else {
          console.error('[ClientForm] Regions API returned success:false:', regionsResult);
          setRegions([]);
        }
      } else {
        const errorText = await regionsResponse.text();
        console.error('[ClientForm] Failed to fetch regions:', regionsResponse.status, errorText);
        setRegions([]);
      }

      // Fetch areas
      console.log('[ClientForm] Fetching areas...');
      const areasResponse = await fetch('/api/public/areas');
      if (areasResponse.ok) {
        const areasResult = await areasResponse.json();
        console.log('[ClientForm] Areas response:', areasResult);
        const areaData = Array.isArray(areasResult.data) ? areasResult.data : [];
        setAreas(areaData);
        console.log('[ClientForm] Set areas:', areaData.length, 'items');
      } else {
        console.error('[ClientForm] Failed to fetch areas:', areasResponse.status);
        setAreas([]);
      }

      // Fetch users (MRs)
      console.log('[ClientForm] Fetching users...');
      const usersResponse = await fetch('/api/public/users?role=MR');
      if (usersResponse.ok) {
        const usersResult = await usersResponse.json();
        console.log('[ClientForm] Users response:', usersResult);
        const userData = Array.isArray(usersResult.data) ? usersResult.data : [];
        setUsers(userData);
        console.log('[ClientForm] Set users:', userData.length, 'items');
      } else {
        console.error('[ClientForm] Failed to fetch users:', usersResponse.status);
        setUsers([]);
      }
    } catch (error) {
      console.error('[ClientForm] Error fetching form data:', error);
      // Ensure we always have arrays even on error
      setRegions([]);
      setAreas([]);
      setUsers([]);
      toast({
        title: 'Error',
        description: 'Failed to load form data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  // Reset form when sheet opens/closes or selected client changes
  useEffect(() => {
    if (isSheetOpen) {
      if (selectedClient) {
        form.reset({
          name: selectedClient.name,
          phone: selectedClient.phone || '',
          businessType: selectedClient.businessType as 'CLINIC' | 'HOSPITAL' | 'PHARMACY' | 'MEDICAL_STORE' | 'HEALTHCARE_CENTER',
          address: selectedClient.address || '',
          latitude: selectedClient.latitude,
          longitude: selectedClient.longitude,
          notes: selectedClient.notes || '',
          regionId: selectedClient.regionId,
          areaId: selectedClient.areaId,
          mrId: selectedClient.mrId,
        });
      } else {
        form.reset({
          name: '',
          phone: '',
          businessType: 'CLINIC',
          address: '',
          latitude: 19.0760,
          longitude: 72.8777,
          notes: '',
          regionId: '',
          areaId: '',
          mrId: '',
        });
      }
    }
  }, [isSheetOpen, selectedClient, form]);

  // Clear area and MR when region changes
  useEffect(() => {
    if (selectedRegionId) {
      const currentAreaId = form.getValues('areaId');
      const currentMRId = form.getValues('mrId');
      
      // Clear area if it doesn't belong to selected region
      if (currentAreaId && !filteredAreas.find(area => area.id === currentAreaId)) {
        form.setValue('areaId', '');
      }
      
      // Clear MR if they don't belong to selected region
      if (currentMRId && !filteredMRs.find(mr => mr.id === currentMRId)) {
        form.setValue('mrId', '');
      }
    }
  }, [selectedRegionId, form, filteredAreas, filteredMRs]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: 'Error',
        description: 'Geolocation is not supported by this browser.',
        variant: 'destructive',
      });
      return;
    }

    setIsGettingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        form.setValue('latitude', position.coords.latitude);
        form.setValue('longitude', position.coords.longitude);
        setIsGettingLocation(false);
        toast({
          title: 'Success',
          description: 'Location coordinates updated successfully.',
        });
      },
      (error) => {
        console.error('Error getting location:', error);
        setIsGettingLocation(false);
        toast({
          title: 'Error',
          description: 'Failed to get current location. Please enter coordinates manually.',
          variant: 'destructive',
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const onSubmit = async (data: ClientFormData) => {
    setIsSubmitting(true);
    try {
      // Debug logging to verify ObjectID format
      console.log('[ClientForm] Submitting data:', {
        regionId: data.regionId,
        areaId: data.areaId,
        mrId: data.mrId,
        isValidObjectId: {
          region: data.regionId.length === 24 && /^[0-9a-fA-F]+$/.test(data.regionId),
          area: data.areaId.length === 24 && /^[0-9a-fA-F]+$/.test(data.areaId),
          mr: data.mrId.length === 24 && /^[0-9a-fA-F]+$/.test(data.mrId)
        }
      });

      if (selectedClient) {
        await updateClient(selectedClient.id, data);
        toast({
          title: 'Success',
          description: 'Client updated successfully',
        });
      } else {
        await createClient(data);
        toast({
          title: 'Success',
          description: 'Client created successfully',
        });
      }
      closeClientSheet();
    } catch (error) {
      console.error('[ClientForm] Submit error:', error);
      toast({
        title: 'Error',
        description: selectedClient ? 'Failed to update client' : 'Failed to create client',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Don't render until mounted to prevent hydration mismatch
  if (!isMounted) {
    return null;
  }

  return (
    <ClientOnly>
      <Sheet open={isSheetOpen} onOpenChange={closeClientSheet}>
        <SheetContent className="w-full max-w-[600px] sm:max-w-[700px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {selectedClient ? 'Edit Client' : 'Add New Client'}
          </SheetTitle>
          <SheetDescription>
            {selectedClient
              ? 'Update the client information below.'
              : 'Fill in the information to add a new healthcare facility.'}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6">
            {/* Basic Information */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Basic Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Client Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Healthcare facility name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          Phone Number
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="10-digit phone number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="businessType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Type *</FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select business type" />
                            </SelectTrigger>
                            <SelectContent>
                              {businessTypes.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="mt-4">
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Full address of the healthcare facility"
                          className="min-h-[80px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Location Information */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Location Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="regionId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Region *</FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select region" />
                            </SelectTrigger>
                            <SelectContent>
                              {isLoadingData ? (
                                <div className="p-2 text-sm text-muted-foreground">Loading regions...</div>
                              ) : safeRegions.length > 0 ? (
                                safeRegions.map((region) => (
                                  <SelectItem key={region.id} value={region.id}>
                                    {region.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem key="no-data" value="no-regions" disabled>
                                  No regions available (API returned {safeRegions.length} items)
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="areaId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Area *</FormLabel>
                        <FormControl>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                            disabled={!selectedRegionId}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={selectedRegionId ? "Select area" : "Select region first"} />
                            </SelectTrigger>
                            <SelectContent>
                              {isLoadingData ? (
                                <div className="p-2 text-sm text-muted-foreground">Loading areas...</div>
                              ) : !selectedRegionId ? (
                                <div className="p-2 text-sm text-muted-foreground">Select region first</div>
                              ) : filteredAreas.length > 0 ? (
                                filteredAreas.map((area) => (
                                  <SelectItem key={area.id} value={area.id}>
                                    {area.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <div className="p-2 text-sm text-muted-foreground">No areas available for this region</div>
                              )}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="mrId"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Marketing Representative *</FormLabel>
                        <FormControl>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                            disabled={!selectedRegionId}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={selectedRegionId ? "Select MR" : "Select region first"} />
                            </SelectTrigger>
                            <SelectContent>
                              {isLoadingData ? (
                                <div className="p-2 text-sm text-muted-foreground">Loading users...</div>
                              ) : !selectedRegionId ? (
                                <div className="p-2 text-sm text-muted-foreground">Select region first</div>
                              ) : filteredMRs.length > 0 ? (
                                filteredMRs.map((mr) => (
                                  <SelectItem key={mr.id} value={mr.id}>
                                    {mr.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <div className="p-2 text-sm text-muted-foreground">No MRs available for this region</div>
                              )}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* GPS Coordinates */}
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <Label>GPS Coordinates *</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={getCurrentLocation}
                      disabled={isGettingLocation}
                    >
                      {isGettingLocation ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <MapPin className="mr-2 h-4 w-4" />
                      )}
                      {isGettingLocation ? 'Getting Location...' : 'Use Current Location'}
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="latitude"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Latitude</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="any" 
                              placeholder="19.0760"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="longitude"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Longitude</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="any" 
                              placeholder="72.8777"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Additional Information */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Additional Information
                </h3>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Any additional notes about this client..."
                          className="min-h-[100px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Form Actions */}
            <div className="flex justify-end gap-4 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={closeClientSheet}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {selectedClient ? 'Update Client' : 'Create Client'}
              </Button>
            </div>
          </form>
        </Form>
        </SheetContent>
      </Sheet>
    </ClientOnly>
  );
}
