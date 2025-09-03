import { NextRequest, NextResponse } from 'next/server';

export interface DistanceRequest {
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  mode?: 'driving' | 'walking' | 'bicycling' | 'transit';
}

export interface DistanceResponse {
  distance: number; // in kilometers
  duration?: number; // in minutes
  method: 'google_api' | 'haversine';
  success: boolean;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: DistanceRequest = await request.json();
    const { origin, destination, mode = 'driving' } = body;

    // Validate input
    if (!origin || !destination || 
        typeof origin.latitude !== 'number' || typeof origin.longitude !== 'number' ||
        typeof destination.latitude !== 'number' || typeof destination.longitude !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Invalid coordinates provided' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
      if (!apiKey) {
      
      // Calculate Haversine distance as fallback
      const haversineDistance = calculateHaversineDistance(origin, destination);
      
      return NextResponse.json({
        distance: haversineDistance,
        method: 'haversine',
        success: true,
        error: 'No Google Maps API key configured'
      });
    }

    try {
      const originStr = `${origin.latitude},${origin.longitude}`;
      const destinationStr = `${destination.latitude},${destination.longitude}`;
      
      const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
      url.searchParams.append('origins', originStr);
      url.searchParams.append('destinations', destinationStr);
      url.searchParams.append('mode', mode);
      url.searchParams.append('units', 'metric');
      url.searchParams.append('key', apiKey);

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== 'OK') {
        throw new Error(`API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
      }

      const element = data.rows[0]?.elements[0];
      if (!element || element.status !== 'OK') {
        throw new Error(`Route not found: ${element?.status || 'Unknown error'}`);
      }

      const distanceKm = element.distance.value / 1000;
      const durationMinutes = element.duration.value / 60;

      return NextResponse.json({
        distance: distanceKm,
        duration: durationMinutes,
        method: 'google_api',
        success: true
      });

    } catch (error) {
      // Fallback to Haversine calculation
      const haversineDistance = calculateHaversineDistance(origin, destination);
      
      return NextResponse.json({
        distance: haversineDistance,
        method: 'haversine',
        success: true,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Haversine formula for calculating distance between two points
function calculateHaversineDistance(
  point1: { latitude: number; longitude: number },
  point2: { latitude: number; longitude: number }
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
  const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
