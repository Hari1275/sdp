import { NextResponse } from 'next/server'
import { runComprehensiveTest } from '@/lib/db-test'

export async function GET() {
  try {
    console.log('🧪 Starting comprehensive database schema test...')
    
    const results = await runComprehensiveTest()
    
    const allTestsPassed = results.connection.success && 
                          results.models.success && 
                          results.relationships.success && 
                          results.constraints.success

    return NextResponse.json({
      success: allTestsPassed,
      message: allTestsPassed 
        ? 'All database schema tests passed successfully' 
        : 'Some database schema tests failed',
      results: {
        connection: {
          success: results.connection.success,
          message: results.connection.message
        },
        models: {
          success: results.models.success,
          message: results.models.message,
          testDataIds: results.models.data
        },
        relationships: {
          success: results.relationships.success,
          message: results.relationships.message
        },
        constraints: {
          success: results.constraints.success,
          message: results.constraints.message
        },
        cleanup: {
          success: results.cleanup.success,
          message: results.cleanup.message
        }
      },
      timestamp: new Date().toISOString(),
      schemaInfo: {
        totalModels: 10,
        models: [
          'User (with role-based access)',
          'Region (geographic data)',
          'Area (sub-regions)',
          'Client (healthcare facilities)',
          'BusinessEntry (transactions)',
          'Task (assignment management)',
          'GPSSession (tracking sessions)',
          'GPSLog (GPS coordinates)',
          'Notification (messaging)',
          'DailySummary (performance metrics)'
        ],
        relationships: {
          'User → Region': 'Many-to-One',
          'User → User (LeadMR)': 'Self-referential',
          'Area → Region': 'Many-to-One',
          'Client → Area/Region/User': 'Many-to-One',
          'BusinessEntry → Client/User': 'Many-to-One',
          'Task → Region/Area/User': 'Many-to-One',
          'GPSSession → User': 'Many-to-One',
          'GPSLog → GPSSession': 'Many-to-One'
        },
        uniqueConstraints: [
          'User.username',
          'User.email',
          'Region.name',
          'Area.name + Region',
          'Client.name + Location + Area',
          'DailySummary.mrId + date'
        ],
        enums: [
          'UserRole (MR, LEAD_MR, ADMIN)',
          'UserStatus (ACTIVE, INACTIVE, SUSPENDED)',
          'BusinessType (CLINIC, MEDICAL_STORE, HOSPITAL, PHARMACY, HEALTHCARE_CENTER)',
          'TaskStatus (PENDING, COMPLETED, CANCELLED)',
          'Priority (LOW, MEDIUM, HIGH, URGENT)',
          'SessionStatus (ACTIVE, COMPLETED, INTERRUPTED)',
          'NotificationType (INFO, TASK_ASSIGNMENT, TASK_UPDATE, SYSTEM_ALERT, WARNING)'
        ]
      }
    })
    
  } catch (error) {
    console.error('Database schema test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Database schema test failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function POST() {
  return NextResponse.json({
    error: 'Method not allowed',
    message: 'Use GET to run database schema tests'
  }, { status: 405 })
}
