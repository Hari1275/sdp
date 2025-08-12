import { prisma } from "./prisma";
import { UserRole, BusinessType, TaskStatus, Priority } from "@prisma/client";
import { hashPassword } from "./password";

export async function seedDatabase() {
  try {
  // console.log("🌱 Starting database seeding...");

    // Create regions
    const regions = await Promise.all([
      prisma.region.upsert({
        where: { name: "Mumbai" },
        update: {},
        create: {
          name: "Mumbai",
          description: "Mumbai Metropolitan Region",
        },
      }),
      prisma.region.upsert({
        where: { name: "Delhi" },
        update: {},
        create: {
          name: "Delhi",
          description: "Delhi NCR Region",
        },
      }),
      prisma.region.upsert({
        where: { name: "Bangalore" },
        update: {},
        create: {
          name: "Bangalore",
          description: "Bangalore Urban Region",
        },
      }),
    ]);

  // console.log(`✅ Created ${regions.length} regions`);

    // Create areas
    const areas = await Promise.all([
      // Mumbai areas
      prisma.area.upsert({
        where: { name_regionId: { name: "Bandra", regionId: regions[0].id } },
        update: {},
        create: {
          name: "Bandra",
          description: "Bandra West and East",
          regionId: regions[0].id,
        },
      }),
      prisma.area.upsert({
        where: { name_regionId: { name: "Andheri", regionId: regions[0].id } },
        update: {},
        create: {
          name: "Andheri",
          description: "Andheri West and East",
          regionId: regions[0].id,
        },
      }),
      // Delhi areas
      prisma.area.upsert({
        where: {
          name_regionId: { name: "Connaught Place", regionId: regions[1].id },
        },
        update: {},
        create: {
          name: "Connaught Place",
          description: "Central Delhi Commercial Area",
          regionId: regions[1].id,
        },
      }),
      // Bangalore areas
      prisma.area.upsert({
        where: {
          name_regionId: { name: "Koramangala", regionId: regions[2].id },
        },
        update: {},
        create: {
          name: "Koramangala",
          description: "Koramangala Tech Hub",
          regionId: regions[2].id,
        },
      }),
    ]);

  // console.log(`✅ Created ${areas.length} areas`);

    // Create users with hashed passwords
    const hashedPassword = await hashPassword("password123");

    const users = await Promise.all([
      // Admin user
      prisma.user.upsert({
        where: { username: "admin" },
        update: {},
        create: {
          username: "admin",
          email: "admin@sdpayurveda.com",
          password: hashedPassword,
          name: "System Administrator",
          phone: "9876543210",
          role: UserRole.ADMIN,
          regionId: regions[0].id,
        },
      }),
      // Lead MR users
      prisma.user.upsert({
        where: { username: "lead_mr_mumbai" },
        update: {},
        create: {
          username: "lead_mr_mumbai",
          email: "leadmr.mumbai@sdpayurveda.com",
          password: hashedPassword,
          name: "Rajesh Kumar (Lead MR)",
          phone: "9876543211",
          role: UserRole.LEAD_MR,
          regionId: regions[0].id,
        },
      }),
      prisma.user.upsert({
        where: { username: "lead_mr_delhi" },
        update: {},
        create: {
          username: "lead_mr_delhi",
          email: "leadmr.delhi@sdpayurveda.com",
          password: hashedPassword,
          name: "Priya Sharma (Lead MR)",
          phone: "9876543212",
          role: UserRole.LEAD_MR,
          regionId: regions[1].id,
        },
      }),
    ]);

    // Get Lead MR users for relationships
    const leadMrMumbai = users[1];
    const leadMrDelhi = users[2];

    // Create MR users
    const mrUsers = await Promise.all([
      // Mumbai MRs
      prisma.user.upsert({
        where: { username: "mr_mumbai_1" },
        update: {},
        create: {
          username: "mr_mumbai_1",
          email: "mr1.mumbai@sdpayurveda.com",
          password: hashedPassword,
          name: "Amit Patel",
          phone: "9876543213",
          role: UserRole.MR,
          regionId: regions[0].id,
          leadMrId: leadMrMumbai.id,
        },
      }),
      prisma.user.upsert({
        where: { username: "mr_mumbai_2" },
        update: {},
        create: {
          username: "mr_mumbai_2",
          email: "mr2.mumbai@sdpayurveda.com",
          password: hashedPassword,
          name: "Sunita Yadav",
          phone: "9876543214",
          role: UserRole.MR,
          regionId: regions[0].id,
          leadMrId: leadMrMumbai.id,
        },
      }),
      // Delhi MRs
      prisma.user.upsert({
        where: { username: "mr_delhi_1" },
        update: {},
        create: {
          username: "mr_delhi_1",
          email: "mr1.delhi@sdpayurveda.com",
          password: hashedPassword,
          name: "Vikash Singh",
          phone: "9876543215",
          role: UserRole.MR,
          regionId: regions[1].id,
          leadMrId: leadMrDelhi.id,
        },
      }),
    ]);

  // console.log(`✅ Created ${users.length + mrUsers.length} users`);

    // Create sample clients
    const clients = await Promise.all([
      // Mumbai clients
      prisma.client.upsert({
        where: {
          name_latitude_longitude_areaId: {
            name: "Healing Hands Clinic",
            latitude: 19.0596,
            longitude: 72.8295,
            areaId: areas[0].id,
          },
        },
        update: {},
        create: {
          name: "Healing Hands Clinic",
          phone: "0220123456",
          businessType: BusinessType.CLINIC,
          areaId: areas[0].id,
          regionId: regions[0].id,
          latitude: 19.0596,
          longitude: 72.8295,
          address: "123 Linking Road, Bandra West, Mumbai",
          notes: "Established clinic with good footfall",
          mrId: mrUsers[0].id,
        },
      }),
      prisma.client.upsert({
        where: {
          name_latitude_longitude_areaId: {
            name: "MediCare Pharmacy",
            latitude: 19.1197,
            longitude: 72.8464,
            areaId: areas[1].id,
          },
        },
        update: {},
        create: {
          name: "MediCare Pharmacy",
          phone: "0220234567",
          businessType: BusinessType.PHARMACY,
          areaId: areas[1].id,
          regionId: regions[0].id,
          latitude: 19.1197,
          longitude: 72.8464,
          address: "456 Andheri East, Mumbai",
          notes: "Large pharmacy with good relations",
          mrId: mrUsers[1].id,
        },
      }),
      // Delhi client
      prisma.client.upsert({
        where: {
          name_latitude_longitude_areaId: {
            name: "Central Hospital",
            latitude: 28.6139,
            longitude: 77.209,
            areaId: areas[2].id,
          },
        },
        update: {},
        create: {
          name: "Central Hospital",
          phone: "01120345678",
          businessType: BusinessType.HOSPITAL,
          areaId: areas[2].id,
          regionId: regions[1].id,
          latitude: 28.6139,
          longitude: 77.209,
          address: "Connaught Place, New Delhi",
          notes: "Major hospital with multiple departments",
          mrId: mrUsers[2].id,
        },
      }),
    ]);

  // console.log(`✅ Created ${clients.length} clients`);

    // Create sample business entries
    const businessEntries = await Promise.all([
      prisma.businessEntry.create({
        data: {
          amount: 15000.0,
          notes: "Monthly order for ayurvedic medicines",
          clientId: clients[0].id,
          mrId: mrUsers[0].id,
          latitude: 19.0596,
          longitude: 72.8295,
        },
      }),
      prisma.businessEntry.create({
        data: {
          amount: 25000.5,
          notes: "Bulk order for wellness products",
          clientId: clients[1].id,
          mrId: mrUsers[1].id,
          latitude: 19.1197,
          longitude: 72.8464,
        },
      }),
    ]);

  // console.log(`✅ Created ${businessEntries.length} business entries`);

    // Create sample tasks
    const tasks = await Promise.all([
      prisma.task.create({
        data: {
          title: "Visit new clinic in Bandra",
          description: "Introduce our new product line to the clinic",
          regionId: regions[0].id,
          areaId: areas[0].id,
          assigneeId: mrUsers[0].id,
          createdById: leadMrMumbai.id,
          status: TaskStatus.PENDING,
          priority: Priority.HIGH,
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        },
      }),
      prisma.task.create({
        data: {
          title: "Follow up with MediCare Pharmacy",
          description: "Check on last month's order status",
          regionId: regions[0].id,
          areaId: areas[1].id,
          assigneeId: mrUsers[1].id,
          createdById: leadMrMumbai.id,
          status: TaskStatus.IN_PROGRESS,
          priority: Priority.MEDIUM,
          dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        },
      }),
    ]);

  // console.log(`✅ Created ${tasks.length} tasks`);

    // Create GPS sessions and logs for live tracking testing
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const fortyMinsAgo = new Date(now.getTime() - 40 * 60 * 1000);

    // Active session for MR in Mumbai with last ~20 GPS points
    const activeSession = await prisma.gPSSession.create({
      data: {
        userId: mrUsers[0].id,
        checkIn: oneHourAgo,
        startLat: 19.0596,
        startLng: 72.8295,
        totalKm: 5.2,
      },
    });

    const trailPoints: Array<{ lat: number; lng: number }> = Array.from(
      { length: 20 },
      (_, i) => ({
        lat: 19.0596 + i * 0.0015,
        lng: 72.8295 + i * 0.0012,
      })
    );

    await Promise.all(
      trailPoints.map((p, i) =>
        prisma.gPSLog.create({
          data: {
            sessionId: activeSession.id,
            latitude: p.lat,
            longitude: p.lng,
            timestamp: new Date(now.getTime() - (20 - i) * 2 * 60 * 1000), // every 2 mins
            speed: 12 + Math.random() * 8,
            accuracy: 5 + Math.random() * 5,
          },
        })
      )
    );

    // Completed session for another MR earlier today
    const completedSession = await prisma.gPSSession.create({
      data: {
        userId: mrUsers[1].id,
        checkIn: new Date(now.getTime() - 3 * 60 * 60 * 1000),
        checkOut: fortyMinsAgo,
        startLat: 19.1197,
        startLng: 72.8464,
        endLat: 19.1397,
        endLng: 72.8664,
        totalKm: 8.6,
      },
    });

    await prisma.gPSLog.create({
      data: {
        sessionId: completedSession.id,
        latitude: 19.1397,
        longitude: 72.8664,
        timestamp: fortyMinsAgo,
        speed: 0,
        accuracy: 6,
      },
    });

    // Recent business entry for activity feed
    await prisma.businessEntry.create({
      data: {
        amount: 8450.75,
        notes: "Follow-up order placed",
        clientId: clients[0].id,
        mrId: mrUsers[0].id,
        latitude: 19.062,
        longitude: 72.832,
        createdAt: new Date(now.getTime() - 15 * 60 * 1000),
      },
    });

    // Mark one task as completed recently for activity feed
    await prisma.task.updateMany({
      where: { assigneeId: mrUsers[1].id, status: TaskStatus.IN_PROGRESS },
      data: {
        status: TaskStatus.COMPLETED,
        completedAt: new Date(now.getTime() - 10 * 60 * 1000),
      },
    });

  // console.log("✅ Created GPS sessions/logs and recent activities");

  // console.log("🌱 Database seeding completed successfully!");

    return {
      success: true,
      message: "Database seeded successfully",
      data: {
        regions: regions.length,
        areas: areas.length,
        users: users.length + mrUsers.length,
        clients: clients.length,
        businessEntries: businessEntries.length,
        tasks: tasks.length,
      },
    };
  } catch (error) {
  // console.error("❌ Database seeding failed:", error);
    throw error;
  }
}
