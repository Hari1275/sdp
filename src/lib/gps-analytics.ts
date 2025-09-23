/**
 * GPS analytics utilities for performance metrics and reporting
 */

import { calculateTotalDistance } from './gps-utils';

// GPS analytics utilities - distance calculations are handled in gps-utils

export interface GPSPerformanceMetrics {
  totalKm: number;
  totalSessions: number;
  avgSessionDuration: number; // in hours
  avgSpeed: number; // km/h
  maxSpeed: number; // km/h
  efficiency: number; // km per hour
  activeHours: number;
}

export interface DailyGPSStats {
  date: string;
  totalKm: number;
  sessions: number;
  avgSpeed: number;
  efficiency: number;
  activeHours: number;
  checkInCount: number;
}

export interface WeeklyGPSStats {
  weekStart: string;
  weekEnd: string;
  dailyStats: DailyGPSStats[];
  totalKm: number;
  avgEfficiency: number;
  totalSessions: number;
  totalActiveHours: number;
}

export interface MonthlyGPSStats {
  month: number;
  year: number;
  weeklyStats: WeeklyGPSStats[];
  totalKm: number;
  avgEfficiency: number;
  totalSessions: number;
  totalActiveHours: number;
  peakWeek: {
    weekStart: string;
    totalKm: number;
  };
}

export interface SessionSummary {
  sessionId: string;
  userId: string;
  date: string;
  checkIn: Date;
  checkOut: Date | null;
  duration: number; // in hours
  totalKm: number;
  avgSpeed: number;
  maxSpeed: number;
  coordinateCount: number;
  startLocation: {
    latitude: number;
    longitude: number;
  } | null;
  endLocation: {
    latitude: number;
    longitude: number;
  } | null;
}

/**
 * Calculate GPS performance metrics from session data
 */
export function calculateGPSPerformanceMetrics(
  sessions: Array<{
    id: string;
    checkIn: Date;
    checkOut: Date | null;
    totalKm: number;
    gpsLogs: Array<{
      latitude: number;
      longitude: number;
      timestamp: Date;
      speed: number | null;
    }>;
  }>
): GPSPerformanceMetrics {
  if (sessions.length === 0) {
    return {
      totalKm: 0,
      totalSessions: 0,
      avgSessionDuration: 0,
      avgSpeed: 0,
      maxSpeed: 0,
      efficiency: 0,
      activeHours: 0
    };
  }

  let totalKm = 0;
  let totalDuration = 0; // in milliseconds
  let totalSpeeds = 0;
  let speedCount = 0;
  let maxSpeed = 0;
  let totalActiveTime = 0;

  for (const session of sessions) {
    // Calculate total distance from GPS logs if available, fallback to stored value
    const sessionDistance = session.gpsLogs && session.gpsLogs.length > 1
      ? calculateTotalDistance(session.gpsLogs.map(l => ({ latitude: l.latitude, longitude: l.longitude })))
      : session.totalKm || 0;
    totalKm += sessionDistance;

    // Calculate session duration
    if (session.checkOut) {
      const duration = session.checkOut.getTime() - session.checkIn.getTime();
      totalDuration += duration;
      totalActiveTime += duration;
    }

    // Calculate speed metrics from GPS logs
    for (const log of session.gpsLogs) {
      if (log.speed && log.speed > 0) {
        totalSpeeds += log.speed;
        speedCount++;
        maxSpeed = Math.max(maxSpeed, log.speed);
      }
    }
  }

  const activeHours = totalActiveTime / (1000 * 60 * 60);
  const avgSessionDuration = totalDuration / (1000 * 60 * 60) / sessions.length;
  const avgSpeed = speedCount > 0 ? totalSpeeds / speedCount : 0;
  const efficiency = activeHours > 0 ? totalKm / activeHours : 0;

  return {
    totalKm: Math.round(totalKm * 1000) / 1000,
    totalSessions: sessions.length,
    avgSessionDuration: Math.round(avgSessionDuration * 100) / 100,
    avgSpeed: Math.round(avgSpeed * 100) / 100,
    maxSpeed: Math.round(maxSpeed * 100) / 100,
    efficiency: Math.round(efficiency * 100) / 100,
    activeHours: Math.round(activeHours * 100) / 100
  };
}

