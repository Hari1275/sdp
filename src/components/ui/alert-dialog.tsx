"use client";

import * as React from "react";

export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative bg-white rounded-md shadow-lg w-[90%] max-w-md p-4">
        {title && <div className="text-lg font-semibold mb-1">{title}</div>}
        {description && (
          <div className="text-sm text-muted-foreground mb-3">
            {description}
          </div>
        )}
        {children}
        {footer && <div className="mt-4 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
