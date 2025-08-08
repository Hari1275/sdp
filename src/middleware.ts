import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // Define role-based access controls
    const roleBasedRoutes = {
      '/admin': ['ADMIN'],
      '/lead-mr': ['ADMIN', 'LEAD_MR'],
      '/dashboard': ['ADMIN', 'LEAD_MR', 'MR']
    }

    // Check role-based access
    for (const [route, allowedRoles] of Object.entries(roleBasedRoutes)) {
      if (pathname.startsWith(route) && token?.role) {
        if (!allowedRoles.includes(token.role as string)) {
          return NextResponse.redirect(new URL('/unauthorized', req.url))
        }
      }
    }

    // Handle role-based redirects after login
    if (pathname === '/dashboard' && token?.role) {
      const role = token.role as string
      
      switch (role) {
        case 'ADMIN':
          return NextResponse.redirect(new URL('/admin', req.url))
        case 'LEAD_MR':
          return NextResponse.redirect(new URL('/lead-mr', req.url))
        case 'MR':
          return NextResponse.redirect(new URL('/dashboard/mr', req.url))
        default:
          return NextResponse.redirect(new URL('/login', req.url))
      }
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname

        // Allow access to public routes
        const publicRoutes = [
          '/',
          '/login',
          '/api/health',
          '/api/db-test',
          '/unauthorized'
        ]

        if (publicRoutes.some(route => pathname === route)) {
          return true
        }

        // Allow access to API routes that don't require auth
        const publicApiRoutes = [
          '/api/health',
          '/api/db-test',
          '/api/auth',
          '/api/seed'
        ]

        if (publicApiRoutes.some(route => pathname.startsWith(route))) {
          return true
        }

        // Allow all other API routes to handle their own authentication
        // (they support both session and JWT authentication)
        if (pathname.startsWith('/api/')) {
          return true
        }

        // Require NextAuth session authentication for non-API routes (web pages)
        return !!token
      },
    },
    pages: {
      signIn: '/login',
      error: '/login',
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth.js routes)
     * - api/health (health check)
     * - api/db-test (database testing)
     * - api/seed (development seeding)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/auth|api/health|api/db-test|api/seed|_next/static|_next/image|favicon.ico).*)',
  ],
}
