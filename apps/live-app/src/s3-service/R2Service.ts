// Cloudflare R2 Service for Cloud Storage Integration
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3_CONFIG_DEFAULTS, S3ServiceError, S3ErrorCode } from './S3Types';

/**
 * Configuration for Cloudflare R2 client
 * Credentials should be stored securely in environment variables
 */
export interface R2Config {
  accountId: string;           // Cloudflare account ID
  accessKeyId: string;         // R2 access key ID
  secretAccessKey: string;     // R2 secret access key
  bucketName: string;          // R2 bucket name
  endpoint?: string;           // Optional custom endpoint
}

/**
 * R2Service - Cloudflare R2 cloud storage integration
 *
 * Provides S3-compatible cloud storage with zero egress fees.
 * Uses AWS SDK v3 with Cloudflare R2 endpoints.
 *
 * Features:
 * - Presigned URL generation for secure uploads/downloads
 * - Object existence checks
 * - Object deletion
 * - Error handling with automatic fallback support
 */
export class R2Service {
  private client: S3Client;
  private bucketName: string;
  private isAvailable: boolean = false;

  constructor(config: R2Config) {
    this.bucketName = config.bucketName;

    // Construct R2 endpoint URL
    const endpoint = config.endpoint ||
      `https://${config.accountId}.r2.cloudflarestorage.com`;

    try {
      // Initialize S3 client with R2 configuration
      this.client = new S3Client({
        region: 'auto',  // R2 uses automatic region routing
        endpoint,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });

      this.isAvailable = true;
      console.log('[R2Service] Initialized successfully');
    } catch (error) {
      console.error('[R2Service] Failed to initialize:', error);
      this.isAvailable = false;
    }
  }

  /**
   * Check if R2 service is available and properly configured
   */
  isServiceAvailable(): boolean {
    return this.isAvailable;
  }

  /**
   * Generate presigned URL for file upload
   *
   * @param objectKey - S3 object key (file identifier)
   * @param contentType - MIME type of the file
   * @param expiresIn - URL expiration time in seconds (default: 15 minutes)
   * @returns Presigned upload URL
   */
  async generateUploadURL(
    objectKey: string,
    contentType: string,
    expiresIn: number = 900  // 15 minutes for uploads
  ): Promise<string> {
    if (!this.isAvailable) {
      throw new S3ServiceError(
        'R2 service not available',
        S3ErrorCode.SERVER_ERROR,
        503
      );
    }

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
        ContentType: contentType,
      });

      const signedUrl = await getSignedUrl(this.client, command, { expiresIn });

      console.log('[R2Service] Upload URL generated', {
        objectKey,
        expiresIn
      });

      return signedUrl;
    } catch (error) {
      console.error('[R2Service] Failed to generate upload URL:', error);
      throw new S3ServiceError(
        `Failed to generate R2 upload URL: ${(error as Error).message}`,
        S3ErrorCode.PRESIGNED_URL_ERROR,
        500
      );
    }
  }

  /**
   * Generate presigned URL for file download
   *
   * @param objectKey - S3 object key (file identifier)
   * @param expiresIn - URL expiration time in seconds (default: 1 hour)
   * @returns Presigned download URL
   */
  async generateDownloadURL(
    objectKey: string,
    expiresIn: number = S3_CONFIG_DEFAULTS.DEFAULT_EXPIRY  // 1 hour
  ): Promise<string> {
    if (!this.isAvailable) {
      throw new S3ServiceError(
        'R2 service not available',
        S3ErrorCode.SERVER_ERROR,
        503
      );
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
      });

      const signedUrl = await getSignedUrl(this.client, command, { expiresIn });

      console.log('[R2Service] Download URL generated', {
        objectKey,
        expiresIn
      });

      return signedUrl;
    } catch (error) {
      console.error('[R2Service] Failed to generate download URL:', error);
      throw new S3ServiceError(
        `Failed to generate R2 download URL: ${(error as Error).message}`,
        S3ErrorCode.PRESIGNED_URL_ERROR,
        500
      );
    }
  }

  /**
   * Check if object exists in R2 storage
   *
   * @param objectKey - S3 object key to check
   * @returns True if object exists, false otherwise
   */
  async checkObjectExists(objectKey: string): Promise<boolean> {
    if (!this.isAvailable) {
      return false;
    }

    try {
      await this.client.send(new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
      }));

      console.log('[R2Service] Object exists', { objectKey });
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        console.log('[R2Service] Object not found', { objectKey });
        return false;
      }

      console.error('[R2Service] Error checking object existence:', error);
      throw error;
    }
  }

  /**
   * Delete object from R2 storage
   *
   * @param objectKey - S3 object key to delete
   */
  async deleteObject(objectKey: string): Promise<void> {
    if (!this.isAvailable) {
      throw new S3ServiceError(
        'R2 service not available',
        S3ErrorCode.SERVER_ERROR,
        503
      );
    }

    try {
      await this.client.send(new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
      }));

      console.log('[R2Service] Object deleted', { objectKey });
    } catch (error) {
      console.error('[R2Service] Failed to delete object:', error);
      throw new S3ServiceError(
        `Failed to delete R2 object: ${(error as Error).message}`,
        S3ErrorCode.SERVER_ERROR,
        500
      );
    }
  }

  /**
   * Get object metadata without downloading the file
   *
   * @param objectKey - S3 object key
   * @returns Object metadata including size, content-type, last-modified
   */
  async getObjectMetadata(objectKey: string): Promise<{
    size: number;
    contentType: string;
    lastModified: Date;
    etag: string;
  }> {
    if (!this.isAvailable) {
      throw new S3ServiceError(
        'R2 service not available',
        S3ErrorCode.SERVER_ERROR,
        503
      );
    }

    try {
      const response = await this.client.send(new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: objectKey,
      }));

      return {
        size: response.ContentLength || 0,
        contentType: response.ContentType || 'application/octet-stream',
        lastModified: response.LastModified || new Date(),
        etag: response.ETag || '',
      };
    } catch (error) {
      console.error('[R2Service] Failed to get object metadata:', error);
      throw new S3ServiceError(
        `Failed to get R2 object metadata: ${(error as Error).message}`,
        S3ErrorCode.OBJECT_NOT_FOUND,
        404
      );
    }
  }
}
