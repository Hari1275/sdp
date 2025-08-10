import * as Sentry from "@sentry/nextjs";

// Next.js instrumentation file for server and edge runtimes
export async function register() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  });
}

// Capture server render errors from nested RSCs
export const onRequestError = Sentry.captureRequestError;
