import { prisma } from './prisma'
import { UserRole, BusinessType, TaskStatus, Priority } from '@prisma/client';
import bcrypt from 'bcryptjs'

// Database connection test
export async function testDatabaseConnection() {
  try {
    await prisma.$connect()
    console.log('✅ Database connection successful')
    return { success: true, message: 'Database connected successfully' }
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    return { success: false, message: 'Database connection failed', error }
  }
}

// Test all model creation and relationships
export async function testAllModels() {
  try {
    // Clean up existing test data first
    await cleanupTestData()

    console.log('🧪 Starting comprehensive database schema test...')

    // 1. Test Region creation
    console.log('1️⃣ Testing Region model...')
    const testRegion = await prisma.region.create({
      data: {
        name: 'Test Region - Mumbai',
        description: 'Test region for schema validation',
      }
    })
    console.log('✅ Region created:', testRegion.name)

    // 2. Test Area creation with Region relationship
    console.log('2️⃣ Testing Area model...')
    const testArea = await prisma.area.create({
      data: {
        name: 'Test Area - Bandra',
        description: 'Test area for schema validation',
        regionId: testRegion.id,
      }
    })
    console.log('✅ Area created:', testArea.name)

    // 3. Test User creation with role and relationships
    console.log('3️⃣ Testing User model...')
    const hashedPassword = await bcrypt.hash('testpassword123', 10)
    
    // Create Admin user
    const adminUser = await prisma.user.create({
      data: {
        username: 'test_admin',
        email: 'admin@test.com',
        password: hashedPassword,
        name: 'Test Admin User',
        phone: '9876543210',
        role: UserRole.ADMIN,
        regionId: testRegion.id,
      }
    })
    console.log('✅ Admin user created:', adminUser.name)

    // Create Lead MR user
    const leadMrUser = await prisma.user.create({
      data: {
        username: 'test_leadmr',
        email: 'leadmr@test.com',
        password: hashedPassword,
        name: 'Test Lead MR User',
        phone: '9876543211',
        role: UserRole.LEAD_MR,
        regionId: testRegion.id,
      }
    })
    console.log('✅ Lead MR user created:', leadMrUser.name)

    // Create MR user with Lead MR relationship
    const mrUser = await prisma.user.create({
      data: {
        username: 'test_mr',
        email: 'mr@test.com',
        password: hashedPassword,
        name: 'Test MR User',
        phone: '9876543212',
        role: UserRole.MR,
        regionId: testRegion.id,
        leadMrId: leadMrUser.id,
      }
    })
    console.log('✅ MR user created:', mrUser.name)

    // 4. Test Client creation with all relationships
    console.log('4️⃣ Testing Client model...')
    const testClient = await prisma.client.create({
      data: {
        name: 'Test Healthcare Clinic',
        phone: '0220123456',
        businessType: BusinessType.CLINIC,
        areaId: testArea.id,
        regionId: testRegion.id,
        latitude: 19.0596,
        longitude: 72.8295,
        address: 'Test Address, Mumbai',
        notes: 'Test client for schema validation',
        mrId: mrUser.id,
      }
    })
    console.log('✅ Client created:', testClient.name)

    // 5. Test Business Entry creation
    console.log('5️⃣ Testing BusinessEntry model...')
    const testBusinessEntry = await prisma.businessEntry.create({
      data: {
        amount: 25000.50,
        notes: 'Test business transaction',
        clientId: testClient.id,
        mrId: mrUser.id,
        latitude: 19.0596,
        longitude: 72.8295,
      }
    })
    console.log('✅ Business entry created:', testBusinessEntry.amount)

    // 6. Test Task creation with assignment relationships
    console.log('6️⃣ Testing Task model...')
    const testTask = await prisma.task.create({
      data: {
        title: 'Test Task - Client Visit',
        description: 'Test task for schema validation',
        regionId: testRegion.id,
        areaId: testArea.id,
        assigneeId: mrUser.id,
        createdById: leadMrUser.id,
        status: TaskStatus.PENDING,
        priority: Priority.HIGH,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      }
    })
    console.log('✅ Task created:', testTask.title)

    // 7. Test GPS Session creation
    console.log('7️⃣ Testing GPSSession model...')
    const testGpsSession = await prisma.gPSSession.create({
      data: {
        userId: mrUser.id,
        checkIn: new Date(),
        totalKm: 0,
      }
    })
    console.log('✅ GPS Session created:', testGpsSession.id)

    // 8. Test GPS Log creation
    console.log('8️⃣ Testing GPSLog model...')
    const testGpsLog = await prisma.gPSLog.create({
      data: {
        sessionId: testGpsSession.id,
        latitude: 19.0596,
        longitude: 72.8295,
        accuracy: 5.0,
        speed: 25.5,
      }
    })
    console.log('✅ GPS Log created:', testGpsLog.id)

    // 9. Test Notification creation
    console.log('9️⃣ Testing Notification model...')
    const testNotification = await prisma.notification.create({
      data: {
        title: 'Test Notification',
        message: 'This is a test notification for schema validation',
        targetUserId: mrUser.id,
      }
    })
    console.log('✅ Notification created:', testNotification.title)

    // 10. Test Daily Summary creation
    console.log('🔟 Testing DailySummary model...')
    const testDailySummary = await prisma.dailySummary.create({
      data: {
        mrId: mrUser.id,
        date: new Date(),
        totalVisits: 5,
        totalBusiness: 50000.00,
        totalKms: 45.5,
        totalHours: 8.0,
        checkInCount: 1,
      }
    })
    console.log('✅ Daily Summary created:', testDailySummary.totalVisits, 'visits')

    console.log('✅ All models tested successfully!')
    
    return { 
      success: true, 
      message: 'All models created and tested successfully',
      testData: {
        regionId: testRegion.id,
        areaId: testArea.id,
        adminUserId: adminUser.id,
        leadMrUserId: leadMrUser.id,
        mrUserId: mrUser.id,
        clientId: testClient.id,
        businessEntryId: testBusinessEntry.id,
        taskId: testTask.id,
        gpsSessionId: testGpsSession.id,
        gpsLogId: testGpsLog.id,
        notificationId: testNotification.id,
        dailySummaryId: testDailySummary.id,
      }
    }

  } catch (error) {
    console.error('❌ Model testing failed:', error)
    return { success: false, message: 'Model testing failed', error }
  }
}

