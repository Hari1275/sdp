/**
 * GPS utility functions for distance calculation and validation
 */

export interface Coordinate {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: Date;
  speed?: number;
  altitude?: number;
}

export interface GPSValidationResult {
  isValid: boolean;
  errors: string[];
}

// Earth's radius in kilometers
const EARTH_RADIUS_KM = 6371;

// GPS accuracy threshold (from env or default 10 meters)
const GPS_ACCURACY_THRESHOLD = parseFloat(process.env.GPS_ACCURACY_THRESHOLD || '10');

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param coord1 First coordinate
 * @param coord2 Second coordinate
 * @returns Distance in kilometers
 */
export function calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
  const lat1Rad = degreesToRadians(coord1.latitude);
  const lat2Rad = degreesToRadians(coord2.latitude);
  const deltaLatRad = degreesToRadians(coord2.latitude - coord1.latitude);
  const deltaLngRad = degreesToRadians(coord2.longitude - coord1.longitude);

  const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
           Math.cos(lat1Rad) * Math.cos(lat2Rad) *
           Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Calculate total distance from array of coordinates
 * @param coordinates Array of coordinates
 * @returns Total distance in kilometers
 */
export function calculateTotalDistance(coordinates: Coordinate[]): number {
  if (coordinates.length < 2) return 0;
  
  let totalDistance = 0;
  for (let i = 1; i < coordinates.length; i++) {
    totalDistance += calculateDistance(coordinates[i - 1], coordinates[i]);
  }
  
  return totalDistance;
}

/**
 * Validate GPS coordinates
 * @param coordinate Coordinate to validate
 * @returns Validation result
 */
