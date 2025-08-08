import { UserRole } from '@prisma/client'

// Extended user type for authenticated requests
export interface AuthenticatedUser {
  id: string
  username: string
  name: string
  email?: string | null
  phone?: string | null
  role: UserRole
  status: string
  regionId?: string | null
  leadMrId?: string | null
  createdAt: Date
  updatedAt: Date
  lastLoginAt?: Date | null
  region?: {
    id: string
    name: string
  } | null
  leadMr?: {
    id: string
    name: string
  } | null
}

// API handler types
export interface ApiContext {
  params?: Record<string, string>
}

export interface ApiHandler {
  (request: Request, user: AuthenticatedUser, context?: ApiContext): Promise<Response>
}

// Query parameters type
export interface QueryParams {
  [key: string]: string | number | boolean | undefined
}

// Filter types for role-based access
export interface FilterWhere {
  [key: string]: unknown
  OR?: Array<Record<string, unknown>>
  AND?: Array<Record<string, unknown>>
}
