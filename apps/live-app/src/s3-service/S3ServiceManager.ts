// S3 Service Manager - Core class with modular functions for S3 operations
// Following Context7 AWS SDK patterns and existing live-app architecture

import * as os from 'os';
import * as path from 'path';
import {
  FileMetadata,
  S3Config,
  StorageType,
  PresignedURLOptions,
  GenerateUploadURLRequest,
  GenerateUploadURLResponse,
  GenerateDownloadURLRequest,
  GenerateDownloadURLResponse,
  MetadataResponse,
  S3ServiceState,
  S3ErrorCode,
  S3ServiceError,
  S3_CONFIG_DEFAULTS,
  ServiceMethodResult
} from './S3Types';
import {
  ObjectKeyUtils,
  URLUtils,
  FileSystemUtils,
  MetadataStoreUtils,
  TimeUtils,
  ValidationUtils,
  ErrorUtils
} from './S3Utils';

/**
 * Core S3 Service Manager class
 * Provides modular functions for S3-compatible operations with both local and cloud storage
 */
export class S3ServiceManager {
  private baseDir: string;
  private metadataDir: string;
  private config: S3Config;
  private metadataCache: Map<string, FileMetadata>;

  constructor(baseDir?: string) {
    // Use same base directory pattern as existing FileProcessingService
    this.baseDir = baseDir || path.join(os.homedir(), '.neutralbase');
    this.metadataDir = path.join(this.baseDir, S3_CONFIG_DEFAULTS.METADATA_DIR_NAME);

    // Initialize configuration with defaults
    this.config = {
      localEndpoint: S3_CONFIG_DEFAULTS.LOCAL_ENDPOINT,
      credentials: S3_CONFIG_DEFAULTS.LOCAL_CREDENTIALS,
      bucketName: S3_CONFIG_DEFAULTS.DEFAULT_BUCKET
    };

    // In-memory cache for frequently accessed metadata
    this.metadataCache = new Map();

    // Ensure metadata directory exists
    this.initializeMetadataStore();
  }

  // =====================================================================
  // Section: Main Functions (Core API that Yasin needs)
  // =====================================================================

  /**
   * Main function that Yasin mentioned - get presigned download URL for object key
   * This is the primary function for retrieving download URLs
   */
  async getPresignedDownloadURLObjectKey(objectKey: string): Promise<string> {
    try {
      if (!ObjectKeyUtils.isValidObjectKey(objectKey)) {
        throw ErrorUtils.createError(
          `Invalid object key format: ${objectKey}`,
          S3ErrorCode.INVALID_OBJECT_KEY,
          400,
          objectKey
        );
      }

      // Load metadata to determine storage type and get file info
      const metadata = await this.loadObjectMetadata(objectKey);
      if (!metadata) {
        throw ErrorUtils.createError(
          `Object not found: ${objectKey}`,
          S3ErrorCode.OBJECT_NOT_FOUND,
          404,
          objectKey
        );
      }

      // Generate presigned URL based on storage type
      const result = await this.generatePresignedDownloadURL(objectKey, metadata.storageType);

      if (!result.success || !result.signedUrl) {
        throw ErrorUtils.createError(
          result.error || 'Failed to generate presigned URL',
          S3ErrorCode.PRESIGNED_URL_ERROR,
          500,
          objectKey
        );
      }

      return result.signedUrl;
    } catch (error) {
      const s3Error = ErrorUtils.toS3Error(error);
      console.error(`[S3ServiceManager] Error getting presigned download URL for ${objectKey}:`, s3Error.message);
      throw s3Error;
    }
  }

