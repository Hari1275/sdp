// Helper to create NextRequest-like objects for API route handlers
import { NextRequest } from 'next/server';

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export function makeRequest(method: Method, url: string, body?: any): NextRequest {
  const fullUrl = new URL(url, 'http://localhost:3000');
  const init: RequestInit = {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  } as any;
  return new NextRequest(fullUrl, init as any);
}

