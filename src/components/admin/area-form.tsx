"use client";

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRegionsStore } from '@/store/regions-store';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const areaSchema = z.object({
  name: z.string().min(2, 'Area name must be at least 2 characters'),
  description: z.string().optional(),
  regionId: z.string().min(1, 'Please select a region'),
  status: z.enum(['ACTIVE', 'INACTIVE'], {
    message: 'Please select a status',
  }),
});

type AreaFormData = z.infer<typeof areaSchema>;

export function AreaForm() {
  const {
    isAreaDialogOpen,
    selectedArea,
    regions,
    closeAreaDialog,
    createArea,
    updateArea,
    fetchRegions,
  } = useRegionsStore();
  
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!selectedArea && 'id' in selectedArea;

  const form = useForm<AreaFormData>({
    resolver: zodResolver(areaSchema),
    defaultValues: {
      name: '',
      description: '',
      regionId: '',
      status: 'ACTIVE',
    },
  });

  // Load regions when dialog opens
  useEffect(() => {
    if (isAreaDialogOpen && regions.length === 0) {
      fetchRegions();
    }
  }, [isAreaDialogOpen, regions.length, fetchRegions]);

  useEffect(() => {
    if (selectedArea) {
      // Check if this is an existing area (has an id) or just regionId for pre-selection
      if ('id' in selectedArea) {
        // Editing existing area
        form.reset({
          name: selectedArea.name,
          description: selectedArea.description || '',
          regionId: selectedArea.regionId,
          status: selectedArea.status,
        });
      } else {
        // Creating new area with pre-selected region
        // TypeScript narrowing: we know selectedArea must have regionId if it's not an Area
        const regionPreselect = selectedArea as { regionId: string };
        form.reset({
          name: '',
          description: '',
          regionId: regionPreselect.regionId || '',
          status: 'ACTIVE',
        });
      }
    } else {
      // Creating new area without pre-selection
      form.reset({
        name: '',
        description: '',
        regionId: '',
        status: 'ACTIVE',
      });
    }
  }, [selectedArea, form]);

  const onSubmit = async (data: AreaFormData) => {
    setIsLoading(true);
    try {
      if (isEditing && selectedArea && 'id' in selectedArea) {
        await updateArea(selectedArea.id, data);
        toast({
          title: 'Success',
          description: 'Area updated successfully.',
        });
      } else {
        await createArea(data);
        toast({
          title: 'Success',
          description: 'Area created successfully.',
        });
      }
      closeAreaDialog();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    form.reset();
    closeAreaDialog();
  };

  const activeRegions = regions.filter(region => region.status === 'ACTIVE');

  return (
    <Dialog open={isAreaDialogOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Area' : 'Create New Area'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the area information below.'
              : 'Add a new area within a region.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Area Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter area name"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="regionId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Region</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a region" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeRegions.length === 0 ? (
                        <div className="py-2 px-3 text-sm text-muted-foreground">
                          No active regions available
                        </div>
                      ) : (
                        activeRegions.map((region) => (
                          <SelectItem key={region.id} value={region.id}>
                            {region.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter area description"
                      className="min-h-[80px]"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || activeRegions.length === 0}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Update Area' : 'Create Area'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
