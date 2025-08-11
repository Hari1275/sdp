import { successResponse } from "@/lib/api-utils";

// Simple index route to describe available report endpoints
export async function GET() {
  return successResponse({
    endpoints: {
      overview: "/api/reports/overview",
      // userPerformance: '/api/reports/user-performance',
      // regionalPerformance: '/api/reports/regional-performance',
      // clientActivity: '/api/reports/client-activity',
      // gpsTracking: '/api/reports/gps-tracking',
      // taskCompletion: '/api/reports/task-completion',
      // export: '/api/reports/export',
      // schedules: '/api/reports/schedules',
    },
  });
}