export function validateCoordinate(coordinate: Coordinate): GPSValidationResult {
  const errors: string[] = [];

  // Validate latitude range (-90 to 90)
  if (coordinate.latitude < -90 || coordinate.latitude > 90) {
    errors.push('Latitude must be between -90 and 90 degrees');
  }

  // Validate longitude range (-180 to 180)
  if (coordinate.longitude < -180 || coordinate.longitude > 180) {
    errors.push('Longitude must be between -180 and 180 degrees');
  }

  // Validate accuracy if provided
  if (coordinate.accuracy !== undefined && coordinate.accuracy > GPS_ACCURACY_THRESHOLD) {
    errors.push(`GPS accuracy (${coordinate.accuracy}m) exceeds threshold (${GPS_ACCURACY_THRESHOLD}m)`);
  }

  // Validate speed if provided (reasonable range: 0-200 km/h)
  if (coordinate.speed !== undefined && (coordinate.speed < 0 || coordinate.speed > 200)) {
    errors.push('Speed must be between 0 and 200 km/h');
  }

  // Validate altitude if provided (reasonable range: -500 to 10000 meters)
  if (coordinate.altitude !== undefined && (coordinate.altitude < -500 || coordinate.altitude > 10000)) {
    errors.push('Altitude must be between -500 and 10000 meters');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate array of coordinates
 * @param coordinates Array of coordinates to validate
 * @returns Validation result
 */
export function validateCoordinates(coordinates: Coordinate[]): GPSValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    errors.push('Coordinates array must not be empty');
    return { isValid: false, errors };
  }

  coordinates.forEach((coord, index) => {
    const validation = validateCoordinate(coord);
    if (!validation.isValid) {
      errors.push(`Coordinate ${index}: ${validation.errors.join(', ')}`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Filter coordinates by accuracy threshold
 * @param coordinates Array of coordinates
 * @returns Filtered coordinates with acceptable accuracy
 */
export function filterByAccuracy(coordinates: Coordinate[]): Coordinate[] {
  return coordinates.filter(coord => 
    coord.accuracy === undefined || coord.accuracy <= GPS_ACCURACY_THRESHOLD
  );
}

/**
 * Calculate average speed from coordinates
 * @param coordinates Array of coordinates with timestamps
 * @returns Average speed in km/h
 */
export function calculateAverageSpeed(coordinates: Coordinate[]): number {
  if (coordinates.length < 2) return 0;

  const filteredCoords = coordinates.filter(coord => coord.timestamp);
  if (filteredCoords.length < 2) return 0;

  const totalDistance = calculateTotalDistance(filteredCoords);
  const timeSpan = filteredCoords[filteredCoords.length - 1].timestamp!.getTime() - 
                  filteredCoords[0].timestamp!.getTime();
  
  const hours = timeSpan / (1000 * 60 * 60); // Convert milliseconds to hours
  
  return hours > 0 ? totalDistance / hours : 0;
}

/**
 * Convert degrees to radians
 * @param degrees Degrees value
 * @returns Radians value
 */
function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 * @param radians Radians value
 * @returns Degrees value
 */
export function radiansToDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Calculate bearing between two coordinates
 * @param coord1 Start coordinate
 * @param coord2 End coordinate
 * @returns Bearing in degrees (0-360)
 */
export function calculateBearing(coord1: Coordinate, coord2: Coordinate): number {
  const lat1Rad = degreesToRadians(coord1.latitude);
  const lat2Rad = degreesToRadians(coord2.latitude);
  const deltaLngRad = degreesToRadians(coord2.longitude - coord1.longitude);

  const x = Math.sin(deltaLngRad) * Math.cos(lat2Rad);
  const y = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
           Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLngRad);

  const bearingRad = Math.atan2(x, y);
  const bearingDeg = radiansToDegrees(bearingRad);
  
  return (bearingDeg + 360) % 360; // Normalize to 0-360
}

/**
 * Remove duplicate or too-close coordinates
 * @param coordinates Array of coordinates
 * @param minDistance Minimum distance in meters (default: 1m)
 * @returns Filtered coordinates
 */
export function removeDuplicateCoordinates(coordinates: Coordinate[], minDistance = 0.001): Coordinate[] {
  if (coordinates.length <= 1) return coordinates;

  const filtered = [coordinates[0]];
  
  for (let i = 1; i < coordinates.length; i++) {
    const distance = calculateDistance(filtered[filtered.length - 1], coordinates[i]);
    if (distance >= minDistance) {
      filtered.push(coordinates[i]);
    }
  }

  return filtered;
}

/**
 * Compress GPS data for efficient storage
 * @param coordinates Array of coordinates
 * @returns Compressed coordinate data
 */
export interface CompressedGPSData {
  startTime: Date;
  coordinates: {
    lat: number;
    lng: number;
    timeOffset: number; // Offset in seconds from startTime
    accuracy?: number;
    speed?: number;
    altitude?: number;
  }[];
  totalDistance: number;
}

export function compressGPSData(coordinates: Coordinate[]): CompressedGPSData {
  if (coordinates.length === 0) {
    throw new Error('Cannot compress empty coordinates array');
  }

  // Remove duplicates and filter by accuracy
  const filtered = removeDuplicateCoordinates(filterByAccuracy(coordinates));
  
  if (filtered.length === 0) {
    throw new Error('No valid coordinates after filtering');
  }

  const startTime = filtered[0].timestamp || new Date();
  const totalDistance = calculateTotalDistance(filtered);

  const compressed = filtered.map(coord => ({
    lat: Math.round(coord.latitude * 1000000) / 1000000, // 6 decimal places
    lng: Math.round(coord.longitude * 1000000) / 1000000, // 6 decimal places
    timeOffset: coord.timestamp ? 
      Math.round((coord.timestamp.getTime() - startTime.getTime()) / 1000) : 0,
    ...(coord.accuracy && { accuracy: Math.round(coord.accuracy * 10) / 10 }),
    ...(coord.speed && { speed: Math.round(coord.speed * 10) / 10 }),
    ...(coord.altitude && { altitude: Math.round(coord.altitude * 10) / 10 })
  }));

  return {
    startTime,
    coordinates: compressed,
    totalDistance: Math.round(totalDistance * 1000) / 1000 // 3 decimal places
  };
}
