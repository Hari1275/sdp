import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Test database connection
    await prisma.$connect()
    
    return NextResponse.json({
      success: true,
      message: 'SDP Ayurveda API is healthy',
      data: {
        timestamp: new Date().toISOString(),
        version: process.env.APP_VERSION || '1.0.0',
        database: 'connected',
        environment: process.env.NODE_ENV || 'development'
      }
    })
  } catch (error) {
    console.error('Health check failed:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Health check failed',
      message: 'Database connection failed'
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}
