import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { comparePasswords } from '@/lib/password';

export async function GET() {
  try {
    // Find admin user
    const adminUser = await prisma.user.findUnique({
      where: { username: 'admin' },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
      }
    });

    if (!adminUser) {
      return NextResponse.json({
        found: false,
        message: 'Admin user not found in database',
        suggestion: 'Run the database seed to create the admin user'
      });
    }

    // Test password (in development only)
    let passwordValid = false;
    if (process.env.NODE_ENV === 'development') {
      try {
        const user = await prisma.user.findUnique({
          where: { username: 'admin' }
        });
        passwordValid = await comparePasswords('password123', user?.password || '');
      } catch (error) {
        console.error('Error testing password:', error);
      }
    }

    return NextResponse.json({
      found: true,
      user: adminUser,
      passwordValid: process.env.NODE_ENV === 'development' ? passwordValid : 'not tested in production',
      message: adminUser.status === 'ACTIVE' ? 'Admin user is active and ready' : 'Admin user exists but is not active'
    });

  } catch (error) {
    console.error('Error checking admin user:', error);
    return NextResponse.json({
      error: 'Failed to check admin user',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