/**
 * Calculate daily GPS statistics
 */
export function calculateDailyGPSStats(
  sessions: Array<{
    id: string;
    checkIn: Date;
    checkOut: Date | null;
    totalKm: number;
    gpsLogs: Array<{
      latitude: number;
      longitude: number;
      timestamp: Date;
      speed: number | null;
    }>;
  }>,
  date: Date
): DailyGPSStats {
  // Filter sessions for the specific date
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const daySessions = sessions.filter(session => 
    session.checkIn >= dayStart && session.checkIn <= dayEnd
  );

  const metrics = calculateGPSPerformanceMetrics(daySessions);

  return {
    date: date.toISOString().split('T')[0],
    totalKm: metrics.totalKm,
    sessions: metrics.totalSessions,
    avgSpeed: metrics.avgSpeed,
    efficiency: metrics.efficiency,
    activeHours: metrics.activeHours,
    checkInCount: daySessions.length
  };
}

/**
 * Calculate weekly GPS statistics
 */
export function calculateWeeklyGPSStats(
  sessions: Array<{
    id: string;
    checkIn: Date;
    checkOut: Date | null;
    totalKm: number;
    gpsLogs: Array<{
      latitude: number;
      longitude: number;
      timestamp: Date;
      speed: number | null;
    }>;
  }>,
  weekStart: Date
): WeeklyGPSStats {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const dailyStats: DailyGPSStats[] = [];
  let totalKm = 0;
  let totalSessions = 0;
  let totalActiveHours = 0;
  let totalEfficiency = 0;
  let validDays = 0;

  // Calculate daily stats for each day of the week
  for (let i = 0; i < 7; i++) {
    const currentDate = new Date(weekStart);
    currentDate.setDate(currentDate.getDate() + i);
    
    const dayStats = calculateDailyGPSStats(sessions, currentDate);
    dailyStats.push(dayStats);
    
    totalKm += dayStats.totalKm;
    totalSessions += dayStats.sessions;
    totalActiveHours += dayStats.activeHours;
    
    if (dayStats.activeHours > 0) {
      totalEfficiency += dayStats.efficiency;
      validDays++;
    }
  }

  const avgEfficiency = validDays > 0 ? totalEfficiency / validDays : 0;

  return {
    weekStart: weekStart.toISOString().split('T')[0],
    weekEnd: weekEnd.toISOString().split('T')[0],
    dailyStats,
    totalKm: Math.round(totalKm * 1000) / 1000,
    avgEfficiency: Math.round(avgEfficiency * 100) / 100,
    totalSessions,
    totalActiveHours: Math.round(totalActiveHours * 100) / 100
  };
}

/**
 * Calculate monthly GPS statistics
 */
export function calculateMonthlyGPSStats(
  sessions: Array<{
    id: string;
    checkIn: Date;
    checkOut: Date | null;
    totalKm: number;
    gpsLogs: Array<{
      latitude: number;
      longitude: number;
      timestamp: Date;
      speed: number | null;
    }>;
  }>,
  month: number,
  year: number
): MonthlyGPSStats {
  // Get all weeks in the month
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  
  const weeklyStats: WeeklyGPSStats[] = [];
  let totalKm = 0;
  let totalSessions = 0;
  let totalActiveHours = 0;
  let totalEfficiency = 0;
  let validWeeks = 0;
  let peakWeek = { weekStart: '', totalKm: 0 };

  // Calculate weekly stats for each week in the month
  const current = new Date(monthStart);
  
  // Start from the first Monday of the month or before
  while (current.getDay() !== 1 && current >= monthStart) {
    current.setDate(current.getDate() - 1);
  }

  while (current <= monthEnd) {
    const weekStats = calculateWeeklyGPSStats(sessions, new Date(current));
    
    // Only include weeks that overlap with the target month
    const weekStartMonth = new Date(weekStats.weekStart).getMonth();
    const weekEndMonth = new Date(weekStats.weekEnd).getMonth();
    
    if (weekStartMonth === month - 1 || weekEndMonth === month - 1) {
      weeklyStats.push(weekStats);
      totalKm += weekStats.totalKm;
      totalSessions += weekStats.totalSessions;
      totalActiveHours += weekStats.totalActiveHours;
      
      if (weekStats.totalActiveHours > 0) {
        totalEfficiency += weekStats.avgEfficiency;
        validWeeks++;
      }
      
      // Track peak week
      if (weekStats.totalKm > peakWeek.totalKm) {
        peakWeek = {
          weekStart: weekStats.weekStart,
          totalKm: weekStats.totalKm
        };
      }
    }

    current.setDate(current.getDate() + 7);
  }

  const avgEfficiency = validWeeks > 0 ? totalEfficiency / validWeeks : 0;

  return {
    month,
    year,
    weeklyStats,
    totalKm: Math.round(totalKm * 1000) / 1000,
    avgEfficiency: Math.round(avgEfficiency * 100) / 100,
    totalSessions,
    totalActiveHours: Math.round(totalActiveHours * 100) / 100,
    peakWeek
  };
}

