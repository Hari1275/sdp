"use client";

import { format } from "date-fns";

// Client-safe date formatter to avoid hydration mismatches
export const formatDateSafe = (date: Date | string | number, formatStr: string = 'MMM dd, yyyy'): string => {
  if (typeof window === 'undefined') {
    // Server-side: return a consistent format
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
  }
  
  // Client-side: use date-fns for better formatting
  try {
    return format(new Date(date), formatStr);
  } catch {
    // Fallback to basic formatting if date-fns fails
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
  }
};
