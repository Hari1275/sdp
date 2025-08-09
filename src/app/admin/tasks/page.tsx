"use client";

import { useEffect, useMemo, useState } from "react";
import { useTaskStore } from "@/store/task-store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ClientOnly } from "@/components/client-only";
import {
  CheckSquare,
  Clock,
  Filter,
  PlusCircle,
  Search,
  TriangleAlert,
} from "lucide-react";
import { TaskFormDynamic } from "@/components/portal-safe";

type StatusFilter =
  | "ALL"
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";
type PriorityFilter = "ALL" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export default function TasksAdminPage() {
  const {
    tasks,
    isLoading,
    error,
    fetchTasks,
    setFilters,
    pagination,
    updateStatus,
    completeTask,
    openTaskSheet,
  } = useTaskStore();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [priority, setPriority] = useState<PriorityFilter>("ALL");

  useEffect(() => {
    fetchTasks(1, 10);
  }, [fetchTasks]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "COMPLETED").length;
    const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
    const pending = tasks.filter((t) => t.status === "PENDING").length;
    const overdue = tasks.filter((t) => t.isOverdue).length;
    return { total, completed, inProgress, pending, overdue };
  }, [tasks]);

  const applyFilters = () => {
    const statusValue = status === "ALL" ? undefined : status;
    const priorityValue = priority === "ALL" ? undefined : priority;
    setFilters({
      search: search || undefined,
      status: statusValue as
        | "PENDING"
        | "IN_PROGRESS"
        | "COMPLETED"
        | "CANCELLED"
        | undefined,
      priority: priorityValue as
        | "LOW"
        | "MEDIUM"
        | "HIGH"
        | "URGENT"
        | undefined,
    });
    fetchTasks(1, pagination.limit);
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-muted-foreground">
            Manage task assignment and tracking.
          </p>
        </div>
        <Button onClick={() => openTaskSheet()}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Task
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckSquare className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.completed}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.inProgress}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <TriangleAlert className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.overdue}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search tasks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as StatusFilter)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={priority}
              onValueChange={(v) => setPriority(v as PriorityFilter)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Priorities</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="URGENT">Urgent</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button variant="outline" onClick={applyFilters}>
                Apply
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setSearch("");
                  setStatus("ALL");
                  setPriority("ALL");
                  setFilters({
                    search: undefined,
                    status: undefined,
                    priority: undefined,
                  });
                  fetchTasks(1, pagination.limit);
                }}
              >
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Task List</CardTitle>
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
                    Loading tasks...
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-48">
                <div className="text-center">
                  <p className="text-sm text-red-600 mb-2">
                    Error loading tasks
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">{error}</p>
                  <Button
                    onClick={() =>
                      fetchTasks(pagination.page, pagination.limit)
                    }
                    variant="outline"
                    size="sm"
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-2 pr-4">Title</th>
                      <th className="py-2 pr-4">Assignee</th>
                      <th className="py-2 pr-4">Region / Area</th>
                      <th className="py-2 pr-4">Priority</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Due</th>
                      <th className="py-2 pr-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => (
                      <tr key={task.id} className="border-t">
                        <td className="py-2 pr-4">
                          <div className="font-medium">{task.title}</div>
                          {task.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {task.description}
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          {task.assignee?.name || "-"}
                        </td>
                        <td className="py-2 pr-4">
                          {task.region?.name}
                          {task.area ? ` / ${task.area.name}` : ""}
                        </td>
                        <td className="py-2 pr-4">
                          <Badge
                            variant={
                              task.priority === "HIGH" ||
                              task.priority === "URGENT"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {task.priority}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4">
                          <Badge
                            variant={
                              task.status === "COMPLETED"
                                ? "secondary"
                                : task.status === "IN_PROGRESS"
                                ? "default"
                                : "outline"
                            }
                          >
                            {task.status}
                          </Badge>
                          {task.isOverdue && task.status !== "COMPLETED" && (
                            <Badge variant="destructive" className="ml-2">
                              Overdue
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          {task.dueDate
                            ? new Date(task.dueDate).toLocaleDateString()
                            : "-"}
                        </td>
                        <td className="py-2 pr-0 text-right">
                          {task.status !== "COMPLETED" ? (
                            <div className="flex gap-2 justify-end">
                              {task.status !== "IN_PROGRESS" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    updateStatus(task.id, "IN_PROGRESS")
                                  }
                                >
                                  Start
                                </Button>
                              )}
                              <Button
                                size="sm"
                                onClick={() => completeTask(task.id)}
                              >
                                Complete
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Completed
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ClientOnly>
        </CardContent>
      </Card>

      <TaskFormDynamic />
    </div>
  );
}
