import type { NextConfig } from "next";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - type augmentation provided by @sentry/nextjs
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply CORS headers to all API routes
        source: "/api/(.*)",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value:
              process.env.NODE_ENV === "development"
                ? "*" // Allow all origins in development
                : process.env.ALLOWED_ORIGINS ||
                  "https://your-production-domain.com",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "Content-Type, Authorization, X-Requested-With, Accept, Origin",
          },
          {
            key: "Access-Control-Allow-Credentials",
            value: "true",
          },
          {
            key: "Access-Control-Max-Age",
            value: "86400", // 24 hours
          },
        ],
      },
    ];
  },
};

const sentryWebpackPluginOptions = {
  // Suppress tunnel warnings if not using tunnels
  silent: true,
};

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - wrapper returns compatible config
export default withSentryConfig(nextConfig, sentryWebpackPluginOptions);
