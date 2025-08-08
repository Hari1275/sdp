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

const regionSchema = z.object({
  name: z.string().min(2, 'Region name must be at least 2 characters'),
  description: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE'], {
    message: 'Please select a status',
  }),
});

type RegionFormData = z.infer<typeof regionSchema>;

export function RegionForm() {
  const {
    isRegionDialogOpen,
    selectedRegion,
    closeRegionDialog,
    createRegion,
    updateRegion,
  } = useRegionsStore();
  
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!selectedRegion;

  const form = useForm<RegionFormData>({
    resolver: zodResolver(regionSchema),
    defaultValues: {
      name: '',
      description: '',
      status: 'ACTIVE',
    },
  });

  useEffect(() => {
    if (selectedRegion) {
      form.reset({
        name: selectedRegion.name,
        description: selectedRegion.description || '',
        status: selectedRegion.status,
      });
    } else {
      form.reset({
        name: '',
        description: '',
        status: 'ACTIVE',
      });
    }
  }, [selectedRegion, form]);

  const onSubmit = async (data: RegionFormData) => {
    setIsLoading(true);
    try {
      if (isEditing && selectedRegion) {
        await updateRegion(selectedRegion.id, data);
        toast({
          title: 'Success',
          description: 'Region updated successfully.',
        });
      } else {
        await createRegion(data);
        toast({
          title: 'Success',
          description: 'Region created successfully.',
        });
      }
      closeRegionDialog();
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
    closeRegionDialog();
  };

  return (
    <Dialog open={isRegionDialogOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Region' : 'Create New Region'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the region information below.'
              : 'Add a new geographical region to organize areas.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Region Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter region name"
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter region description"
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
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Update Region' : 'Create Region'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
