import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { comparePasswords } from '@/lib/password'
import { sign } from 'jsonwebtoken'
import { z } from 'zod'
import { 
  errorResponse, 
  successResponse, 
  validateRequest, 
  rateLimit 
} from '@/lib/api-utils'

// Validation schema for login request
const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

type LoginRequest = z.infer<typeof loginSchema>

// Generate JWT token for mobile authentication
interface UserForToken {
  id: string
  username: string
  email?: string | null
  name: string
  role: string
  status: string
  regionId?: string | null
  leadMrId?: string | null
  phone?: string | null
}

function generateMobileToken(user: UserForToken) {
  const payload = {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    regionId: user.regionId,
    leadMrId: user.leadMrId,
    phone: user.phone,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
  }

  const secret = process.env.NEXTAUTH_SECRET || 'fallback-secret-for-development'
  return sign(payload, secret)
}

// POST /api/auth/mobile/login - Mobile login endpoint
export async function POST(request: NextRequest) {
  try {
    // Read request body first to allow composite keying (IP + username)
    const body = await request.json()

    // Rate limiting (10 requests per 15 minutes per IP+username; falls back to IP if username missing)
    const keySuffix = typeof body?.username === 'string' ? body.username : undefined
    if (!rateLimit(request, 10, 15 * 60 * 1000, keySuffix)) {
      return errorResponse(
        'RATE_LIMIT_EXCEEDED',
        'Too many login attempts. Please try again later.',
        429
      )
    }

    // Validate request body
    const validation = validateRequest(loginSchema, body)
    
    if (!validation.success) {
      return errorResponse('VALIDATION_ERROR', validation.error, 400)
    }

    const { username, password } = validation.data as LoginRequest

    // Find user by username
    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        region: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        leadMr: {
          select: {
            id: true,
            name: true,
            username: true
          }
        },
        teamMembers: {
          select: {
            id: true,
            name: true,
            username: true,
            role: true,
            status: true
          },
          where: {
            status: 'ACTIVE'
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

    if (!user) {
      return errorResponse(
        'INVALID_CREDENTIALS',
        'Invalid username or password',
        401
      )
    }

    // Check if user account is active
    if (user.status !== 'ACTIVE') {
      return errorResponse(
        'ACCOUNT_INACTIVE',
        'Your account has been deactivated. Please contact your administrator.',
        403
      )
    }

    // Verify password
    const isPasswordValid = await comparePasswords(password, user.password)
    if (!isPasswordValid) {
      return errorResponse(
        'INVALID_CREDENTIALS',
        'Invalid username or password',
        401
      )
    }

    // Update last login time
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    })

    // Generate JWT token for mobile
    const token = generateMobileToken(user)

    // Prepare user data (without password)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...userWithoutPassword } = user
    const userData = {
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
        lastLoginAt: new Date()
      }
    }

    // Return success response with token and user data
    return successResponse({
      token,
      tokenType: 'Bearer',
      expiresIn: 86400, // 24 hours in seconds
      user: userData
    }, 'Login successful')

  } catch {
  // console.error('Mobile login error:', error)
    return errorResponse(
      'INTERNAL_ERROR',
      'An error occurred during login',
      500
    )
  }
}

// GET /api/auth/mobile/login - Return login endpoint information
export async function GET() {
  return successResponse({
    endpoint: '/api/auth/mobile/login',
    method: 'POST',
    description: 'Mobile authentication endpoint',
    requiredFields: ['username', 'password'],
    responseFormat: {
      success: true,
      data: {
        token: 'JWT_TOKEN_HERE',
        tokenType: 'Bearer',
        expiresIn: 86400,
        user: {
          id: 'string',
          username: 'string',
          name: 'string',
          email: 'string',
          role: 'MR | LEAD_MR | ADMIN',
          status: 'ACTIVE | INACTIVE | SUSPENDED',
          region: 'object | null',
          leadMr: 'object | null',
          teamMembers: 'array',
          statistics: 'object',
          timestamps: 'object'
        }
      }
    }
  })
}
