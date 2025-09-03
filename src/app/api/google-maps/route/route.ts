import { NextRequest, NextResponse } from 'next/server';

export interface RouteRequest {
  waypoints: { latitude: number; longitude: number }[];
  mode?: 'driving' | 'walking' | 'bicycling' | 'transit';
}

export interface RouteResponse {
  path: { lat: number; lng: number }[];
  distance: number; // in kilometers
  duration: number; // in minutes
  success: boolean;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RouteRequest = await request.json();
    const { waypoints, mode = 'driving' } = body;

    // Validate input
    if (!waypoints || !Array.isArray(waypoints) || waypoints.length < 2) {
      return NextResponse.json(
        { success: false, error: 'At least 2 waypoints required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      
      // Fallback to straight lines between points
      const path = waypoints.map(wp => ({ lat: wp.latitude, lng: wp.longitude }));
      const straightLineDistance = calculateStraightLineDistance(waypoints);
      
      return NextResponse.json({
        path,
        distance: straightLineDistance,
        duration: 0,
        success: true,
        error: 'No Google Maps API key configured - using straight lines'
      });
    }

    try {
      // Use Google Directions API for road-based routing
      const origin = waypoints[0];
      const destination = waypoints[waypoints.length - 1];
      const waypointParams = waypoints.slice(1, -1);

      const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
      url.searchParams.append('origin', `${origin.latitude},${origin.longitude}`);
      url.searchParams.append('destination', `${destination.latitude},${destination.longitude}`);
      
      if (waypointParams.length > 0) {
        const waypointsStr = waypointParams
          .map(wp => `${wp.latitude},${wp.longitude}`)
          .join('|');
        url.searchParams.append('waypoints', waypointsStr);
      }
      
      url.searchParams.append('mode', mode);
      url.searchParams.append('key', apiKey);

      console.log(`🌐 [API] Calling Google Directions API from server`);
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        console.error(`❌ [API] Google Directions API HTTP error: ${response.status}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(`📊 [API] Google Directions API response status: ${data.status}`);

      if (data.status !== 'OK') {
        console.error(`❌ [API] Google Directions API returned error: ${data.status} - ${data.error_message || 'Unknown error'}`);
        throw new Error(`API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
      }

      const route = data.routes[0];
      if (!route) {
        console.error(`❌ [API] No route found in Directions API response`);
        throw new Error('No route found');
      }

      // Decode the polyline to get the road path
      const decodedPath = decodePolyline(route.overview_polyline.points);
      
      // Calculate total distance and duration
      let totalDistance = 0;
      let totalDuration = 0;
      
      route.legs.forEach((leg: any) => {
        totalDistance += leg.distance.value;
        totalDuration += leg.duration.value;
      });

      const distanceKm = totalDistance / 1000;
      const durationMinutes = totalDuration / 60;

      console.log(`✅ [API] Google Directions API success! Distance: ${distanceKm}km, Duration: ${durationMinutes.toFixed(1)} min`);
      console.log(`   Path points: ${decodedPath.length}`);

      return NextResponse.json({
        path: decodedPath,
        distance: distanceKm,
        duration: durationMinutes,
        success: true
      });

    } catch (error) {
      console.error('❌ [API] Google Directions API failed, falling back to straight lines');
      console.error(`   Error details: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Fallback to straight lines between points
      const path = waypoints.map(wp => ({ lat: wp.latitude, lng: wp.longitude }));
      const straightLineDistance = calculateStraightLineDistance(waypoints);
      
      return NextResponse.json({
        path,
        distance: straightLineDistance,
        duration: 0,
        success: true,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

  } catch (error) {
    console.error('❌ [API] Route request processing failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Google Polyline Algorithm Decoder
function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  const poly = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    poly.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return poly;
}

// Calculate straight-line distance between waypoints
function calculateStraightLineDistance(waypoints: { latitude: number; longitude: number }[]): number {
  let totalDistance = 0;
  
  for (let i = 0; i < waypoints.length - 1; i++) {
    const point1 = waypoints[i];
    const point2 = waypoints[i + 1];
    
    const R = 6371; // Earth's radius in kilometers
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
    const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    totalDistance += R * c;
  }
  
  return totalDistance;
}
