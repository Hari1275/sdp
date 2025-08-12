"use client";

import React from "react";
import { Task } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface TaskDetailsModalProps {
  task: (Task & { isOverdue?: boolean }) | null;
  open: boolean;
  onClose: () => void;
}

export function TaskDetailsModal({ task, open, onClose }: TaskDetailsModalProps) {
  if (!task) return null;

  const infoRow = (label: string, value?: React.ReactNode) => (
    <div className="flex items-start justify-between py-2">
      <div className="text-sm text-muted-foreground pr-4 min-w-[140px]">{label}</div>
      <div className="text-sm flex-1 text-right">{value ?? "-"}</div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span className="truncate">{task.title}</span>
            <div className="flex items-center gap-2">
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
              <Badge variant={
                task.priority === "HIGH" || task.priority === "URGENT" ? "destructive" : "secondary"
              }>
                {task.priority}
              </Badge>
            </div>
          </DialogTitle>
          <DialogDescription className="truncate">
            {task.description || "No description"}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 divide-y">
          {infoRow("Assignee", task.assignee?.name)}
          {infoRow(
            "Region / Area",
            <span>
              {task.region?.name || "-"}
              {task.area ? ` / ${task.area.name}` : ""}
            </span>
          )}
          {infoRow("Due Date", task.dueDate ? new Date(task.dueDate).toLocaleString() : "-")}
          {infoRow("Created By", task.createdBy?.name)}
          {infoRow("Created At", new Date(task.createdAt).toLocaleString())}
          {infoRow("Updated At", new Date(task.updatedAt).toLocaleString())}
          {task.isOverdue && task.status !== "COMPLETED" && infoRow("Overdue", <Badge variant="destructive">Overdue</Badge>)}
        </div>
      </DialogContent>
    </Dialog>
  );
}



