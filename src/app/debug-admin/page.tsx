"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminDebugPage() {
  const [adminUser, setAdminUser] = useState<any>(null);
  const [seedResult, setSeedResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const checkAdminUser = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/debug/admin-user');
      const data = await response.json();
      setAdminUser(data);
    } catch (error) {
      console.error('Error checking admin user:', error);
      setAdminUser({ error: 'Failed to check admin user' });
    } finally {
      setLoading(false);
    }
  };

  const runSeed = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/seed', { method: 'POST' });
      const data = await response.json();
      setSeedResult(data);
    } catch (error) {
      console.error('Error running seed:', error);
      setSeedResult({ error: 'Failed to run seed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Admin Debug Page</h1>
      
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Admin User Check</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={checkAdminUser} disabled={loading}>
              {loading ? 'Checking...' : 'Check Admin User'}
            </Button>
            {adminUser && (
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                {JSON.stringify(adminUser, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Database Seed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={runSeed} disabled={loading}>
              {loading ? 'Seeding...' : 'Run Database Seed'}
            </Button>
            {seedResult && (
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                {JSON.stringify(seedResult, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expected Admin Credentials</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div><strong>Username:</strong> admin</div>
              <div><strong>Password:</strong> password123</div>
              <div><strong>Email:</strong> admin@sdpayurveda.com</div>
              <div><strong>Role:</strong> ADMIN</div>
              <div><strong>Status:</strong> ACTIVE (default)</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
