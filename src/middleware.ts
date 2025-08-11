import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export default withAuth(
  function middleware(req) {
    // Annotate Sentry user if available in middleware
    try {
      const reqAny = req as unknown as {
        nextauth?: { token?: { sub?: string; name?: string } };
      };
      const token = reqAny.nextauth?.token;
      if (token?.sub) {
        Sentry.setUser({
          id: token.sub as string,
          username: token?.name as string | undefined,
        });
      }
    } catch {}
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Define role-based access controls
    type UserRole = "ADMIN" | "LEAD_MR" | "MR";
    const roleBasedRoutes: Record<string, readonly UserRole[]> = {
      "/admin": ["ADMIN", "LEAD_MR"],
      "/lead-mr": ["ADMIN", "LEAD_MR"],
      "/dashboard": ["ADMIN", "LEAD_MR", "MR"],
    } as const;

    // Check role-based access
    for (const [route, allowedRoles] of Object.entries(roleBasedRoutes)) {
      const role = token?.role as UserRole | undefined;
      if (pathname.startsWith(route) && role) {
        if (!allowedRoles.includes(role)) {
          return NextResponse.redirect(new URL("/unauthorized", req.url));
        }
      }
    }

    // Handle role-based redirects after login
    if (pathname === "/dashboard" && token?.role) {
      const role = token.role as string;

      switch (role) {
        case "ADMIN":
          return NextResponse.redirect(new URL("/admin", req.url));
        case "LEAD_MR":
          return NextResponse.redirect(new URL("/admin", req.url));
        case "MR":
          return NextResponse.redirect(new URL("/dashboard/mr", req.url));
        default:
          return NextResponse.redirect(new URL("/login", req.url));
      }
    }

    try {
      return NextResponse.next();
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;

        // Allow access to public routes
        const publicRoutes = [
          "/",
          "/login",
          "/api/health",
          "/api/db-test",
          "/unauthorized",
        ];

        if (publicRoutes.some((route) => pathname === route)) {
          return true;
        }

        // Allow access to API routes that don't require auth
        const publicApiRoutes = [
          "/api/health",
          "/api/db-test",
          "/api/auth",
          "/api/seed",
        ];

        if (publicApiRoutes.some((route) => pathname.startsWith(route))) {
          return true;
        }

        // Allow all other API routes to handle their own authentication
        // (they support both session and JWT authentication)
        if (pathname.startsWith("/api/")) {
          return true;
        }

        // Require NextAuth session authentication for non-API routes (web pages)
        return !!token;
      },
    },
    pages: {
      signIn: "/login",
      error: "/login",
    },
  }
);

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
    "/((?!api/auth|api/health|api/db-test|api/seed|_next/static|_next/image|favicon.ico).*)",
  ],
};
