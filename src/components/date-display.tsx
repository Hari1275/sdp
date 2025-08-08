"use client";

import { formatDateSafe } from "@/lib/date-utils";
import { useEffect, useState } from "react";

interface DateDisplayProps {
  date: Date | string | number;
  format?: string;
  className?: string;
}

export function DateDisplay({ date, format = 'MMM dd, yyyy', className }: DateDisplayProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Server-side safe fallback
    return (
      <span className={className} suppressHydrationWarning>
        {new Date(date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: '2-digit'
        })}
      </span>
    );
  }

  return (
    <span className={className}>
      {formatDateSafe(date, format)}
    </span>
  );
}
