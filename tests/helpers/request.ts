// Helper to create Request objects for API route handlers/tests

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export function makeRequest(method: Method, url: string, body?: any, headers?: Record<string, string>): Request {
  const fullUrl = new URL(url, 'http://localhost:3000');
  const init: RequestInit = {
    method,
    headers: { 'content-type': 'application/json', ...(headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
  } as any;
  return new Request(fullUrl, init as any);
}

