import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, errorResponse } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    // Authentication is optional for this utility endpoint
    // But we'll add it for security
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { path } = await request.json();

    if (!path || !Array.isArray(path) || path.length < 2) {
      return NextResponse.json(
        { error: 'Invalid path data. Minimum 2 coordinates required.' },
        { status: 400 }
      );
    }

    if (path.length > 100) {
      return NextResponse.json(
        { error: 'Too many coordinates. Maximum 100 points per request.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Maps API key not configured' },
        { status: 500 }
      );
    }

    // Convert path to Google Roads API format
    const pathString = path
      .map((point: { lat: number; lng: number }) => `${point.lat},${point.lng}`)
      .join('|');

    // Call Google Roads API - Snap to Roads
    const roadsUrl = `https://roads.googleapis.com/v1/snapToRoads?path=${encodeURIComponent(pathString)}&interpolate=true&key=${apiKey}`;
    
    const response = await fetch(roadsUrl);
    
    if (!response.ok) {
      throw new Error(`Google Roads API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`Google Roads API error: ${data.error.message}`);
    }

    console.log(`🛣️ Google Roads API processed ${path.length} points → ${data.snappedPoints?.length || 0} snapped points`);

    return NextResponse.json({
      success: true,
      snappedPoints: data.snappedPoints || [],
      originalPointCount: path.length,
      snappedPointCount: data.snappedPoints?.length || 0,
      interpolated: true
    });

  } catch (error) {
    console.error('Google Roads API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process coordinates with Google Roads API',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET method for testing with sample data
export async function GET() {
  return NextResponse.json({
    info: 'Google Maps Snap to Roads API',
    usage: 'POST with path array of {lat, lng} coordinates',
    limits: 'Max 100 points per request',
    example: {
      path: [
        { lat: 60.170880, lng: 24.942795 },
        { lat: 60.170879, lng: 24.942796 },
        { lat: 60.170877, lng: 24.942796 }
      ]
    }
  });
}