  /**
   * Generate presigned upload URL for new file upload
   */
  async generatePresignedUploadURL(
    filePath: string,
    storageType: StorageType
  ): Promise<GenerateUploadURLResponse> {
    try {
      // Validate inputs
      if (!ValidationUtils.isValidFilePath(filePath)) {
        return {
          success: false,
          error: 'Invalid file path provided'
        };
      }

      if (!ValidationUtils.isValidStorageType(storageType)) {
        return {
          success: false,
          error: 'Invalid storage type. Must be "local" or "cloud"'
        };
      }

      // Check if file exists
      if (!await FileSystemUtils.fileExists(filePath)) {
        return {
          success: false,
          error: `File not found: ${filePath}`
        };
      }

      // Generate object key and get file metadata
      const objectKey = ObjectKeyUtils.generateObjectKey(filePath);
      const fileStats = await FileSystemUtils.getFileMetadata(filePath);
      const mimeType = FileSystemUtils.getMimeType(fileStats.fileName || path.basename(filePath));

      // Create file metadata
      const metadata: FileMetadata = {
        objectKey,
        filePath: path.resolve(filePath),
        fileName: fileStats.fileName || path.basename(filePath),
        fileSize: fileStats.fileSize || 0,
        mimeType,
        createdAt: TimeUtils.getCurrentTimestamp(),
        lastModified: fileStats.lastModified || TimeUtils.getCurrentTimestamp(),
        storageType
      };

      // Save metadata to store
      await this.saveObjectMetadata(objectKey, metadata);

      // Generate presigned URL based on storage type
      const signedUrl = storageType === 'local'
        ? this.generateLocalUploadURL(objectKey)
        : await this.generateCloudUploadURL(objectKey, mimeType);

      return {
        success: true,
        signedUrl,
        objectKey
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[S3ServiceManager] Error generating upload URL:', errorMessage);

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Generate presigned download URL for existing object
   */
  async generatePresignedDownloadURL(
    objectKey: string,
    storageType?: StorageType
  ): Promise<GenerateDownloadURLResponse> {
    try {
      // Load metadata
      const metadata = await this.loadObjectMetadata(objectKey);
      if (!metadata) {
        return {
          success: false,
          error: `Object not found: ${objectKey}`
        };
      }

      // Use provided storage type or detect from metadata
      const targetStorageType = storageType || metadata.storageType;

      // Generate signed URL based on storage type
      const signedUrl = targetStorageType === 'local'
        ? this.generateLocalDownloadURL(objectKey)
        : await this.generateCloudDownloadURL(objectKey);

      return {
        success: true,
        signedUrl,
        metadata
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[S3ServiceManager] Error generating download URL:', errorMessage);

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Save object key and metadata to database/store
   */
  async saveObjectKeyToDatabase(objectKey: string, metadata: FileMetadata): Promise<void> {
    try {
      await this.saveObjectMetadata(objectKey, metadata);
      console.log(`[S3ServiceManager] Saved metadata for object key: ${objectKey}`);
    } catch (error) {
      const s3Error = ErrorUtils.toS3Error(error, S3ErrorCode.METADATA_STORE_ERROR);
      console.error(`[S3ServiceManager] Error saving object key ${objectKey}:`, s3Error.message);
      throw s3Error;
    }
  }

  // =====================================================================
  // Section: Public API Methods
  // =====================================================================

  /**
   * Get object metadata by key
   */
  async getObjectMetadata(objectKey: string): Promise<MetadataResponse> {
    try {
      const metadata = await this.loadObjectMetadata(objectKey);

      if (!metadata) {
        return {
          success: false,
          error: `Object not found: ${objectKey}`
        };
      }

      return {
        success: true,
        metadata
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Check if object exists in metadata store
   */
  async objectExists(objectKey: string): Promise<boolean> {
    try {
      const metadata = await this.loadObjectMetadata(objectKey);
      return metadata !== null;
    } catch {
      return false;
    }
  }

  /**
   * List all stored objects
   */
  async listObjects(): Promise<FileMetadata[]> {
    try {
      const metadataFiles = await MetadataStoreUtils.listMetadataFiles(this.metadataDir);
      const metadataList: FileMetadata[] = [];

      for (const file of metadataFiles) {
        const objectKey = path.basename(file, '.json');
        const metadata = await this.loadObjectMetadata(objectKey);
        if (metadata) {
          metadataList.push(metadata);
        }
      }

      return metadataList;
    } catch (error) {
      console.error('[S3ServiceManager] Error listing objects:', error);
      return [];
    }
  }

  /**
   * Delete object and its metadata
   */
  async deleteObject(objectKey: string): Promise<boolean> {
    try {
      const metadataPath = this.getMetadataPath(objectKey);
      await MetadataStoreUtils.deleteMetadata(metadataPath);
      this.metadataCache.delete(objectKey);

      console.log(`[S3ServiceManager] Deleted object: ${objectKey}`);
      return true;
    } catch (error) {
      console.error(`[S3ServiceManager] Error deleting object ${objectKey}:`, error);
      return false;
    }
  }

  /**
   * Get service state and statistics
   */
  getServiceState(): S3ServiceState {
    return {
      isLocalServerRunning: false, // Will be updated when server integration is added
      localServerPort: 9000,
      metadataStorePath: this.metadataDir,
      totalObjectsStored: this.metadataCache.size,
      lastActivity: TimeUtils.getCurrentTimestamp()
    };
  }

  // =====================================================================
  // Section: Private Helper Methods
  // =====================================================================

  /**
   * Initialize metadata store directory
   */
  private async initializeMetadataStore(): Promise<void> {
    try {
      await FileSystemUtils.ensureDirectory(this.metadataDir);
      console.log(`[S3ServiceManager] Initialized metadata store at: ${this.metadataDir}`);
    } catch (error) {
      console.error('[S3ServiceManager] Failed to initialize metadata store:', error);
      throw error;
    }
  }

  /**
   * Load object metadata from store with caching
   */
  private async loadObjectMetadata(objectKey: string): Promise<FileMetadata | null> {
    try {
      // Check cache first
      if (this.metadataCache.has(objectKey)) {
        return this.metadataCache.get(objectKey)!;
      }

      // Load from file
      const metadataPath = this.getMetadataPath(objectKey);
      const metadata = await MetadataStoreUtils.loadMetadata(metadataPath);

      // Cache if found
      if (metadata) {
        this.metadataCache.set(objectKey, metadata);
      }

      return metadata;
    } catch (error) {
      console.error(`[S3ServiceManager] Error loading metadata for ${objectKey}:`, error);
      return null;
    }
  }

  /**
   * Save object metadata to store with caching
   */
  private async saveObjectMetadata(objectKey: string, metadata: FileMetadata): Promise<void> {
    const metadataPath = this.getMetadataPath(objectKey);
    await MetadataStoreUtils.saveMetadata(metadataPath, metadata);

    // Update cache
    this.metadataCache.set(objectKey, metadata);
  }

  /**
   * Get metadata file path for object key
   */
  private getMetadataPath(objectKey: string): string {
    return path.join(this.metadataDir, `${objectKey}.json`);
  }

  /**
   * Generate local upload URL (for metadata storage)
   */
  private generateLocalUploadURL(objectKey: string): string {
    return URLUtils.buildLocalURL(`/upload-metadata/${objectKey}`);
  }

  /**
   * Generate local download URL (for metadata retrieval)
   */
  private generateLocalDownloadURL(objectKey: string): string {
    return URLUtils.buildLocalURL(`/download-metadata/${objectKey}`);
  }

  /**
   * Generate cloud upload URL (placeholder for future implementation)
   */
  private async generateCloudUploadURL(objectKey: string, contentType: string): Promise<string> {
    // TODO: Implement cloud presigned URL generation using AWS SDK
    // This will be implemented when cloud integration is added
    throw new Error('Cloud upload URLs not yet implemented');
  }

  /**
   * Generate cloud download URL (placeholder for future implementation)
   */
  private async generateCloudDownloadURL(objectKey: string): Promise<string> {
    // TODO: Implement cloud presigned URL generation using AWS SDK
    // This will be implemented when cloud integration is added
    throw new Error('Cloud download URLs not yet implemented');
  }

  /**
   * Detect storage type from URL
   */
  detectStorageTypeFromURL(url: string): StorageType {
    return URLUtils.detectStorageTypeFromURL(url);
  }

  /**
   * Generate object key from file path
   */
  generateObjectKey(filePath: string): string {
    return ObjectKeyUtils.generateObjectKey(filePath);
  }
}