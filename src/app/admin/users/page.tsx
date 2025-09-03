"use client";

import { useEffect, useMemo } from "react";
import { useUserStore } from "@/store/user-store";
import { columns } from "./columns";
import { DataTable } from "./data-table";
import { UserFormDynamic } from "@/components/portal-safe";
import { ClientOnly } from "@/components/client-only";
import { Button } from "@/components/ui/button";
import { PlusCircle, Users, UserCheck, UserX, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function UserManagementPage() {
  const {
    users,
    pagination,
    isLoading,
    error,
    fetchUsers,
    openUserSheet,
    isSheetOpen,
  } = useUserStore();

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

  // Calculate user statistics
  const userStats = useMemo(() => {
    // Use server-side total for accurate count, but client-side filtering for current page stats
    const totalUsers = pagination.total; // Server-side total count
    const activeUsers = users.filter((user) => user.status === "ACTIVE").length;
    const inactiveUsers = users.filter(
      (user) => user.status === "INACTIVE"
    ).length;
    const adminUsers = users.filter((user) => user.role === "ADMIN").length;
    const leadMrUsers = users.filter((user) => user.role === "LEAD_MR").length;
    const mrUsers = users.filter((user) => user.role === "MR").length;

    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
      adminUsers,
      leadMrUsers,
      mrUsers,
    };
  }, [users, pagination.total]);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            Manage all users in the system.
          </p>
        </div>
        <Button onClick={() => openUserSheet()} className="w-full sm:w-auto">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* User Statistics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userStats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              All users in the system
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {userStats.activeUsers}
            </div>
            <p className="text-xs text-muted-foreground">
              {userStats.totalUsers > 0
                ? Math.round(
                    (userStats.activeUsers / userStats.totalUsers) * 100
                  )
                : 0}
              % of total users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Inactive Users
            </CardTitle>
            <UserX className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {userStats.inactiveUsers}
            </div>
            <p className="text-xs text-muted-foreground">
              {userStats.totalUsers > 0
                ? Math.round(
                    (userStats.inactiveUsers / userStats.totalUsers) * 100
                  )
                : 0}
              % of total users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
            <Shield className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {userStats.adminUsers}
            </div>
            <p className="text-xs text-muted-foreground">
              {userStats.leadMrUsers} Lead MRs, {userStats.mrUsers} MRs
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User List</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientOnly
            fallback={
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            }
          >
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">
                    Loading users...
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-48">
                <div className="text-center">
                  <p className="text-sm text-red-600 mb-2">
                    Error loading users
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">{error}</p>
                  <Button
                    onClick={() => fetchUsers()}
                    variant="outline"
                    size="sm"
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            ) : (
              <DataTable
                columns={columns}
                data={users}
                pagination={pagination}
                onPaginationChange={(page, limit) => fetchUsers(page, limit)}
              />
            )}
          </ClientOnly>
        </CardContent>
      </Card>

      <UserFormDynamic />
    </div>
  );
}
