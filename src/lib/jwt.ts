import { verify, sign, JwtPayload } from 'jsonwebtoken'
import { NextRequest } from 'next/server'
import { prisma } from './prisma'

interface MobileTokenPayload extends JwtPayload {
  id: string
  username: string
  email: string
  name: string
  role: string
  status: string
  regionId?: string
  leadMrId?: string
  phone?: string
}

export class JWTError extends Error {
  constructor(message: string, public code: string) {
    super(message)
    this.name = 'JWTError'
  }
}

// Verify JWT token from Authorization header
export function verifyMobileToken(token: string): MobileTokenPayload {
  try {
    const secret = process.env.NEXTAUTH_SECRET || 'fallback-secret-for-development'
    const payload = verify(token, secret) as MobileTokenPayload
    
    if (!payload.id || !payload.username || !payload.role) {
      throw new JWTError('Invalid token payload', 'INVALID_PAYLOAD')
    }

    return payload
  } catch (error) {
    if (error instanceof JWTError) {
      throw error
    }
    
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        throw new JWTError('Token has expired', 'TOKEN_EXPIRED')
      }
      if (error.name === 'JsonWebTokenError') {
        throw new JWTError('Invalid token', 'INVALID_TOKEN')
      }
    }
    
    throw new JWTError('Token verification failed', 'VERIFICATION_FAILED')
  }
}

// Extract JWT token from Authorization header
export function extractTokenFromRequest(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization')
  
  if (!authorization) {
    return null
  }

  const parts = authorization.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null
  }

  return parts[1]
}

// Get authenticated user from JWT token
export async function getAuthenticatedUserFromToken(token: string) {
  try {
    const payload = verifyMobileToken(token)
    
    // Get fresh user data from database
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      include: {
        region: true,
        leadMr: true,
      }
    })

    if (!user) {
      throw new JWTError('User not found', 'USER_NOT_FOUND')
    }

    if (user.status !== 'ACTIVE') {
      throw new JWTError('User account is inactive', 'USER_INACTIVE')
    }

    return user
  } catch (error) {
    if (error instanceof JWTError) {
      throw error
    }
    throw new JWTError('User authentication failed', 'AUTH_FAILED')
  }
}

// Enhanced authentication helper that supports both session and JWT
export async function getAuthenticatedUserEnhanced(request: NextRequest) {
  try {
    // First try JWT token from Authorization header (for mobile)
    const jwtToken = extractTokenFromRequest(request)
    if (jwtToken) {
      return await getAuthenticatedUserFromToken(jwtToken)
    }

    // Fallback to session-based authentication (for web)
    const { getServerSession } = await import('next-auth')
    const { authOptions } = await import('./auth')
    
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return null
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        region: true,
        leadMr: true,
      }
    })

    return user
  } catch (error) {
    console.error('Enhanced authentication error:', error)
    return null
  }
}

// Refresh JWT token
export function refreshMobileToken(payload: MobileTokenPayload): string {
  const newPayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
  }

  const secret = process.env.NEXTAUTH_SECRET || 'fallback-secret-for-development'
  return sign(newPayload, secret)
}

// Generate new mobile token
export function generateMobileToken(user: any): string {
  const payload: MobileTokenPayload = {
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
