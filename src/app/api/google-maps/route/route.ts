import { NextRequest, NextResponse } from 'next/server';
import { calculateGodLevelRoute } from '@/lib/advanced-gps-engine';

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
      // Use GOD-LEVEL routing engine for optimal results
      console.log(`🧠 [GOD-LEVEL-API] Starting route calculation for ${waypoints.length} waypoints...`);
      
      // Convert waypoints to coordinates format
      const coordinates = waypoints.map(wp => ({
        latitude: wp.latitude,
        longitude: wp.longitude
      }));
      
      // Use the god-level routing engine
      const result = await calculateGodLevelRoute(coordinates);
      
      if (!result.success) {
        throw new Error(result.error || 'God-level routing failed');
      }
      
      // Convert geometry back to path format
      const path = result.geometry.map(coord => ({
        lat: coord.latitude,
        lng: coord.longitude
      }));
      
      console.log(`🎯 [GOD-LEVEL-API] Route calculation successful!`);
      console.log(`   📊 Distance: ${result.distance.toFixed(3)}km`);
      console.log(`   ⏱️  Duration: ${result.duration.toFixed(1)} minutes`);
      console.log(`   🔧 Method: ${result.method}`);
      console.log(`   📈 Accuracy: ${result.optimizations.accuracy}`);
      console.log(`   🚀 Optimization: ${result.optimizations.originalPoints} → ${result.optimizations.processedPoints} points`);
      console.log(`   💾 Cache hit: ${result.optimizations.cacheHit}`);
      console.log(`   ⚡ Processing time: ${result.optimizations.calculationTime}ms`);
      console.log(`   🗺️  Path points: ${path.length}`);

      return NextResponse.json({
        path,
        distance: result.distance,
        duration: result.duration,
        success: true,
        method: result.method,
        accuracy: result.optimizations.accuracy,
        optimizations: result.optimizations
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
