"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { HydrationSafeSelect } from "@/components/hydration-safe-select";
import { SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTaskStore } from "@/store/task-store";
import { useRegionsStore } from "@/store/regions-store";
import { toast } from "@/hooks/use-toast";
import {
  ScrollableFormContent,
  StickyFormFooter,
  FormContainer,
} from "@/components/ui/scrollable-form-content";
import { apiPost, apiPut } from "@/lib/api-client";

const baseTaskFormSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().optional(),
  regionId: z.string().min(1, "Region is required"),
  areaId: z.string().optional(),
  assigneeId: z.string().min(1, "Assignee is required"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  dueDate: z.string().optional(),
});

type TaskFormData = z.infer<typeof baseTaskFormSchema>;

export function TaskForm() {
  const { data: session } = useSession();
  const { isSheetOpen, closeTaskSheet, fetchTasks, selectedTask } = useTaskStore();
  const { regions, areas, fetchRegions, fetchAreas } = useRegionsStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mrs, setMrs] = useState<
    Array<{ id: string; name: string; username: string }>
  >([]);

  const form = useForm<TaskFormData>({
    resolver: zodResolver(baseTaskFormSchema),
    mode: "onBlur",
    defaultValues: {
      title: "",
      description: "",
      regionId: "",
      areaId: "none",
      assigneeId: "",
      priority: "MEDIUM",
      dueDate: "",
    },
  });

  useEffect(() => {
    if (isSheetOpen) {
      fetchRegions();
      // reset form
      if (selectedTask) {
        form.reset({
          title: selectedTask.title || "",
          description: selectedTask.description || "",
          regionId: selectedTask.region?.id || "",
          areaId: selectedTask.area?.id || "none",
          assigneeId: selectedTask.assignee?.id || "",
          priority: selectedTask.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
          dueDate: selectedTask.dueDate ? new Date(selectedTask.dueDate).toISOString().slice(0, 10) : "",
        });
        // Ensure areas list for the preselected region is loaded
        if (selectedTask.region?.id) {
          fetchAreas(1, selectedTask.region.id);
        }
      } else {
        form.reset({
          title: "",
          description: "",
          regionId: "",
          areaId: "none",
          assigneeId: "",
          priority: "MEDIUM",
          dueDate: "",
        });
      }
      // Fetch MR users for assignee dropdown
      // - For Lead MR: only their team members (and implicitly same region via server)
      // - For Admin: all MRs
      const role = session?.user?.role;
      const userId = session?.user?.id as string | undefined;

      const fetchAssignees = async () => {
        try {
          if (role === "LEAD_MR" && userId) {
            // Prefer team list first
            const r = await fetch(`/api/users/${userId}/team`);
            const res: {
              success: boolean;
              data?: {
                teamMembers?: Array<{
                  id: string;
                  name: string;
                  username: string;
                }>;
              };
            } = await r.json();
            if (res?.success && res?.data?.teamMembers) {
              setMrs(
                res.data.teamMembers.map((u) => ({
                  id: u.id,
                  name: u.name,
                  username: u.username,
                }))
              );
              return;
            }
            // Fallback: include same-region MRs if any
            const r2 = await fetch(`/api/users?role=MR&assignable=true&page=1&limit=50`);
            const res2: {
              success: boolean;
              data?: { data?: Array<{ id: string; name: string; username: string }> };
            } = await r2.json();
            if (res2?.success && res2?.data?.data) {
              setMrs(res2.data.data);
              return;
            }
            setMrs([]);
            return;
          }

          // Default (ADMIN or fallback): list all MRs
          const r = await fetch(`/api/users?role=MR&page=1&limit=50`);
          const res: {
            success: boolean;
            data?: {
              data?: Array<{ id: string; name: string; username: string }>;
            };
          } = await r.json();
          if (res?.success && res?.data?.data) {
            setMrs(
              res.data.data.map((u) => ({
                id: u.id,
                name: u.name,
                username: u.username,
              }))
            );
          } else {
            setMrs([]);
          }
        } catch {
          setMrs([]);
        }
      };

      fetchAssignees();
    }
  }, [isSheetOpen, fetchRegions, form, fetchAreas, selectedTask, session?.user?.role, session?.user?.id]);

  // Load areas when region changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "regionId" && value.regionId) {
        fetchAreas(1, value.regionId as string);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, fetchAreas]);

  const onSubmit = async (data: TaskFormData) => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...data,
        areaId:
          !data.areaId || data.areaId === "none" ? undefined : data.areaId,
        dueDate: data.dueDate
          ? new Date(data.dueDate).toISOString()
          : undefined,
      };
      const result = selectedTask
        ? await apiPut(`/api/tasks/${selectedTask.id}`, payload)
        : await apiPost("/api/tasks", payload);
      if (!result.success)
        throw new Error(result.error || "Failed to create task");
      toast({ title: "Success", description: selectedTask ? "Task updated successfully" : "Task created successfully" });
      closeTaskSheet();
      await fetchTasks(1, 10);
    } catch {
      toast({
        title: "Error",
        description: selectedTask ? "Failed to update task" : "Failed to create task",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={isSheetOpen} onOpenChange={closeTaskSheet}>
      <SheetContent
        className="w-full max-w-[500px] sm:max-w-[540px] h-full flex flex-col"
        suppressHydrationWarning
      >
        <SheetHeader>
          <SheetTitle>Create New Task</SheetTitle>
          <SheetDescription>
            Fill in the details to create a task
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <FormContainer onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollableFormContent>
              <FormField
                name="title"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title *</FormLabel>
                    <FormControl>
                      <Input placeholder="Task title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                name="description"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  name="regionId"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Region *</FormLabel>
                      <FormControl>
                        <HydrationSafeSelect
                          value={field.value}
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          placeholder="Select region"
                        >
                          {regions.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.name}
                            </SelectItem>
                          ))}
                        </HydrationSafeSelect>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  name="areaId"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Area</FormLabel>
                      <FormControl>
                        <HydrationSafeSelect
                          value={field.value}
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          placeholder="Select area"
                        >
                          <SelectItem value="none">No area</SelectItem>
                          {areas
                            .filter(
                              (a) => a.regionId === form.getValues("regionId")
                            )
                            .map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.name}
                              </SelectItem>
                            ))}
                        </HydrationSafeSelect>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                name="assigneeId"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assignee (MR) *</FormLabel>
                    <FormControl>
                      <HydrationSafeSelect
                        value={field.value}
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        placeholder="Select MR"
                      >
                        {mrs.map((mr) => (
                          <SelectItem key={mr.id} value={mr.id}>
                            {mr.name} ({mr.username})
                          </SelectItem>
                        ))}
                      </HydrationSafeSelect>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  name="priority"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <FormControl>
                        <HydrationSafeSelect
                          value={field.value}
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          placeholder="Select priority"
                        >
                          <SelectItem value="LOW">Low</SelectItem>
                          <SelectItem value="MEDIUM">Medium</SelectItem>
                          <SelectItem value="HIGH">High</SelectItem>
                          <SelectItem value="URGENT">Urgent</SelectItem>
                        </HydrationSafeSelect>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  name="dueDate"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </ScrollableFormContent>

            <StickyFormFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeTaskSheet}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {selectedTask ? 'Update Task' : 'Create Task'}
              </Button>
            </StickyFormFooter>
          </FormContainer>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
