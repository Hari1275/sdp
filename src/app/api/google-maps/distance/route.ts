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
    
    console.log('🗺️ [API] Google Maps distance calculation requested');
    console.log(`   Origin: ${origin.latitude}, ${origin.longitude}`);
    console.log(`   Destination: ${destination.latitude}, ${destination.longitude}`);
    console.log(`   Mode: ${mode}`);
    console.log(`   API Key available: ${!!apiKey} ${apiKey ? `(length: ${apiKey.length})` : '(MISSING)'}`);

    if (!apiKey) {
      console.warn('⚠️ [API] No Google Maps API key found! Cannot use Distance Matrix API');
      
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

      console.log(`🌐 [API] Calling Google Distance Matrix API from server`);
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        console.error(`❌ [API] Google API HTTP error: ${response.status}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(`📊 [API] Google API response status: ${data.status}`);

      if (data.status !== 'OK') {
        console.error(`❌ [API] Google API returned error: ${data.status} - ${data.error_message || 'Unknown error'}`);
        throw new Error(`API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
      }

      const element = data.rows[0]?.elements[0];
      if (!element || element.status !== 'OK') {
        console.error(`❌ [API] Route calculation failed: ${element?.status || 'Unknown error'}`);
        throw new Error(`Route not found: ${element?.status || 'Unknown error'}`);
      }

      const distanceKm = element.distance.value / 1000;
      const durationMinutes = element.duration.value / 60;

      console.log(`✅ [API] Google API success! Distance: ${distanceKm}km, Duration: ${durationMinutes.toFixed(1)} min`);

      return NextResponse.json({
        distance: distanceKm,
        duration: durationMinutes,
        method: 'google_api',
        success: true
      });

    } catch (error) {
      console.error('❌ [API] Google API failed, falling back to Haversine calculation');
      console.error(`   Error details: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Fallback to Haversine calculation
      const haversineDistance = calculateHaversineDistance(origin, destination);
      console.log(`✅ [API] Haversine fallback calculated: ${haversineDistance}km`);
      
      return NextResponse.json({
        distance: haversineDistance,
        method: 'haversine',
        success: true,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

  } catch (error) {
    console.error('❌ [API] Request processing failed:', error);
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