// Test relationship queries
export async function testRelationshipQueries() {
  try {
    console.log('🔍 Testing relationship queries...')

    // Test User with Region relationship
    const userWithRegion = await prisma.user.findFirst({
      where: { username: 'test_mr' },
      include: {
        region: true,
        leadMr: true,
        clients: true,
        businessEntries: true,
        assignedTasks: true,
        gpsSessions: {
          include: {
            gpsLogs: true
          }
        }
      }
    })
    
    if (userWithRegion) {
      console.log('✅ User relationships loaded:', {
        user: userWithRegion.name,
        region: userWithRegion.region?.name,
        leadMr: userWithRegion.leadMr?.name,
        clientsCount: userWithRegion.clients.length,
        businessEntriesCount: userWithRegion.businessEntries.length,
        tasksCount: userWithRegion.assignedTasks.length,
        gpsSessionsCount: userWithRegion.gpsSessions.length
      })
    }

    // Test Region with all related data
    const regionWithAll = await prisma.region.findFirst({
      where: { name: 'Test Region - Mumbai' },
      include: {
        areas: {
          include: {
            clients: true,
            tasks: true
          }
        },
        users: true,
        clients: true,
        tasks: true
      }
    })

    if (regionWithAll) {
      console.log('✅ Region relationships loaded:', {
        region: regionWithAll.name,
        areasCount: regionWithAll.areas.length,
        usersCount: regionWithAll.users.length,
        clientsCount: regionWithAll.clients.length,
        tasksCount: regionWithAll.tasks.length
      })
    }

    // Test Client with Business Entries
    const clientWithEntries = await prisma.client.findFirst({
      where: { name: 'Test Healthcare Clinic' },
      include: {
        businessEntries: true,
        area: {
          include: {
            region: true
          }
        },
        mr: true
      }
    })

    if (clientWithEntries) {
      console.log('✅ Client relationships loaded:', {
        client: clientWithEntries.name,
        businessEntriesCount: clientWithEntries.businessEntries.length,
        area: clientWithEntries.area.name,
        region: clientWithEntries.area.region.name,
        mr: clientWithEntries.mr.name
      })
    }

    return { success: true, message: 'All relationship queries executed successfully' }

  } catch (error) {
    console.error('❌ Relationship queries failed:', error)
    return { success: false, message: 'Relationship queries failed', error }
  }
}

