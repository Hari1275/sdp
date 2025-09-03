import { BusinessType } from "@prisma/client";
import { successResponse, errorResponse } from "@/lib/api-utils";

// GET /api/public/business-types - List business types (public endpoint for forms)
export async function GET() {
  try {
    // console.log('[PublicBusinessTypes] Fetching business types...');

    // Get all business type enum values
    const businessTypes = Object.values(BusinessType).map((type) => ({
      value: type,
      label: formatBusinessTypeLabel(type),
    }));

    // console.log('[PublicBusinessTypes] Found business types:', businessTypes.length);

    return successResponse(businessTypes);
  } catch (error) {
    console.error(
      "[PublicBusinessTypes] Error fetching business types:",
      error
    );
    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to fetch business types",
      500
    );
  }
}

// Helper function to format business type labels
function formatBusinessTypeLabel(type: BusinessType): string {
  switch (type) {
    case BusinessType.CLINIC:
      return "Clinic";
    case BusinessType.HOSPITAL:
      return "Hospital";
    case BusinessType.PHARMACY:
      return "Pharmacy";
    case BusinessType.MEDICAL_STORE:
      return "Medical Store";
    case BusinessType.HEALTHCARE_CENTER:
      return "Healthcare Center";
  }
}
