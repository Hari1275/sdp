/**
 * GPS validation utilities for error handling and data validation
 */

import { Coordinate, validateCoordinate, validateCoordinates } from './gps-utils';

export interface SessionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SessionConflict {
  existingSessionId: string;
  conflictType: 'OVERLAP' | 'UNCLOSED_SESSION';
  message: string;
}

/**
 * Validate GPS session data
 * @param sessionData Session data to validate
 * @returns Validation result
 */
export function validateSessionData(sessionData: {
  userId: string;
  checkIn: Date;
  checkOut?: Date;
  startLat?: number;
  startLng?: number;
  endLat?: number;
  endLng?: number;
}): SessionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate user ID
  if (!sessionData.userId || typeof sessionData.userId !== 'string') {
    errors.push('User ID is required and must be a valid string');
  }

  // Validate check-in time
  if (!sessionData.checkIn || !(sessionData.checkIn instanceof Date)) {
    errors.push('Check-in time is required and must be a valid date');
  } else {
    // Check if check-in is in the future
    if (sessionData.checkIn > new Date()) {
      errors.push('Check-in time cannot be in the future');
    }
    
    // Check if check-in is too old (more than 24 hours ago)
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    if (new Date().getTime() - sessionData.checkIn.getTime() > maxAge) {
      warnings.push('Check-in time is more than 24 hours old');
    }
  }

  // Validate check-out time if provided
  if (sessionData.checkOut) {
    if (!(sessionData.checkOut instanceof Date)) {
      errors.push('Check-out time must be a valid date');
    } else if (sessionData.checkIn) {
      // Check-out must be after check-in
      if (sessionData.checkOut <= sessionData.checkIn) {
        errors.push('Check-out time must be after check-in time');
      }
      
      // Check for unreasonably long sessions (more than 24 hours)
      const sessionDuration = sessionData.checkOut.getTime() - sessionData.checkIn.getTime();
      const maxSessionDuration = 24 * 60 * 60 * 1000; // 24 hours
      if (sessionDuration > maxSessionDuration) {
        warnings.push('Session duration exceeds 24 hours');
      }
    }
  }

  // Validate start coordinates if provided
  if (sessionData.startLat !== undefined && sessionData.startLng !== undefined) {
    const startCoord: Coordinate = {
      latitude: sessionData.startLat,
      longitude: sessionData.startLng
    };
    const coordValidation = validateCoordinate(startCoord);
    if (!coordValidation.isValid) {
      errors.push(`Start coordinates invalid: ${coordValidation.errors.join(', ')}`);
    }
  }

  // Validate end coordinates if provided
  if (sessionData.endLat !== undefined && sessionData.endLng !== undefined) {
    const endCoord: Coordinate = {
      latitude: sessionData.endLat,
      longitude: sessionData.endLng
    };
    const coordValidation = validateCoordinate(endCoord);
    if (!coordValidation.isValid) {
      errors.push(`End coordinates invalid: ${coordValidation.errors.join(', ')}`);
    }
  }

  // Validate coordinate consistency
  if ((sessionData.startLat !== undefined) !== (sessionData.startLng !== undefined)) {
    errors.push('Both start latitude and longitude must be provided together');
  }
  
  if ((sessionData.endLat !== undefined) !== (sessionData.endLng !== undefined)) {
    errors.push('Both end latitude and longitude must be provided together');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate coordinate update data
 * @param coordinateData Coordinate data to validate
 * @returns Validation result
 */
export function validateCoordinateData(coordinateData: {
  sessionId: string;
  coordinates: Array<{
    latitude: number;
    longitude: number;
    timestamp?: Date;
    accuracy?: number;
    speed?: number;
    altitude?: number;
  }>;
}): SessionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate session ID
  if (!coordinateData.sessionId || typeof coordinateData.sessionId !== 'string') {
    errors.push('Session ID is required and must be a valid string');
  }

  // Validate coordinates array
  if (!Array.isArray(coordinateData.coordinates)) {
    errors.push('Coordinates must be an array');
    return { isValid: false, errors, warnings };
  }

  if (coordinateData.coordinates.length === 0) {
    errors.push('Coordinates array cannot be empty');
    return { isValid: false, errors, warnings };
  }

  // Validate individual coordinates
  const coordValidation = validateCoordinates(coordinateData.coordinates.map(coord => ({
    latitude: coord.latitude,
    longitude: coord.longitude,
    accuracy: coord.accuracy,
    speed: coord.speed,
    altitude: coord.altitude,
    timestamp: coord.timestamp
  })));

  if (!coordValidation.isValid) {
    errors.push(...coordValidation.errors);
  }

  // Check for reasonable batch size
  if (coordinateData.coordinates.length > 1000) {
    warnings.push(`Large batch size (${coordinateData.coordinates.length} coordinates) may impact performance`);
  }

  // Check for timestamp ordering
  const coordinatesWithTimestamp = coordinateData.coordinates.filter(coord => coord.timestamp);
  if (coordinatesWithTimestamp.length > 1) {
    for (let i = 1; i < coordinatesWithTimestamp.length; i++) {
      if (coordinatesWithTimestamp[i].timestamp! < coordinatesWithTimestamp[i - 1].timestamp!) {
        warnings.push('Coordinates are not ordered by timestamp');
        break;
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Check for session conflicts
 * @param userId User ID to check
 * @param checkIn Check-in time
 * @param checkOut Check-out time (optional)
 * @param existingSessions Existing sessions for the user
 * @returns Array of conflicts
 */
export function checkSessionConflicts(
  userId: string,
  checkIn: Date,
  checkOut: Date | undefined,
  existingSessions: Array<{
    id: string;
    checkIn: Date;
    checkOut: Date | null;
  }>
): SessionConflict[] {
  const conflicts: SessionConflict[] = [];

  for (const session of existingSessions) {
    // Check for unclosed sessions
    if (!session.checkOut) {
      conflicts.push({
        existingSessionId: session.id,
        conflictType: 'UNCLOSED_SESSION',
        message: `User has an unclosed session from ${session.checkIn.toISOString()}`
      });
    }

    // Check for overlapping sessions
    if (session.checkOut) {
      const sessionStart = session.checkIn;
      const sessionEnd = session.checkOut;
      const newStart = checkIn;
      const newEnd = checkOut || new Date();

      // Check if new session overlaps with existing session
      if (newStart < sessionEnd && newEnd > sessionStart) {
        conflicts.push({
          existingSessionId: session.id,
          conflictType: 'OVERLAP',
          message: `Session overlaps with existing session (${sessionStart.toISOString()} - ${sessionEnd.toISOString()})`
        });
      }
    }
  }

  return conflicts;
}

/**
 * Validate GPS error data for logging
 * @param errorData Error data to validate
 * @returns Validation result
 */
export function validateGPSErrorData(errorData: {
  sessionId?: string;
  userId: string;
  errorType: string;
  errorMessage: string;
  errorData?: any;
  timestamp?: Date;
}): SessionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate required fields
  if (!errorData.userId || typeof errorData.userId !== 'string') {
    errors.push('User ID is required and must be a valid string');
  }

  if (!errorData.errorType || typeof errorData.errorType !== 'string') {
    errors.push('Error type is required and must be a valid string');
  }

  if (!errorData.errorMessage || typeof errorData.errorMessage !== 'string') {
    errors.push('Error message is required and must be a valid string');
  }

  // Validate optional session ID
  if (errorData.sessionId && typeof errorData.sessionId !== 'string') {
    errors.push('Session ID must be a valid string if provided');
  }

  // Validate timestamp
  if (errorData.timestamp && !(errorData.timestamp instanceof Date)) {
    errors.push('Timestamp must be a valid date if provided');
  }

  // Check error message length
  if (errorData.errorMessage && errorData.errorMessage.length > 1000) {
    warnings.push('Error message is very long (>1000 characters)');
  }

  // Check error data size
  if (errorData.errorData) {
    try {
      const serialized = JSON.stringify(errorData.errorData);
      if (serialized.length > 10000) {
        warnings.push('Error data is very large (>10KB)');
      }
    } catch (e) {
      errors.push('Error data is not serializable');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate analytics query parameters
 * @param queryData Query parameters to validate
 * @returns Validation result
 */
export function validateAnalyticsQuery(queryData: {
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  region?: string;
  period?: 'daily' | 'weekly' | 'monthly';
}): SessionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate date range
  if (queryData.dateFrom && queryData.dateTo) {
    if (queryData.dateFrom > queryData.dateTo) {
      errors.push('dateFrom must be before dateTo');
    }

    // Check for reasonable date range
    const daysDiff = Math.ceil((queryData.dateTo.getTime() - queryData.dateFrom.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff > 365) {
      warnings.push('Date range exceeds 1 year, query may be slow');
    }

    if (daysDiff < 0) {
      errors.push('Invalid date range');
    }
  }

  // Validate user ID
  if (queryData.userId && typeof queryData.userId !== 'string') {
    errors.push('User ID must be a valid string');
  }

  // Validate region
  if (queryData.region && typeof queryData.region !== 'string') {
    errors.push('Region must be a valid string');
  }

  // Validate period
  if (queryData.period && !['daily', 'weekly', 'monthly'].includes(queryData.period)) {
    errors.push('Period must be one of: daily, weekly, monthly');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Sanitize GPS coordinate data
 * @param coordinate Raw coordinate data
 * @returns Sanitized coordinate
 */
export function sanitizeCoordinate(coordinate: any): Coordinate | null {
  try {
    const sanitized: Coordinate = {
      latitude: parseFloat(coordinate.latitude || coordinate.lat),
      longitude: parseFloat(coordinate.longitude || coordinate.lng || coordinate.lon)
    };

    // Add optional fields
    if (coordinate.accuracy !== undefined) {
      sanitized.accuracy = parseFloat(coordinate.accuracy);
    }
    
    if (coordinate.speed !== undefined) {
      sanitized.speed = parseFloat(coordinate.speed);
    }
    
    if (coordinate.altitude !== undefined) {
      sanitized.altitude = parseFloat(coordinate.altitude);
    }
    
    if (coordinate.timestamp) {
      sanitized.timestamp = new Date(coordinate.timestamp);
    }

    // Validate the sanitized coordinate
    const validation = validateCoordinate(sanitized);
    return validation.isValid ? sanitized : null;
    
  } catch (error) {
    return null;
  }
}
