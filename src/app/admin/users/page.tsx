
"use client";

import { useEffect } from 'react';
import { useUserStore } from '@/store/user-store';
import { columns } from './columns';
import { DataTable } from './data-table';
import { UserFormDynamic } from '@/components/portal-safe';
import { ClientOnly } from '@/components/client-only';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function UserManagementPage() {
  const { users, fetchUsers, openUserSheet, isSheetOpen } = useUserStore();

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Refresh data when sheet closes (after successful operation)
  useEffect(() => {
    if (!isSheetOpen) {
      // Small delay to ensure any pending operations complete
      const timer = setTimeout(() => {
        fetchUsers();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isSheetOpen, fetchUsers]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            Manage all users in the system.
          </p>
        </div>
        <Button onClick={() => openUserSheet()}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User List</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientOnly fallback={
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          }>
            <DataTable columns={columns} data={users} />
          </ClientOnly>
        </CardContent>
      </Card>
      
      <UserFormDynamic />
    </div>
  );
}

