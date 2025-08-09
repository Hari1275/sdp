import { NextResponse } from 'next/server';

export async function GET() {
  // Only show env debug in development or if explicitly allowed
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_ENV_DEBUG) {
    return NextResponse.json({
      error: 'Environment debug not allowed in production',
      message: 'Set ALLOW_ENV_DEBUG=true to enable this endpoint in production'
    }, { status: 403 });
  }

  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    nextauthUrl: process.env.NEXTAUTH_URL ? 'Set' : 'Missing',
    nextauthSecret: process.env.NEXTAUTH_SECRET ? 'Set' : 'Missing',
    databaseUrl: process.env.DATABASE_URL ? 'Set' : 'Missing',
    vercelUrl: process.env.VERCEL_URL ? process.env.VERCEL_URL : 'Not on Vercel',
    host: process.env.NODE_ENV === 'production' ? 'Hidden in production' : process.env.HOST,
    port: process.env.PORT || '3000',
    timestamp: new Date().toISOString()
  });
}
