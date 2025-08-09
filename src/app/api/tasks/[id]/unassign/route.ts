import { NextRequest } from "next/server";
import {
  getAuthenticatedUser,
  errorResponse,
  rateLimit,
} from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  if (!rateLimit(request))
    return errorResponse(
      "RATE_LIMIT_EXCEEDED",
      "Too many requests. Please try again later.",
      429
    );

  const user = await getAuthenticatedUser(request);
  if (!user)
    return errorResponse("UNAUTHORIZED", "Authentication required", 401);

  return errorResponse(
    "VALIDATION_ERROR",
    "Unassigning a task is not supported in the current schema. Please reassign the task instead."
  );
}
