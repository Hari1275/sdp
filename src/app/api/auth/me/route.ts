import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  extractTokenFromRequest,
  getAuthenticatedUserFromToken,
  JWTError
} from '@/lib/jwt'

export async function GET(request: NextRequest) {
  try {
    let user = null
    let authMethod = 'none'
    let sessionData = null

    // First try JWT token from Authorization header (for mobile)
    const jwtToken = extractTokenFromRequest(request)
    if (jwtToken) {
      try {
        user = await getAuthenticatedUserFromToken(jwtToken)
        authMethod = 'jwt'
        console.log('Authenticated via JWT token')
      } catch (error) {
        if (error instanceof JWTError) {
          console.log('JWT authentication failed:', error.message)
          // Continue to try session authentication
        } else {
          console.error('JWT authentication error:', error)
        }
      }
    }

    // Fallback to session-based authentication (for web)
    if (!user) {
      const session = await getServerSession(authOptions)
      if (session?.user?.id) {
        user = await prisma.user.findUnique({
          where: { id: session.user.id },
          include: {
            region: true,
            leadMr: true,
            teamMembers: {
              where: { status: 'ACTIVE' },
              select: {
                id: true,
                name: true,
                username: true,
                role: true,
                status: true
              }
            },
            _count: {
              select: {
                clients: true,
                businessEntries: true,
                assignedTasks: true,
                gpsSessions: true
              }
            }
          }
        })
        authMethod = 'session'
        sessionData = { expires: session.expires }
        console.log('Authenticated via session')
      }
    } else {
      // For JWT users, get additional data
      user = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          region: true,
          leadMr: true,
          teamMembers: {
            where: { status: 'ACTIVE' },
            select: {
              id: true,
              name: true,
              username: true,
              role: true,
              status: true
            }
          },
          _count: {
            select: {
              clients: true,
              businessEntries: true,
              assignedTasks: true,
              gpsSessions: true
            }
          }
        }
      })
    }

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      }, { status: 401 })
    }

    if (user.status !== 'ACTIVE') {
      return NextResponse.json({
        success: false,
        error: 'ACCOUNT_INACTIVE',
        message: 'Your account has been deactivated. Please contact your administrator.'
      }, { status: 403 })
    }

    // Prepare response data (without password)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...userWithoutPassword } = user
    const responseData: Record<string, unknown> = {
      user: {
        ...userWithoutPassword,
        statistics: {
          totalClients: user._count.clients,
          totalBusinessEntries: user._count.businessEntries,
          totalAssignedTasks: user._count.assignedTasks,
          totalGPSSessions: user._count.gpsSessions
        },
        timestamps: {
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          lastLoginAt: user.lastLoginAt
        }
      },
      authMethod,
      timestamp: new Date().toISOString()
    }

    // Add session data if available
    if (sessionData) {
      responseData.session = sessionData
    }

    return NextResponse.json({
      success: true,
      data: responseData
    })

    } catch (error) {
    console.error('Get current user error:', error)

    return NextResponse.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Failed to retrieve user information'
    }, { status: 500 })
  }
}
