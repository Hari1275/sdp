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
import { apiGet } from "@/lib/api-client";
import { TaskDetailsModal } from "./task-details-modal";
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    completeTask,
    openTaskSheet,
    deleteTask,
  } = useTaskStore();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [priority, setPriority] = useState<PriorityFilter>("ALL");
  const [assignee, setAssignee] = useState<string>("ALL");
  const [mrOptions, setMrOptions] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("ALL");
  const setTodayDone = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    setFilters({
      status: "COMPLETED",
      completedFrom: start.toISOString(),
      completedTo: end.toISOString(),
    });
    fetchTasks(1, pagination.limit);
  };
  const [viewTask, setViewTask] = useState<(typeof tasks)[number] | null>(null);

  useEffect(() => {
    fetchTasks(1, 10);
  }, [fetchTasks]);

  useEffect(() => {
    const loadMRs = async () => {
      const users = await apiGet<{ id: string; name: string }>(
        "/api/users?role=MR&assignable=true&limit=100"
      );
      setMrOptions(users);
    };
    loadMRs();
  }, []);

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
    const assigneeValue = assignee === "ALL" ? undefined : assignee;
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
      assigneeId: assigneeValue,
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="relative w-full h-10">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
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
              <SelectTrigger className="w-full">
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
              <SelectTrigger className="w-full">
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
            <Select value={assignee} onValueChange={(v) => setAssignee(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All MRs</SelectItem>
                {mrOptions.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedMonth}
              onValueChange={(v) => {
                setSelectedMonth(v);
                if (v === "ALL") {
                  setFilters({ dueDateFrom: undefined, dueDateTo: undefined });
                  return;
                }
                const monthIndex = parseInt(v, 10);
                if (Number.isNaN(monthIndex)) {
                  setFilters({ dueDateFrom: undefined, dueDateTo: undefined });
                  return;
                }
                const now = new Date();
                const year = now.getFullYear();
                const start = new Date(year, monthIndex, 1);
                const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
                setFilters({
                  dueDateFrom: start.toISOString(),
                  dueDateTo: end.toISOString(),
                });
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Months</SelectItem>
                <SelectItem value="0">Jan</SelectItem>
                <SelectItem value="1">Feb</SelectItem>
                <SelectItem value="2">Mar</SelectItem>
                <SelectItem value="3">Apr</SelectItem>
                <SelectItem value="4">May</SelectItem>
                <SelectItem value="5">Jun</SelectItem>
                <SelectItem value="6">Jul</SelectItem>
                <SelectItem value="7">Aug</SelectItem>
                <SelectItem value="8">Sep</SelectItem>
                <SelectItem value="9">Oct</SelectItem>
                <SelectItem value="10">Nov</SelectItem>
                <SelectItem value="11">Dec</SelectItem>
              </SelectContent>
            </Select>

            <div className="col-span-1 sm:col-span-2 lg:col-span-2 grid grid-cols-2 sm:flex sm:flex-row gap-2 sm:items-center sm:justify-end">
              <Button
                className="w-full sm:w-auto"
                size="sm"
                variant="outline"
                onClick={applyFilters}
              >
                Apply
              </Button>
              <Button
                className="w-full sm:w-auto"
                size="sm"
                variant="secondary"
                onClick={setTodayDone}
              >
                Today Done
              </Button>
              <Button
                className="w-full sm:w-auto"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSearch("");
                  setStatus("ALL");
                  setPriority("ALL");
                  setAssignee("ALL");
                  setFilters({
                    search: undefined,
                    status: undefined,
                    priority: undefined,
                    assigneeId: undefined,
                    completedFrom: undefined,
                    completedTo: undefined,
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
                      <th className="py-2 pr-4 whitespace-nowrap">Title</th>
                      <th className="py-2 pr-4 whitespace-nowrap">Assignee</th>
                      <th className="py-2 pr-4 whitespace-nowrap hidden sm:table-cell">
                        Region / Area
                      </th>
                      <th className="py-2 pr-4 whitespace-nowrap">Priority</th>
                      <th className="py-2 pr-4 whitespace-nowrap">Status</th>
                      <th className="py-2 pr-4 whitespace-nowrap hidden sm:table-cell">
                        Due
                      </th>
                      <th className="py-2 pr-4 text-right whitespace-nowrap">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => (
                      <tr key={task.id} className="border-t">
                        <td className="py-2 pr-4 align-top">
                          <div className="font-medium">{task.title}</div>
                          {task.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {task.description}
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-4 align-top whitespace-nowrap">
                          {task.assignee?.name || "-"}
                        </td>
                        <td className="py-2 pr-4 align-top hidden sm:table-cell whitespace-nowrap">
                          {task.region?.name}
                          {task.area ? ` / ${task.area.name}` : ""}
                        </td>
                        <td className="py-2 pr-4 align-top">
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
                        <td className="py-2 pr-4 align-top">
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
                        <td className="py-2 pr-4 align-top hidden sm:table-cell whitespace-nowrap">
                          {task.dueDate
                            ? new Date(task.dueDate).toLocaleDateString()
                            : "-"}
                        </td>
                        <td className="py-2 pr-0 text-right">
                          <div className="flex gap-2 justify-end flex-wrap sm:flex-nowrap">
                            {/* View details: always available */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 p-0"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem
                                  onClick={() => setViewTask(task)}
                                >
                                  <Eye className="mr-2 h-4 w-4" /> View Details
                                </DropdownMenuItem>
                                {task.status === "PENDING" && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => openTaskSheet(task)}
                                    >
                                      <Pencil className="mr-2 h-4 w-4" /> Edit
                                      Task
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-red-600"
                                      onClick={async () => {
                                        if (confirm("Delete this task?")) {
                                          await deleteTask(task.id);
                                        }
                                      }}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                                      Task
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            {/* Allow Start/Complete when not completed */}
                            {task.status !== "COMPLETED" && (
                              <Button
                                size="sm"
                                onClick={() => completeTask(task.id)}
                              >
                                Complete
                              </Button>
                            )}
                            {/* Start/Complete buttons remain outside the menu for quick actions */}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Pagination controls */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium">Rows per page</p>
                    <Select
                      value={`${pagination.limit}`}
                      onValueChange={(v) => fetchTasks(1, Number(v))}
                    >
                      <SelectTrigger className="h-8 w-[80px]">
                        <SelectValue placeholder={pagination.limit} />
                      </SelectTrigger>
                      <SelectContent side="top">
                        {[5, 10, 20, 30, 40, 50].map((size) => (
                          <SelectItem key={size} value={`${size}`}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-6 lg:space-x-8">
                    <div className="flex w-[120px] items-center justify-center text-sm font-medium">
                      Page {pagination.page} of{" "}
                      {Math.max(1, pagination.totalPages || 1)}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() =>
                          fetchTasks(
                            Math.max(1, pagination.page - 1),
                            pagination.limit
                          )
                        }
                        disabled={pagination.page <= 1}
                      >
                        <span className="sr-only">Go to previous page</span>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        className="h-8 w-8 p-0"
                        onClick={() =>
                          fetchTasks(pagination.page + 1, pagination.limit)
                        }
                        disabled={pagination.page >= pagination.totalPages}
                      >
                        <span className="sr-only">Go to next page</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </ClientOnly>
        </CardContent>
      </Card>

      <TaskFormDynamic />
      <TaskDetailsModal
        task={viewTask}
        open={!!viewTask}
        onClose={() => setViewTask(null)}
      />
    </div>
  );
}
