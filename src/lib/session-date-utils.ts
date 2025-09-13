/**
 * Utility functions for consistent session date-time formatting
 */

/**
 * Formats a date for session display with date and time in 12-hour format
 * @param date - The date to format
 * @param options - Optional formatting options
 * @returns Formatted date string
 */
export function formatSessionDateTime(
  date: Date | string, 
  options: {
    includeDate?: boolean;
    includeTime?: boolean;
    dateFormat?: 'short' | 'medium' | 'long';
    separator?: string;
  } = {}
): string {
  const {
    includeDate = true,
    includeTime = true,
    dateFormat = 'short',
    separator = ' at '
  } = options;
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }

  const parts: string[] = [];

  if (includeDate) {
    const dateStr = dateObj.toLocaleDateString('en-US', {
      month: dateFormat === 'long' ? 'long' : dateFormat === 'medium' ? 'short' : 'numeric',
      day: 'numeric',
      year: dateFormat === 'short' ? '2-digit' : 'numeric'
    });
    parts.push(dateStr);
  }

  if (includeTime) {
    const timeStr = dateObj.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    parts.push(timeStr);
  }

  return parts.join(separator);
}

/**
 * Formats a date for session display (date only)
 */
export function formatSessionDate(date: Date | string): string {
  return formatSessionDateTime(date, { includeTime: false });
}

/**
 * Formats a time for session display (time only in 12-hour format)
 */
export function formatSessionTime(date: Date | string): string {
  return formatSessionDateTime(date, { includeDate: false });
}

/**
 * Formats a session duration for display
 */
export function formatSessionDuration(checkIn: Date | string, checkOut?: Date | string | null): string {
  const startDate = typeof checkIn === 'string' ? new Date(checkIn) : checkIn;
  const endDate = checkOut ? (typeof checkOut === 'string' ? new Date(checkOut) : checkOut) : new Date();
  
  const durationMs = endDate.getTime() - startDate.getTime();
  const durationMinutes = Math.floor(durationMs / (1000 * 60));
  
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Formats check-in and check-out times for display
 */
export function formatSessionTimeRange(checkIn: Date | string, checkOut?: Date | string | null): string {
  const checkInTime = formatSessionTime(checkIn);
  
  if (!checkOut) {
    return `${checkInTime} - Active`;
  }
  
  const checkOutTime = formatSessionTime(checkOut);
  const checkInDate = typeof checkIn === 'string' ? new Date(checkIn) : checkIn;
  const checkOutDate = typeof checkOut === 'string' ? new Date(checkOut) : checkOut;
  
  // If sessions span multiple days, include date
  const sameDay = checkInDate.toDateString() === checkOutDate.toDateString();
  
  if (sameDay) {
    return `${checkInTime} - ${checkOutTime}`;
  } else {
    return `${formatSessionDateTime(checkIn)} - ${formatSessionDateTime(checkOut)}`;
  }
}