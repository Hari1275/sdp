import * as Sentry from "@sentry/nextjs";

// Next.js client instrumentation
export function register() {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    profilesSampleRate: 0.0,
  });
}

// Required by @sentry/nextjs to instrument navigations in the App Router
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
