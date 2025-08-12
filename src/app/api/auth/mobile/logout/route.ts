import { NextRequest } from 'next/server'
import { 
  extractTokenFromRequest,
  verifyMobileToken,
  JWTError 
} from '@/lib/jwt'
import { prisma } from '@/lib/prisma'
import { 
  errorResponse, 
  successResponse, 
  rateLimit 
} from '@/lib/api-utils'

// POST /api/auth/mobile/logout - Mobile logout endpoint
export async function POST(request: NextRequest) {
  try {
    // Rate limiting (key by IP)
    if (!rateLimit(request, 20, 15 * 60 * 1000)) { // 20 requests per 15 minutes
      return errorResponse(
        'RATE_LIMIT_EXCEEDED',
        'Too many logout attempts. Please try again later.',
        429
      )
    }

    // Extract token (optional for logout)
    const token = extractTokenFromRequest(request)
    let userId: string | null = null

    if (token) {
      try {
        const payload = verifyMobileToken(token)
        userId = payload.id
        
        // Optional: Log the logout event
        // console.log(`User ${payload.username} (${userId}) logged out from mobile app`)
        
        // Optional: Update user's last activity or logout time
        await prisma.user.update({
          where: { id: userId },
          data: { 
            updatedAt: new Date()
            // You could add a lastLogoutAt field if needed
          }
        }).catch(() => {
          // Ignore errors - user might be deleted or database issue
          // But still allow successful logout response
        })

      } catch (error) {
        if (error instanceof JWTError) {
          // Even if token is invalid/expired, we can still "logout"
          // console.log('Logout attempt with invalid/expired token:', error.message)
        }
      }
    }

    // For mobile apps, logout is primarily client-side (removing the stored token)
    // Since we're using stateless JWT tokens, there's no server-side session to destroy
    // The client should delete the stored token from secure storage
    
    return successResponse({
      message: 'Logout successful',
      instructions: [
        'Remove the stored JWT token from your app\'s secure storage',
        'Clear any cached user data',
        'Redirect to the login screen'
      ]
    }, 'You have been successfully logged out')

  } catch {
  // console.error('Mobile logout error:', error)
    
    // Even if there's an error, we should allow logout to proceed
    // since it's primarily a client-side operation for JWT tokens
    return successResponse({
      message: 'Logout completed (with warnings)',
      instructions: [
        'Remove the stored JWT token from your app\'s secure storage',
        'Clear any cached user data',
        'Redirect to the login screen'
      ]
    }, 'Logout processed')
  }
}

// GET /api/auth/mobile/logout - Return logout endpoint information
export async function GET() {
  return successResponse({
    endpoint: '/api/auth/mobile/logout',
    method: 'POST',
    description: 'Mobile logout endpoint',
    headers: {
      'Authorization': 'Bearer YOUR_JWT_TOKEN (optional)'
    },
    notes: [
      'Logout for JWT tokens is primarily client-side',
      'Remove the token from secure storage after calling this endpoint',
      'The endpoint will log the logout event if a valid token is provided'
    ],
    responseFormat: {
      success: true,
      data: {
        message: 'Logout successful',
        instructions: [
          'Remove the stored JWT token from your app\'s secure storage',
          'Clear any cached user data',
          'Redirect to the login screen'
        ]
      }
    }
  })
}
