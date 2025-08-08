const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  try {
    // Check if we already have data
    const existingRegions = await prisma.region.count();
    console.log(`📈 Found ${existingRegions} existing regions`);
    
    if (existingRegions > 0) {
      console.log('📝 Database already has data. Adding additional sample data...');
    }

    // Create Regions
    console.log('🏢 Creating regions...');
    const mumbaiRegion = await prisma.region.create({
      data: {
        name: 'Mumbai Region',
        description: 'Mumbai and surrounding areas'
      }
    });

    const delhiRegion = await prisma.region.create({
      data: {
        name: 'Delhi Region',
        description: 'Delhi NCR and surrounding areas'
      }
    });

    const bangaloreRegion = await prisma.region.create({
      data: {
        name: 'Bangalore Region',
        description: 'Bangalore and Karnataka region'
      }
    });

    console.log(`✅ Created ${3} regions`);

    // Create Areas
    console.log('🏘️ Creating areas...');
    const areas = await Promise.all([
      // Mumbai areas
      prisma.area.create({
        data: {
          name: 'Andheri',
          description: 'Andheri East and West',
          regionId: mumbaiRegion.id
        }
      }),
      prisma.area.create({
        data: {
          name: 'Bandra',
          description: 'Bandra and linking road area',
          regionId: mumbaiRegion.id
        }
      }),
      prisma.area.create({
        data: {
          name: 'Thane',
          description: 'Thane and surrounding areas',
          regionId: mumbaiRegion.id
        }
      }),

      // Delhi areas
      prisma.area.create({
        data: {
          name: 'Connaught Place',
          description: 'Central Delhi business area',
          regionId: delhiRegion.id
        }
      }),
      prisma.area.create({
        data: {
          name: 'Gurgaon',
          description: 'Gurgaon and Cyber City',
          regionId: delhiRegion.id
        }
      }),
      prisma.area.create({
        data: {
          name: 'Noida',
          description: 'Noida and Greater Noida',
          regionId: delhiRegion.id
        }
      }),

      // Bangalore areas
      prisma.area.create({
        data: {
          name: 'Koramangala',
          description: 'Koramangala and surrounding areas',
          regionId: bangaloreRegion.id
        }
      }),
      prisma.area.create({
        data: {
          name: 'Electronic City',
          description: 'Electronic City and tech parks',
          regionId: bangaloreRegion.id
        }
      }),
    ]);

    console.log(`✅ Created ${areas.length} areas`);

    // Create Users (Marketing Representatives)
    console.log('👥 Creating users...');
    const users = await Promise.all([
      // Mumbai MRs
      prisma.user.create({
        data: {
          username: 'rajesh.kumar',
          name: 'Rajesh Kumar',
          email: 'rajesh.kumar@ayurveda.com',
          password: 'hashed_password_here', // In real app, this would be properly hashed
          role: 'MR',
          regionId: mumbaiRegion.id
        }
      }),
      prisma.user.create({
        data: {
          username: 'priya.sharma',
          name: 'Priya Sharma',
          email: 'priya.sharma@ayurveda.com',
          password: 'hashed_password_here',
          role: 'MR',
          regionId: mumbaiRegion.id
        }
      }),

      // Delhi MRs
      prisma.user.create({
        data: {
          username: 'amit.singh',
          name: 'Amit Singh',
          email: 'amit.singh@ayurveda.com',
          password: 'hashed_password_here',
          role: 'MR',
          regionId: delhiRegion.id
        }
      }),
      prisma.user.create({
        data: {
          username: 'sneha.gupta',
          name: 'Sneha Gupta',
          email: 'sneha.gupta@ayurveda.com',
          password: 'hashed_password_here',
          role: 'MR',
          regionId: delhiRegion.id
        }
      }),

      // Bangalore MRs
      prisma.user.create({
        data: {
          username: 'suresh.reddy',
          name: 'Suresh Reddy',
          email: 'suresh.reddy@ayurveda.com',
          password: 'hashed_password_here',
          role: 'MR',
          regionId: bangaloreRegion.id
        }
      }),
      prisma.user.create({
        data: {
          username: 'kavitha.nair',
          name: 'Kavitha Nair',
          email: 'kavitha.nair@ayurveda.com',
          password: 'hashed_password_here',
          role: 'MR',
          regionId: bangaloreRegion.id
        }
      }),

      // Create an admin user too
      prisma.user.create({
        data: {
          username: 'admin',
          name: 'Admin User',
          email: 'admin@ayurveda.com',
          password: 'hashed_password_here',
          role: 'ADMIN'
        }
      }),
    ]);

    console.log(`✅ Created ${users.length} users`);

    // Create some sample clients
    console.log('🏥 Creating sample clients...');
    const clients = await Promise.all([
      // Mumbai clients
      prisma.client.create({
        data: {
          name: 'City Hospital Mumbai',
          phone: '9876543210',
          businessType: 'HOSPITAL',
          address: '123 Main Street, Andheri East, Mumbai',
          latitude: 19.1136,
          longitude: 72.8697,
          regionId: mumbaiRegion.id,
          areaId: areas[0].id, // Andheri
          mrId: users[0].id, // Rajesh Kumar
          notes: 'Large multi-specialty hospital'
        }
      }),
      prisma.client.create({
        data: {
          name: 'Wellness Clinic Bandra',
          phone: '9876543211',
          businessType: 'CLINIC',
          address: '456 Linking Road, Bandra West, Mumbai',
          latitude: 19.0544,
          longitude: 72.8406,
          regionId: mumbaiRegion.id,
          areaId: areas[1].id, // Bandra
          mrId: users[1].id, // Priya Sharma
          notes: 'Ayurvedic wellness center'
        }
      }),

      // Delhi clients
      prisma.client.create({
        data: {
          name: 'Apollo Pharmacy CP',
          phone: '9876543212',
          businessType: 'PHARMACY',
          address: '789 Connaught Place, New Delhi',
          latitude: 28.6304,
          longitude: 77.2177,
          regionId: delhiRegion.id,
          areaId: areas[3].id, // Connaught Place
          mrId: users[2].id, // Amit Singh
          notes: '24/7 pharmacy chain'
        }
      }),

      // Bangalore clients
      prisma.client.create({
        data: {
          name: 'Ayush Healthcare Center',
          phone: '9876543213',
          businessType: 'HEALTHCARE_CENTER',
          address: '101 Koramangala 5th Block, Bangalore',
          latitude: 12.9352,
          longitude: 77.6245,
          regionId: bangaloreRegion.id,
          areaId: areas[6].id, // Koramangala
          mrId: users[4].id, // Suresh Reddy
          notes: 'Integrated healthcare facility'
        }
      }),
    ]);

    console.log(`✅ Created ${clients.length} sample clients`);

    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`- Regions: ${3}`);
    console.log(`- Areas: ${areas.length}`);
    console.log(`- Users: ${users.length}`);
    console.log(`- Clients: ${clients.length}`);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
