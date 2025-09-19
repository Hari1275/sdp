import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logError } from './api-utils';
import { randomUUID } from 'crypto';

// Initialize S3 client
console.log('[S3Utils] Initializing S3 client with config:', {
  region: process.env.AWS_DEFAULT_REGION,
  bucket: process.env.S3_BUCKET,
  hasAccessKey: !!process.env.ACCESS_KEY_ID,
  hasSecretKey: !!process.env.SECRET_ACCESS_KEY
});

const s3Client = new S3Client({
  region: process.env.AWS_DEFAULT_REGION!,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID!,
    secretAccessKey: process.env.SECRET_ACCESS_KEY!,
  },
});

// The S3 bucket name
const BUCKET_NAME = process.env.S3_BUCKET!;

// Common domain for S3 URLs
export const S3_BASE_URL = `https://${BUCKET_NAME}.s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com`;

// Returns only the path part after the bucket name
export function getRelativePath(fullPath: string): string {
  try {
    // If it's already a relative path (no https:// or bucket name), return as is
    if (!fullPath.includes('http') && !fullPath.includes(BUCKET_NAME)) {
      return fullPath;
    }
    
    // Extract path after bucket name
    const pathMatch = fullPath.match(new RegExp(`${BUCKET_NAME}/(.+)$`));
    return pathMatch ? pathMatch[1] : fullPath;
  } catch (error) {
    console.error('[S3Utils] Error parsing S3 path:', error);
    return fullPath;
  }
}

// Debug helper to safely stringify S3 command inputs without dumping buffers
function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj, (key, value) => {
      if (key === 'Body') return `[Buffer ${value?.length ?? ''}]`;
      return value;
    }, 2);
  } catch {
    return String(obj);
  }
}

/**
 * Upload a file to S3
 * @param file The file buffer to upload
 * @param originalFilename Original filename to use for content type detection
 * @param prefix Optional folder prefix
 * @returns The relative path of the uploaded file (without domain)
 */
export async function uploadToS3(
  file: Buffer,
  originalFilename: string,
  prefix: string = ''
): Promise<string> {
  try {
    console.log('[S3Utils] Upload start', {
      bucket: BUCKET_NAME,
      prefix,
      originalFilename,
      fileSize: file.length
    });

    // Generate a unique filename while preserving the original extension
    const ext = originalFilename.split('.').pop() || '';
    const uniqueFilename = `${randomUUID()}.${ext}`;
    console.log('[S3Utils] Generated filename', { uniqueFilename, ext });
    
    // Create the full key (path) in S3
    const key = prefix ? `${prefix}/${uniqueFilename}` : uniqueFilename;
    console.log('[S3Utils] Final key', { key });

    // Determine content type based on file extension
    const contentType = getContentType(ext);
    console.log('[S3Utils] Content type', { contentType });

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file,
      ContentType: contentType,
    });

    console.log('[S3Utils] Sending PutObject', safeStringify(command.input));
    const result = await s3Client.send(command);
    console.log('[S3Utils] PutObject result', safeStringify(result));

    // Return the relative path (without domain)
    return key;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[S3Utils] Upload error', { message: err.message, stack: err.stack });
    logError(error, 'uploadToS3');
    throw new Error('Failed to upload file to S3');
  }
}

/**
 * Get a signed URL for an S3 object
 * @param key The object key (path) in S3
 * @param expiresIn Expiration time in seconds (default: 3600)
 * @returns Signed URL for the object
 */
export async function getSignedS3Url(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  try {
    console.log('[S3Utils] Get signed URL start', { key, expiresIn });
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    console.log('[S3Utils] Signed URL generated');
    return url;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[S3Utils] Signed URL error', { message: err.message, stack: err.stack, key });
    logError(error, 'getSignedS3Url');
    throw new Error('Failed to generate signed URL');
  }
}

/**
 * Get content type based on file extension
 */
function getContentType(ext: string): string {
  const contentTypes: { [key: string]: string } = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'pdf': 'application/pdf',
  };

  return contentTypes[ext.toLowerCase()] || 'application/octet-stream';
}