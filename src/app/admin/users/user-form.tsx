"use client";

import { useEffect, useState } from "react";
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
import { SelectItem } from "@/components/ui/select";
import { HydrationSafeSelect } from "@/components/hydration-safe-select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUserStore } from "@/store/user-store";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ScrollableFormContent, StickyFormFooter, FormContainer } from "@/components/ui/scrollable-form-content";

// Base schema for all form fields
const baseUserFormSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  phone: z.string().optional(),
  password: z.string(), // We'll handle validation separately
  role: z.enum(["MR", "LEAD_MR", "ADMIN"]),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]),
  regionId: z.string().optional(),
  leadMrId: z.string().optional(),
});

type UserFormData = z.infer<typeof baseUserFormSchema>;

export function UserForm() {
  const {
    isSheetOpen,
    selectedUser,
    closeUserSheet,
    createUser,
    updateUser,
    regions,
    leadMrs,
    fetchRegions,
    fetchLeadMrs,
  } = useUserStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEdit = !!selectedUser;

  const form = useForm<UserFormData>({
    resolver: zodResolver(baseUserFormSchema),
    mode: 'onBlur',
    defaultValues: {
      username: "",
      name: "",
      email: "",
      phone: "",
      password: "",
      role: "MR",
      status: "ACTIVE",
      regionId: "none",
      leadMrId: "none",
    },
  });
  
  // Custom validation for password based on mode
  const validatePassword = (password: string) => {
    if (!isEdit && (!password || password.length === 0)) {
      return "Password is required for new users";
    }
    if (password && password.length > 0 && password.length < 8) {
      return "Password must be at least 8 characters";
    }
    return true;
  };

  // Load data when sheet opens
  useEffect(() => {
    if (isSheetOpen) {
      fetchRegions();
      fetchLeadMrs();
      
      if (selectedUser) {
        form.reset({
          username: selectedUser.username,
          name: selectedUser.name,
          email: selectedUser.email || "",
          phone: selectedUser.phone || "",
          password: "", // Don't populate password for editing
          role: selectedUser.role,
          status: selectedUser.status,
          regionId: selectedUser.regionId || "none",
          leadMrId: selectedUser.leadMrId || "none",
        });
      } else {
        form.reset({
          username: "",
          name: "",
          email: "",
          phone: "",
          password: "",
          role: "MR",
          status: "ACTIVE",
          regionId: "none",
          leadMrId: "none",
        });
      }
      
      // Focus first input when form opens
      setTimeout(() => {
        const firstInput = document.querySelector('input[name="username"]') as HTMLInputElement;
        if (firstInput) {
          firstInput.focus();
        }
      }, 100);
    }
  }, [isSheetOpen, selectedUser, form, fetchRegions, fetchLeadMrs]);

  const onSubmit = async (data: UserFormData) => {
    setIsSubmitting(true);
    try {
      // Clean up empty optional fields
      const cleanedData = {
        ...data,
        email: data.email, // email is now required, so don't convert to undefined
        phone: data.phone || undefined,
        regionId: data.regionId === "none" || !data.regionId ? undefined : data.regionId,
        leadMrId: data.leadMrId === "none" || !data.leadMrId ? undefined : data.leadMrId,
        password: data.password || undefined,
      };

      if (selectedUser) {
        await updateUser(selectedUser.id, cleanedData);
        toast({
          title: "Success",
          description: "User updated successfully",
        });
      } else {
        if (!cleanedData.password) {
          form.setError("password", {
            message: "Password is required for new users",
          });
          return;
        }
        await createUser(cleanedData);
        toast({
          title: "Success",
          description: "User created successfully",
        });
      }
      closeUserSheet();
    } catch {
      toast({
        title: "Error",
        description: selectedUser ? "Failed to update user" : "Failed to create user",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = (role: string) => {
    form.setValue("role", role as "MR" | "LEAD_MR" | "ADMIN");
    
    // Clear leadMrId if role is not MR
    if (role !== "MR") {
      form.setValue("leadMrId", "none");
    }
  };

  return (
    <Sheet open={isSheetOpen} onOpenChange={closeUserSheet}>
      <SheetContent className="w-full max-w-[500px] sm:max-w-[540px] h-full flex flex-col" suppressHydrationWarning>
        <SheetHeader>
          <SheetTitle>
            {selectedUser ? "Edit User" : "Create New User"}
          </SheetTitle>
          <SheetDescription>
            {selectedUser
              ? "Update the user information below."
              : "Fill in the information to create a new user."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <FormContainer onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollableFormContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username *</FormLabel>
                    <FormControl>
                      <Input placeholder="johndoe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="john@example.com"
                      {...field}
                    />
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
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="+1234567890" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              rules={{
                validate: validatePassword
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Password {!selectedUser && "*"}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder={selectedUser ? "Leave blank to keep current" : "Enter password"}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role *</FormLabel>
                    <FormControl>
                      <HydrationSafeSelect
                        value={field.value}
                        onValueChange={handleRoleChange}
                        defaultValue={field.value}
                        placeholder="Select role"
                      >
                        <SelectItem value="MR">Marketing Representative</SelectItem>
                        <SelectItem value="LEAD_MR">Lead MR</SelectItem>
                        <SelectItem value="ADMIN">Administrator</SelectItem>
                      </HydrationSafeSelect>
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
                    <FormLabel>Status *</FormLabel>
                    <FormControl>
                      <HydrationSafeSelect
                        value={field.value}
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        placeholder="Select status"
                      >
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                        <SelectItem value="SUSPENDED">Suspended</SelectItem>
                      </HydrationSafeSelect>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="regionId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Region</FormLabel>
                  <FormControl>
                    <HydrationSafeSelect
                      value={field.value}
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      placeholder="Select region"
                    >
                      <SelectItem value="none">No region</SelectItem>
                      {regions.map((region) => (
                        <SelectItem key={region.id} value={region.id}>
                          {region.name}
                        </SelectItem>
                      ))}
                    </HydrationSafeSelect>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch("role") === "MR" && (
              <FormField
                control={form.control}
                name="leadMrId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead MR</FormLabel>
                    <FormControl>
                      <HydrationSafeSelect
                        value={field.value}
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        placeholder="Select lead MR"
                      >
                        <SelectItem value="none">No lead MR</SelectItem>
                        {leadMrs.map((leadMr) => (
                          <SelectItem key={leadMr.id} value={leadMr.id}>
                            {leadMr.name}
                          </SelectItem>
                        ))}
                      </HydrationSafeSelect>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            </ScrollableFormContent>
            
            <StickyFormFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeUserSheet}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {selectedUser ? "Update User" : "Create User"}
              </Button>
            </StickyFormFooter>
          </FormContainer>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