/**
 * Generate session summary
 */
export function generateSessionSummary(session: {
  id: string;
  userId: string;
  checkIn: Date;
  checkOut: Date | null;
  totalKm: number;
  startLat: number | null;
  startLng: number | null;
  endLat: number | null;
  endLng: number | null;
  gpsLogs: Array<{
    latitude: number;
    longitude: number;
    timestamp: Date;
    speed: number | null;
  }>;
}): SessionSummary {
  const duration = session.checkOut ? 
    (session.checkOut.getTime() - session.checkIn.getTime()) / (1000 * 60 * 60) : 0;

  // Calculate speed metrics
  const speeds = session.gpsLogs
    .map(log => log.speed)
    .filter((speed): speed is number => speed !== null && speed > 0);
  
  const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
  const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;

  // Use stored totalKm from recalculation; only compute if not available
  const computedKm = session.totalKm || (session.gpsLogs && session.gpsLogs.length > 1
    ? calculateTotalDistance(session.gpsLogs.map(l => ({ latitude: l.latitude, longitude: l.longitude })))
    : 0);

  return {
    sessionId: session.id,
    userId: session.userId,
    date: session.checkIn.toISOString().split('T')[0],
    checkIn: session.checkIn,
    checkOut: session.checkOut,
    // Duration must be strictly check-in to check-out
    duration: Math.round(duration * 100) / 100,
    totalKm: Math.round(computedKm * 1000) / 1000,
    avgSpeed: Math.round(avgSpeed * 100) / 100,
    maxSpeed: Math.round(maxSpeed * 100) / 100,
    coordinateCount: session.gpsLogs.length,
    startLocation: session.startLat && session.startLng ? {
      latitude: session.startLat,
      longitude: session.startLng
    } : null,
    endLocation: session.endLat && session.endLng ? {
      latitude: session.endLat,
      longitude: session.endLng
    } : null
  };
}

/**
 * Calculate distance efficiency score
 * Based on total distance, time spent, and route optimization
 */
export function calculateEfficiencyScore(
  totalKm: number,
  activeHours: number,
  plannedRouteKm?: number,
  visitCount?: number
): {
  score: number; // 0-100
  factors: {
    speedEfficiency: number;
    routeOptimization: number;
    productivity: number;
  };
} {
  // Speed efficiency (0-40 points)
  const idealSpeedKmh = 25; // Ideal average speed including stops
  const actualSpeedKmh = activeHours > 0 ? totalKm / activeHours : 0;
  const speedRatio = Math.min(actualSpeedKmh / idealSpeedKmh, 1);
  const speedEfficiency = Math.round(speedRatio * 40);

  // Route optimization (0-30 points)
  let routeOptimization = 30; // Default full points if no planned route
  if (plannedRouteKm && plannedRouteKm > 0) {
    const routeEfficiency = Math.min(plannedRouteKm / totalKm, 1);
    routeOptimization = Math.round(routeEfficiency * 30);
  }

  // Productivity (0-30 points)  
  let productivity = 30; // Default full points if no visit data
  if (visitCount && activeHours > 0) {
    const visitsPerHour = visitCount / activeHours;
    const idealVisitsPerHour = 2; // 2 visits per hour is ideal
    const productivityRatio = Math.min(visitsPerHour / idealVisitsPerHour, 1);
    productivity = Math.round(productivityRatio * 30);
  }

  const totalScore = speedEfficiency + routeOptimization + productivity;

  return {
    score: Math.min(totalScore, 100),
    factors: {
      speedEfficiency,
      routeOptimization,
      productivity
    }
  };
}