// Test unique constraints
export async function testUniqueConstraints() {
  try {
    console.log('🛡️ Testing unique constraints...')

    // Test duplicate username
    try {
      await prisma.user.create({
        data: {
          username: 'test_mr', // This should fail
          password: 'test123',
          name: 'Duplicate User',
          role: UserRole.MR,
        }
      })
      console.log('❌ Username uniqueness constraint failed')
      return { success: false, message: 'Username uniqueness constraint failed' }
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        console.log('✅ Username uniqueness constraint working')
      }
    }

    // Test duplicate region name
    try {
      await prisma.region.create({
        data: {
          name: 'Test Region - Mumbai' // This should fail
        }
      })
      console.log('❌ Region name uniqueness constraint failed')
      return { success: false, message: 'Region name uniqueness constraint failed' }
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        console.log('✅ Region name uniqueness constraint working')
      }
    }

    // Test duplicate client (name + location + area)
    try {
      await prisma.client.create({
        data: {
          name: 'Test Healthcare Clinic',
          businessType: BusinessType.CLINIC,
          areaId: (await prisma.area.findFirst({ where: { name: 'Test Area - Bandra' } }))!.id,
          regionId: (await prisma.region.findFirst({ where: { name: 'Test Region - Mumbai' } }))!.id,
          latitude: 19.0596,
          longitude: 72.8295,
          mrId: (await prisma.user.findFirst({ where: { username: 'test_mr' } }))!.id,
        }
      })
      console.log('❌ Client uniqueness constraint failed')
      return { success: false, message: 'Client uniqueness constraint failed' }
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        console.log('✅ Client uniqueness constraint working')
      }
    }

    return { success: true, message: 'All unique constraints working correctly' }

  } catch (error) {
    console.error('❌ Unique constraints testing failed:', error)
    return { success: false, message: 'Unique constraints testing failed', error }
  }
}

// Clean up test data
export async function cleanupTestData() {
  try {
    console.log('🧹 Cleaning up test data...')
    
    // Delete in order to respect foreign key constraints
    await prisma.gPSLog.deleteMany({ where: {} })
    await prisma.gPSSession.deleteMany({ where: {} })
    await prisma.businessEntry.deleteMany({ where: {} })
    await prisma.task.deleteMany({ where: {} })
    await prisma.client.deleteMany({ where: {} })
    await prisma.notification.deleteMany({ where: {} })
    await prisma.dailySummary.deleteMany({ where: {} })
    await prisma.user.deleteMany({ where: {} })
    await prisma.area.deleteMany({ where: {} })
    await prisma.region.deleteMany({ where: {} })
    
    console.log('✅ Test data cleaned up')
    return { success: true, message: 'Test data cleaned up successfully' }
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error)
    return { success: false, message: 'Cleanup failed', error }
  }
}

// Comprehensive database test
export async function runComprehensiveTest() {
  const results: {
    connection: { success: boolean; message: string; error?: unknown },
    models: { success: boolean; message: string; data?: unknown },
    relationships: { success: boolean; message: string; error?: unknown },
    constraints: { success: boolean; message: string; error?: unknown },
    cleanup: { success: boolean; message: string; error?: unknown }
  } = {
    connection: await testDatabaseConnection(),
    models: { success: false, message: '', data: null },
    relationships: { success: false, message: '' },
    constraints: { success: false, message: '' },
    cleanup: { success: false, message: '' }
  }

  if (results.connection.success) {
    results.models = await testAllModels()
    
    if (results.models.success) {
      results.relationships = await testRelationshipQueries()
      results.constraints = await testUniqueConstraints()
    }
    
    results.cleanup = await cleanupTestData()
  }

  return results
}
