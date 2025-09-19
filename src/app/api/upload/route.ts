import { NextRequest } from 'next/server';
import { UserRole } from '@prisma/client';
import {
  getAuthenticatedUser,
  hasPermission,
  successResponse,
  errorResponse,
  logError,
  rateLimit,
} from '@/lib/api-utils';
import { uploadToS3, S3_BASE_URL } from '@/lib/s3-utils';

// Helper to mask sensitive tokens in logs
function maskToken(token?: string | null) {
  if (!token) return 'none';
  try {
    const t = token.replace(/^Bearer\s+/i, '');
    if (t.length <= 8) return '****';
    return `${t.slice(0, 4)}****${t.slice(-4)}`;
  } catch {
    return '****';
  }
}

// Maximum file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed file types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

/**
 * POST /api/upload - Upload file to S3
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const startedAt = Date.now();
  const authHeader = request.headers.get('authorization');
  const contentType = request.headers.get('content-type');
  const ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  console.log('[Upload] Starting file upload request', {
    method: request.method,
    ip,
    contentType,
    hasAuth: !!authHeader,
    authMasked: maskToken(authHeader),
  });
  let user;

  try {
    // Rate limiting
    if (!rateLimit(request)) {
      return errorResponse(
        'RATE_LIMIT_EXCEEDED',
        'Too many requests. Please try again later.',
        429
      );
    }

    // Authentication
    user = await getAuthenticatedUser(request);
    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }

    // Authorization - Only MR, Lead MR, and Admin can upload files
    if (!hasPermission(user.role, [UserRole.ADMIN, UserRole.LEAD_MR, UserRole.MR])) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    }

    // Parse the multipart form data
    console.log('[Upload] User authenticated:', { id: user.id, name: user.name, role: user.role });
    
    const formData = await request.formData();
    console.log('[Upload] Received form data');
    console.log('[Upload] Form data parsed in:', Date.now() - startTime, 'ms');
    const keys = [] as string[];
    for (const [k] of formData.entries()) keys.push(k);
    console.log('[Upload] Form keys:', keys);
    const file = formData.get('file') as File;
    console.log('[Upload] Form data contents:', {
      hasFile: !!file,
      fileName: file?.name,
      fileType: file?.type,
      fileSize: file?.size
    });
    
    console.log('[Upload] File details:', {
      name: file?.name,
      type: file?.type,
      size: file?.size
    });

    if (!file) {
      console.log('[Upload] No file provided in form data');
      return errorResponse('VALIDATION_ERROR', 'No file provided');
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      console.log('[Upload] File too large:', { size: file.size, max: MAX_FILE_SIZE });
      return errorResponse('VALIDATION_ERROR', 'File size exceeds 5MB limit');
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      console.log('[Upload] Invalid file type:', { type: file.type, allowed: ALLOWED_TYPES });
      return errorResponse(
        'VALIDATION_ERROR',
        'Invalid file type. Allowed types: JPG, PNG, GIF, WebP, PDF'
      );
    }

    // Convert file to buffer
    console.log('[Upload] File validation passed');
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    console.log('[Upload] Derived extension:', ext);

    console.log('[Upload] Converting file to buffer...');
const fileBuffer = await file.arrayBuffer();
    console.log('[Upload] File converted to ArrayBuffer, size:', fileBuffer.byteLength);
    const buffer = Buffer.from(fileBuffer);
    console.log('[Upload] Buffer created, size:', buffer.length);
    console.log('[Upload] File converted to buffer');

    // Upload to S3 with prefix based on user role
    const prefix = `business/${user.role.toLowerCase()}`;
    console.log('[Upload] Using S3 prefix:', prefix);
    console.log('[Upload] Uploading to S3 with prefix:', prefix);
    const documentLink = await uploadToS3(buffer, file.name, prefix);
    console.log('[Upload] S3 upload successful, full URL:', `${S3_BASE_URL}/${documentLink}`);
    console.log('[Upload] File uploaded successfully, documentLink:', documentLink);
    console.log('[Upload] Total time ms:', Date.now() - startedAt);

    const responsePayload = {
      documentLink,
      message: 'File uploaded successfully'
    };
    console.log('[Upload] Responding with:', responsePayload);
    return successResponse(responsePayload);
  } catch (error) {
    console.error('[Upload] Error occurred:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timeTaken: Date.now() - startTime
    });
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[Upload] Error details:', { message: err.message, stack: err.stack });
    logError(error, 'POST /api/upload', user?.id);
    return errorResponse('INTERNAL_ERROR', 'Failed to upload file', 500);
  }
}