/**
 * Calculate GPS data quality metrics
 */
export function calculateDataQualityMetrics(
  gpsLogs: Array<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
    timestamp: Date;
  }>
): {
  accuracy: {
    avgAccuracy: number;
    maxAccuracy: number;
    goodReadings: number; // readings with accuracy <= threshold
    totalReadings: number;
  };
  coverage: {
    timeGaps: number; // number of gaps > 5 minutes
    avgInterval: number; // average time between readings in seconds
    continuity: number; // percentage score 0-100
  };
  quality: {
    overallScore: number; // 0-100
    issues: string[];
  };
} {
  const accuracyThreshold = parseFloat(process.env.GPS_ACCURACY_THRESHOLD || '10');
  
  // Accuracy metrics
  const accuracyValues = gpsLogs
    .map(log => log.accuracy)
    .filter((acc): acc is number => acc !== null);
  
  const avgAccuracy = accuracyValues.length > 0 ? 
    accuracyValues.reduce((a, b) => a + b, 0) / accuracyValues.length : 0;
  
  const maxAccuracy = accuracyValues.length > 0 ? Math.max(...accuracyValues) : 0;
  const goodReadings = accuracyValues.filter(acc => acc <= accuracyThreshold).length;

  // Coverage metrics
  const sortedLogs = [...gpsLogs].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  let timeGaps = 0;
  let totalInterval = 0;
  
  for (let i = 1; i < sortedLogs.length; i++) {
    const interval = (sortedLogs[i].timestamp.getTime() - sortedLogs[i - 1].timestamp.getTime()) / 1000;
    totalInterval += interval;
    
    // Gap > 5 minutes (300 seconds)
    if (interval > 300) {
      timeGaps++;
    }
  }
  
  const avgInterval = sortedLogs.length > 1 ? totalInterval / (sortedLogs.length - 1) : 0;
  const idealInterval = 30; // 30 seconds
  const continuity = Math.max(0, 100 - (timeGaps * 10) - Math.max(0, (avgInterval - idealInterval) / 10));

  // Overall quality score
  const accuracyScore = accuracyValues.length > 0 ? 
    (goodReadings / accuracyValues.length) * 50 : 0;
  const continuityScore = (continuity / 100) * 50;
  const overallScore = Math.round(accuracyScore + continuityScore);

  // Identify issues
  const issues: string[] = [];
  
  if (avgAccuracy > accuracyThreshold * 2) {
    issues.push(`Poor GPS accuracy (avg: ${Math.round(avgAccuracy)}m)`);
  }
  
  if (timeGaps > 5) {
    issues.push(`Multiple GPS signal gaps (${timeGaps} gaps)`);
  }
  
  if (avgInterval > 120) {
    issues.push(`Infrequent GPS readings (avg: ${Math.round(avgInterval)}s apart)`);
  }
  
  if (gpsLogs.length < 10) {
    issues.push('Very few GPS readings recorded');
  }

  return {
    accuracy: {
      avgAccuracy: Math.round(avgAccuracy * 10) / 10,
      maxAccuracy: Math.round(maxAccuracy * 10) / 10,
      goodReadings,
      totalReadings: gpsLogs.length
    },
    coverage: {
      timeGaps,
      avgInterval: Math.round(avgInterval),
      continuity: Math.round(continuity * 10) / 10
    },
    quality: {
      overallScore,
      issues
    }
  };
}
