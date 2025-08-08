import { NextResponse } from 'next/server';

// Utility to read JSON from NextResponse in tests
export async function readJson(res: NextResponse) {
  const text = await (res as any).text?.() ?? await (res as any).body?.getReader?.();
  try {
    // If NextResponse has a json() helper use it
    if ((res as any).json) return (res as any).json();
  } catch (_) {}
  // Fallback read
  const data = (res as any)?._body ?? (typeof text === 'string' ? text : '');
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

