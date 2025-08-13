// Core API Response Types
export interface APIResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// User Types
export interface UserProfile {
  id: string
  username: string
  email?: string
  name: string
  phone?: string
  role: 'MR' | 'LEAD_MR' | 'ADMIN'
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  region?: {
    id: string
    name: string
  }
  leadMr?: {
    id: string
    name: string
  }
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
}

// Geographic Types
export interface Region {
  id: string
  name: string
  description?: string
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: string
  updatedAt: string
  _count?: {
    areas: number
    users: number
    clients: number
  }
}

export interface Area {
  id: string
  name: string
  description?: string
  regionId: string
  region: {
    id: string
    name: string
  }
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: string
  updatedAt: string
  _count?: {
    clients: number
    tasks: number
  }
}

// Client Types
export interface Client {
  id: string
  name: string
  phone?: string
  businessType: 'CLINIC' | 'MEDICAL_STORE' | 'HOSPITAL' | 'PHARMACY' | 'HEALTHCARE_CENTER'
  areaId: string
  regionId: string
  mrId: string
  area: {
    id: string
    name: string
  }
  region: {
    id: string
    name: string
  }
  latitude: number
  longitude: number
  address?: string
  notes?: string
  mr: {
    id: string
    name: string
  }
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: string
  updatedAt: string
  _count?: {
    businessEntries: number
  }
}

// Business Entry Types
export interface BusinessEntry {
  id: string
  amount: number
  notes?: string
  client: {
    id: string
    name: string
    businessType: string
  }
  mr: {
    id: string
    name: string
  }
  latitude: number
  longitude: number
  createdAt: string
  updatedAt: string
}

// Task Types
export interface Task {
  id: string
  title: string
  description?: string
  region: {
    id: string
    name: string
  }
  area?: {
    id: string
    name: string
  }
  assignee: {
    id: string
    name: string
    username: string
    leadMr?: {
      id: string
      name: string
    }
  }
  createdBy: {
    id: string
    name: string
  }
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  dueDate?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
}

// GPS Tracking Types
export interface GPSSession {
  id: string
  mr: {
    id: string
    name: string
  }
  checkInTime: string
  checkOutTime?: string
  totalHours?: number
  totalKms?: number
  status: 'ACTIVE' | 'COMPLETED' | 'INTERRUPTED'
  createdAt: string
  updatedAt: string
  _count?: {
    gpsLogs: number
  }
}

export interface GPSLog {
  id: string
  sessionId: string
  latitude: number
  longitude: number
  accuracy?: number
  speed?: number
  timestamp: string
}

// Notification Types
export interface Notification {
  id: string
  title: string
  message: string
  type: 'INFO' | 'TASK_ASSIGNMENT' | 'TASK_UPDATE' | 'SYSTEM_ALERT' | 'WARNING'
  targetRole?: 'MR' | 'LEAD_MR' | 'ADMIN'
  targetUserId?: string
  isRead: boolean
  createdAt: string
  updatedAt: string
}

// Report Types
export interface DailySummary {
  id: string
  mrId: string
  date: string
  totalVisits: number
  totalBusiness: number
  totalKms: number
  totalHours: number
  checkInCount: number
  mr?: {
    id: string
    name: string
    username: string
  }
}

export interface PerformanceMetrics {
  totalUsers: number
  activeUsers: number
  totalClients: number
  totalRegions: number
  totalAreas: number
  todayVisits: number
  todayBusiness: number
  monthlyGrowth: {
    visits: number
    business: number
  }
}

// Chart Data Types
export interface ChartDataPoint {
  date: string
  visits: number
  business: number
  kilometers?: number
  hours?: number
}

export interface MapDataPoint {
  id: string
  name: string
  latitude: number
  longitude: number
  type: 'client' | 'mr' | 'gps_log'
  status?: string
  metadata?: Record<string, unknown>
}

// Dashboard Types
export interface DashboardStats {
  totalUsers: number
  activeUsers: number
  totalClients: number
  totalTasks: number
  pendingTasks: number
  completedTasks: number
  todayVisits: number
  todayBusiness: number
  totalRegions: number
  totalAreas: number
}

// Form State Types
export interface FormState {
  loading: boolean
  error?: string
  success?: boolean
}

// Filter Types
export interface DateRange {
  from: Date
  to: Date
}

export interface TableColumn<T = unknown> {
  key: keyof T
  title: string
  sortable?: boolean
  render?: (value: unknown, row: T) => React.ReactNode
}

// Navigation Types
export interface NavItem {
  title: string
  href: string
  icon?: React.ComponentType<{ className?: string }>
  badge?: string | number
  children?: NavItem[]
}

// Error Types
export interface FormError {
  field: string
  message: string
}

export interface APIError {
  code: string
  message: string
  details?: Record<string, unknown>
}

// Search and Filter Types
export interface SearchParams {
  q?: string
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  [key: string]: unknown
}
