import { NextRequest } from 'next/server'
import { 
  extractTokenFromRequest,
  verifyMobileToken,
  generateMobileToken,
  JWTError 
} from '@/lib/jwt'
import { prisma } from '@/lib/prisma'
import { 
  errorResponse, 
  successResponse, 
  rateLimit 
} from '@/lib/api-utils'

// POST /api/auth/mobile/refresh - Refresh JWT token
export async function POST(request: NextRequest) {
  try {
    // Rate limiting - more generous for refresh requests
    if (!rateLimit(request, 20, 15 * 60 * 1000)) { // 20 requests per 15 minutes
      return errorResponse(
        'RATE_LIMIT_EXCEEDED',
        'Too many refresh attempts. Please try again later.',
        429
      )
    }

    // Extract current token
    const currentToken = extractTokenFromRequest(request)
    if (!currentToken) {
      return errorResponse(
        'MISSING_TOKEN',
        'Authorization token is required',
        401
      )
    }

    // Verify current token (even if expired, we'll check manually)
    let payload
    try {
      payload = verifyMobileToken(currentToken)
    } catch (error) {
      if (error instanceof JWTError) {
        // Allow token refresh even for expired tokens, but not for invalid tokens
        if (error.code === 'TOKEN_EXPIRED') {
          // Extract payload manually for expired token
          const { decode } = await import('jsonwebtoken')
          try {
            payload = decode(currentToken)
          } catch {
            return errorResponse(
              'INVALID_TOKEN',
              'Cannot refresh invalid token',
              401
            )
          }
        } else {
          return errorResponse(
            error.code,
            error.message,
            401
          )
        }
      } else {
        return errorResponse(
          'TOKEN_ERROR',
          'Token verification failed',
          401
        )
      }
    }

    if (!payload || typeof payload === 'string' || !payload.id) {
      return errorResponse(
        'INVALID_TOKEN_PAYLOAD',
        'Invalid token data',
        401
      )
    }

    // Get fresh user data from database
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
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
        'USER_NOT_FOUND',
        'User account no longer exists',
        404
      )
    }

    if (user.status !== 'ACTIVE') {
      return errorResponse(
        'ACCOUNT_INACTIVE',
        'User account has been deactivated',
        403
      )
    }

    // Generate new token with fresh user data
    const newToken = generateMobileToken(user)

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
      }
    }

    return successResponse({
      token: newToken,
      tokenType: 'Bearer',
      expiresIn: 86400, // 24 hours in seconds
      user: userData
    }, 'Token refreshed successfully')

  } catch (error) {
    console.error('Token refresh error:', error)
    return errorResponse(
      'INTERNAL_ERROR',
      'An error occurred during token refresh',
      500
    )
  }
}

// GET /api/auth/mobile/refresh - Return refresh endpoint information
export async function GET() {
  return successResponse({
    endpoint: '/api/auth/mobile/refresh',
    method: 'POST',
    description: 'Refresh JWT token for mobile authentication',
    headers: {
      'Authorization': 'Bearer YOUR_CURRENT_TOKEN'
    },
    responseFormat: {
      success: true,
      data: {
        token: 'NEW_JWT_TOKEN_HERE',
        tokenType: 'Bearer',
        expiresIn: 86400,
        user: {
          // Updated user data
        }
      }
    }
  })
}
