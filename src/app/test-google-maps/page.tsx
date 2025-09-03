"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { calculateDistanceWithGoogle, calculateTotalDistanceWithGoogle } from '@/lib/gps-utils';

export default function TestGoogleMapsPage() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testSingleDistance = async () => {
    setLoading(true);
    setResult('Testing single distance calculation...\nCheck console for detailed logs!');
    
    try {
      // Test coordinates: Bangalore to Chennai
      const origin = { latitude: 12.9716, longitude: 77.5946 };
      const destination = { latitude: 13.0827, longitude: 80.2707 };
      
      console.log('🧪 [TEST] Starting single distance test...');
      const result = await calculateDistanceWithGoogle(origin, destination, 'driving');
      
      setResult(`✅ Single Distance Test Result:
Distance: ${result.distance}km
Method: ${result.method}
Success: ${result.success}
Duration: ${result.duration ? result.duration.toFixed(1) + ' min' : 'N/A'}
${result.error ? 'Error: ' + result.error : ''}

Check console for detailed logs!`);
    } catch (error) {
      setResult(`❌ Test failed: ${error}`);
    }
    setLoading(false);
  };

  const testRouteDistance = async () => {
    setLoading(true);
    setResult('Testing route distance calculation...\nCheck console for detailed logs!');
    
    try {
      // Test route: Bangalore → Chennai → Coimbatore
      const coordinates = [
        { latitude: 12.9716, longitude: 77.5946 }, // Bangalore
        { latitude: 13.0827, longitude: 80.2707 }, // Chennai
        { latitude: 11.0168, longitude: 76.9558 }  // Coimbatore
      ];
      
      console.log('🧪 [TEST] Starting route distance test...');
      const result = await calculateTotalDistanceWithGoogle(coordinates, 'driving');
      
      setResult(`✅ Route Distance Test Result:
Total Distance: ${result.distance}km
Method: ${result.method}
Success: ${result.success}
Duration: ${result.duration ? result.duration.toFixed(1) + ' min' : 'N/A'}
${result.error ? 'Error: ' + result.error : ''}

Check console for detailed logs!`);
    } catch (error) {
      setResult(`❌ Test failed: ${error}`);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Google Maps API Test</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Single Distance Test</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Test point-to-point distance calculation between Bangalore and Chennai
            </p>
            <Button onClick={testSingleDistance} disabled={loading}>
              Test Single Distance
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Route Distance Test</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Test multi-point route calculation through multiple cities
            </p>
            <Button onClick={testRouteDistance} disabled={loading}>
              Test Route Distance
            </Button>
          </CardContent>
        </Card>
      </div>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded">
              {result}
            </pre>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Instructions & Fix Applied</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="bg-green-50 border border-green-200 rounded p-3 mb-4">
            <p className="font-medium text-green-800">✅ CORS Issue Fixed!</p>
            <p className="text-green-700">Google Maps API calls now go through server-side endpoint to avoid CORS restrictions.</p>
          </div>
          <p>1. Open browser console (F12 → Console tab)</p>
          <p>2. Click one of the test buttons above</p>
          <p>3. Watch for logs: "🌐 [GPS-UTILS] Calling server-side Google Maps API endpoint"</p>
          <p>4. If you see "google_api" method = Google Maps is working!</p>
          <p>5. If you see "haversine" method = Check your API key configuration</p>
        </CardContent>
      </Card>
    </div>
  );
}
