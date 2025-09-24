"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Calendar, 
  User,
  Download,
  Eye,
  Target,
  TrendingUp
} from "lucide-react";
import { safeApiCall } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Date utility functions
function getDatePreset(preset: string): { from: string; to: string } {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  
  switch (preset) {
    case "today":
      return { from: todayStr, to: todayStr };
    case "thisWeek": {
      const monday = new Date(today);
      monday.setDate(today.getDate() - today.getDay() + 1);
      return { from: monday.toISOString().slice(0, 10), to: todayStr };
    }
    case "thisMonth": {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: firstDay.toISOString().slice(0, 10), to: todayStr };
    }
    case "previousMonth": {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      return {
        from: firstDay.toISOString().slice(0, 10),
        to: lastDay.toISOString().slice(0, 10),
      };
    }
    default:
      return { from: todayStr, to: todayStr };
  }
}

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isOverdue: boolean;
  region: { id: string; name: string } | null;
  area: { id: string; name: string } | null;
  assignee: {
    id: string;
    name: string;
    username: string;
    leadMr: { id: string; name: string } | null;
  } | null;
  createdBy: {
    id: string;
    name: string;
    username: string;
  } | null;
};

function getStatusColor(status: Task['status']) {
  switch (status) {
    case 'COMPLETED':
      return 'bg-green-100 text-green-800';
    case 'PENDING':
      return 'bg-yellow-100 text-yellow-800';
    case 'CANCELLED':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getPriorityColor(priority: Task['priority']) {
  switch (priority) {
    case 'URGENT':
      return 'bg-red-100 text-red-800';
    case 'HIGH':
      return 'bg-orange-100 text-orange-800';
    case 'MEDIUM':
      return 'bg-yellow-100 text-yellow-800';
    case 'LOW':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function TaskDetailsDialog({ 
  task,
}: { 
  task: Task;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Eye className="h-4 w-4 mr-1" />
          View
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Task Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="text-sm text-muted-foreground">Title</div>
            <div className="text-lg font-semibold">{task.title}</div>
          </div>
          
          {task.description && (
            <div>
              <div className="text-sm text-muted-foreground">Description</div>
              <div className="font-medium">{task.description}</div>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Status</div>
              <Badge className={getStatusColor(task.status)}>{task.status}</Badge>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Priority</div>
              <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Region</div>
              <div className="font-medium">{task.region?.name || "Not assigned"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Area</div>
              <div className="font-medium">{task.area?.name || "Not assigned"}</div>
            </div>
          </div>
          
          <div>
            <div className="text-sm text-muted-foreground">Assigned To</div>
            <div className="font-medium">{task.assignee?.name || "Not assigned"}</div>
            {task.assignee?.username && (
              <div className="text-sm text-muted-foreground">@{task.assignee.username}</div>
            )}
          </div>
          
          <div>
            <div className="text-sm text-muted-foreground">Created By</div>
            <div className="font-medium">{task.createdBy?.name || "Unknown"}</div>
            {task.createdBy?.username && (
              <div className="text-sm text-muted-foreground">@{task.createdBy.username}</div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Created</div>
              <div className="text-sm">{new Date(task.createdAt).toLocaleDateString()}</div>
            </div>
            {task.dueDate && (
              <div>
                <div className="text-sm text-muted-foreground">Due Date</div>
                <div className="text-sm">{new Date(task.dueDate).toLocaleDateString()}</div>
              </div>
            )}
          </div>
          
          {task.completedAt && (
            <div>
              <div className="text-sm text-muted-foreground">Completed</div>
              <div className="text-sm">{new Date(task.completedAt).toLocaleDateString()}</div>
            </div>
          )}
          
          {task.isOverdue && (
            <div className="p-2 bg-red-50 border border-red-200 rounded">
              <div className="text-sm text-red-800 font-medium">⚠️ This task is overdue</div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TasksReport() {
  const [selectedPreset, setSelectedPreset] = useState("today");
  const [dateFrom, setDateFrom] = useState(getDatePreset("today").from);
  const [dateTo, setDateTo] = useState(getDatePreset("today").to);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const datePresets = [
    { value: "today", label: "Today" },
    { value: "thisWeek", label: "This Week" },
    { value: "thisMonth", label: "This Month" },
    { value: "previousMonth", label: "Previous Month" },
  ];

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    const dates = getDatePreset(preset);
    setDateFrom(dates.from);
    setDateTo(dates.to);
  };

  const fetchData = async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await safeApiCall<{ data: Task[]; pagination: { page: number; limit: number; total: number } }>(
        `/api/tasks?limit=100`
      );
      
      if (result.success) {
        // Filter tasks by date range locally since the API might not support date filtering
        const allTasks = result.data.data || [];
        const filteredTasks = allTasks.filter(task => {
          const taskDate = new Date(task.createdAt).toISOString().slice(0, 10);
          return taskDate >= from && taskDate <= to;
        });
        setTasks(filteredTasks);
      } else {
        setError(result.error || "Failed to fetch tasks");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    fetchData(dateFrom, dateTo);
  };

  const exportData = async () => {
    try {
      setExporting(true);
      
      // Make sure we have data
      if (tasks.length === 0) {
        alert("No data available for the selected period.");
        return;
      }
      
      const csvData = tasks.map(task => ({
      Title: task.title,
      Description: task.description || "",
      Status: task.status,
      Priority: task.priority,
      "Assigned To": task.assignee?.name || "Not assigned",
      "Assigned Username": task.assignee?.username || "",
      "Created By": task.createdBy?.name || "Unknown",
      Region: task.region?.name || "Not assigned",
      Area: task.area?.name || "Not assigned",
      "Due Date": task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "",
      "Created Date": new Date(task.createdAt).toLocaleDateString(),
      "Completed Date": task.completedAt ? new Date(task.completedAt).toLocaleDateString() : "",
      "Is Overdue": task.isOverdue ? "Yes" : "No",
    }));

    const csv = [
      Object.keys(csvData[0] || {}).join(","),
      ...csvData.map(row => Object.values(row).map(v => `"${v}"`).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tasks-${dateFrom}-to-${dateTo}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    fetchData(dateFrom, dateTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calculate statistics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
  const overdueTasks = tasks.filter(t => t.isOverdue).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Group by status
  const tasksByStatus = tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Group by priority
  const tasksByPriority = tasks.reduce((acc, task) => {
    acc[task.priority] = (acc[task.priority] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Group by assignee
  const tasksByAssignee = tasks.reduce((acc, task) => {
    const assigneeName = task.assignee?.name || "Unassigned";
    if (!acc[assigneeName]) {
      acc[assigneeName] = { total: 0, completed: 0 };
    }
    acc[assigneeName].total++;
    if (task.status === 'COMPLETED') {
      acc[assigneeName].completed++;
    }
    return acc;
  }, {} as Record<string, { total: number; completed: number }>);

  return (
    <div className="space-y-6">
      {/* Date Filter Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Select Date Range
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex flex-wrap gap-2">
              {datePresets.map((preset) => (
                <Button
                  key={preset.value}
                  variant={selectedPreset === preset.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePresetChange(preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            
            <div className="flex gap-2 items-end">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setSelectedPreset("");
                  }}
                  className="px-3 py-2 border border-input bg-background text-sm rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setSelectedPreset("");
                  }}
                  className="px-3 py-2 border border-input bg-background text-sm rounded-md"
                />
              </div>
              <Button onClick={handleApply} disabled={loading}>
                Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center">
              <Target className="h-4 w-4 text-blue-600 mr-2" />
              <div>
                <div className="text-2xl font-bold">{totalTasks}</div>
                <div className="text-xs text-muted-foreground">Total Tasks</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center">
              <CheckCircle2 className="h-4 w-4 text-green-600 mr-2" />
              <div>
                <div className="text-2xl font-bold">{completedTasks}</div>
                <div className="text-xs text-muted-foreground">Completed</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center">
              <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />
              <div>
                <div className="text-2xl font-bold">{overdueTasks}</div>
                <div className="text-xs text-muted-foreground">Overdue</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center">
              <TrendingUp className="h-4 w-4 text-purple-600 mr-2" />
              <div>
                <div className="text-2xl font-bold">{completionRate}%</div>
                <div className="text-xs text-muted-foreground">Completion Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Task Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(tasksByStatus).map(([status, count]) => (
              <div key={status} className="p-4 border rounded-lg text-center">
                <div className="font-semibold text-lg">{count}</div>
                <Badge className={getStatusColor(status as Task['status'])}>{status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Priority Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Task Priority Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(tasksByPriority).map(([priority, count]) => (
              <div key={priority} className="p-4 border rounded-lg text-center">
                <div className="font-semibold text-lg">{count}</div>
                <Badge className={getPriorityColor(priority as Task['priority'])}>{priority}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Assignee Performance */}
      {Object.keys(tasksByAssignee).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Assignee Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(tasksByAssignee).map(([assignee, data]) => {
                const completionRate = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
                return (
                  <div key={assignee} className="flex justify-between items-center p-3 border rounded">
                    <div>
                      <div className="font-medium">{assignee}</div>
                      <div className="text-sm text-muted-foreground">
                        {data.completed} of {data.total} completed
                      </div>
                    </div>
                    <Badge 
                      variant={completionRate >= 80 ? "default" : "secondary"}
                      className={completionRate >= 80 ? "bg-green-100 text-green-800" : ""}
                    >
                      {completionRate}%
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tasks List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Tasks</CardTitle>
          <Button 
            variant="outline" 
            onClick={exportData} 
            disabled={tasks.length === 0 || exporting}
          >
            {exporting ? (
              <>
                <span className="inline-block animate-spin mr-2">⟳</span>
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading tasks...</div>
          ) : error ? (
            <div className="text-red-600 text-center py-8">{error}</div>
          ) : tasks.length === 0 ? (
            <div className="text-muted-foreground text-center py-8">
              No tasks found for the selected period.
            </div>
          ) : (
            <div className="space-y-4">
              {tasks.map((task) => (
                <Card key={task.id} className={`border-l-4 ${
                  task.status === 'COMPLETED' ? 'border-l-green-500' :
                  task.isOverdue ? 'border-l-red-500' :
                  task.status === 'PENDING' ? 'border-l-yellow-500' :
                  'border-l-gray-400'
                }`}>
                  <CardContent className="pt-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div>
                            <h3 className="font-semibold text-lg">{task.title}</h3>
                            <div className="text-sm text-muted-foreground">
                              {task.description && task.description.length > 100 
                                ? `${task.description.substring(0, 100)}...` 
                                : task.description}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Badge className={getStatusColor(task.status)}>{task.status}</Badge>
                            <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div className="flex items-center">
                            <User className="h-4 w-4 text-purple-600 mr-2" />
                            <div>
                              <div className="font-semibold">{task.assignee?.name || "Unassigned"}</div>
                              <div className="text-muted-foreground">Assignee</div>
                            </div>
                          </div>
                          
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 text-blue-600 mr-2" />
                            <div>
                              <div className="font-semibold">
                                {new Date(task.createdAt).toLocaleDateString()}
                              </div>
                              <div className="text-muted-foreground">Created</div>
                            </div>
                          </div>
                          
                          {task.dueDate && (
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 text-orange-600 mr-2" />
                              <div>
                                <div className="font-semibold">
                                  {new Date(task.dueDate).toLocaleDateString()}
                                </div>
                                <div className="text-muted-foreground">Due Date</div>
                              </div>
                            </div>
                          )}
                          
                          {task.completedAt && (
                            <div className="flex items-center">
                              <CheckCircle2 className="h-4 w-4 text-green-600 mr-2" />
                              <div>
                                <div className="font-semibold">
                                  {new Date(task.completedAt).toLocaleDateString()}
                                </div>
                                <div className="text-muted-foreground">Completed</div>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {task.isOverdue && (
                          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                            ⚠️ This task is overdue
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <TaskDetailsDialog task={task} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}