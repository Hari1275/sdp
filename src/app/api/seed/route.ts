import { NextResponse } from 'next/server'
import { seedDatabase } from '@/lib/seed'

export async function POST() {
  try {
    // Only allow seeding in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({
        success: false,
        error: 'Database seeding is not allowed in production',
        message: 'This endpoint is only available in development mode'
      }, { status: 403 })
    }

    // console.log('🌱 Starting database seeding via API...')
    
    const result = await seedDatabase()
    
    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      data: result.data,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    // console.error('Database seeding failed:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Database seeding failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Database Seeding Endpoint',
    description: 'Use POST to seed the database with sample data',
    note: 'Only available in development mode',
    environment: process.env.NODE_ENV,
    available: process.env.NODE_ENV !== 'production'
  })
}
