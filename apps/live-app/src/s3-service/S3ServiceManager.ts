// S3 Service Manager

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
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
import { R2Service, R2Config } from './R2Service';

export class S3ServiceManager {
  private baseDir: string;
  private metadataDir: string;
  private binaryCache: string;
  private config: S3Config;
  private metadataCache: Map<string, FileMetadata>;
  private r2Service: R2Service | null = null;
  private cloudStorageEnabled: boolean;
  private cloudStorageFallback: boolean;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.join(os.homedir(), '.neutralbase');
    this.metadataDir = path.join(this.baseDir, S3_CONFIG_DEFAULTS.METADATA_DIR_NAME);
    this.binaryCache = path.join(this.baseDir, 'binary-cache');
    this.config = {
      localEndpoint: S3_CONFIG_DEFAULTS.LOCAL_ENDPOINT,
      credentials: S3_CONFIG_DEFAULTS.LOCAL_CREDENTIALS,
      bucketName: S3_CONFIG_DEFAULTS.DEFAULT_BUCKET
    };

    this.metadataCache = new Map();

    // Initialize cloud storage configuration
    this.cloudStorageEnabled = process.env.CLOUD_STORAGE_ENABLED === 'true';
    this.cloudStorageFallback = process.env.CLOUD_STORAGE_FALLBACK_TO_LOCAL !== 'false';

    // Initialize R2 service if cloud storage is enabled
    if (this.cloudStorageEnabled) {
      this.initializeR2Service();
    }

    this.initializeDirectories();
  }

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

          const metadata = await this.loadObjectMetadata(objectKey);
      if (!metadata) {
        throw ErrorUtils.createError(
          `Object not found: ${objectKey}`,
          S3ErrorCode.OBJECT_NOT_FOUND,
          404,
          objectKey
        );
      }

      // Generate URL
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
   * Generate presigned upload URL for browser-based uploads
   * Doesn't require file to exist on filesystem - accepts virtual paths
   */
  async generatePresignedUploadURL(
    filePath: string,
    storageType: StorageType,
    fileName?: string,
    contentType?: string
  ): Promise<GenerateUploadURLResponse> {
    try {
      if (!ValidationUtils.isValidStorageType(storageType)) {
        return {
          success: false,
          error: 'Invalid storage type. Must be "local" or "cloud"'
        };
      }

      // For browser uploads, filePath is virtual (e.g., "/uploads/file.png")
      // Generate object key from virtual path
      const objectKey = ObjectKeyUtils.generateObjectKey(filePath);
      const finalFileName = fileName || path.basename(filePath);
      const mimeType = contentType || FileSystemUtils.getMimeType(finalFileName);

      // Create initial metadata (fileSize will be updated after upload)
      const metadata: FileMetadata = {
        objectKey,
        filePath: filePath,  // Keep virtual path for reference
        fileName: finalFileName,
        fileSize: 0,  // Will be updated after upload
        mimeType,
        createdAt: TimeUtils.getCurrentTimestamp(),
        lastModified: TimeUtils.getCurrentTimestamp(),
        storageType
      };

      await this.saveObjectMetadata(objectKey, metadata);

      // Generate URL
      const signedUrl = storageType === 'local'
        ? this.generateLocalUploadURL(objectKey)
        : await this.generateCloudUploadURL(objectKey, mimeType);

      console.log(`[S3ServiceManager] Generated ${storageType} upload URL for ${finalFileName}`);

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

  async generatePresignedDownloadURL(
    objectKey: string,
    storageType?: StorageType
  ): Promise<GenerateDownloadURLResponse> {
    try {
          const metadata = await this.loadObjectMetadata(objectKey);
      if (!metadata) {
        return {
          success: false,
          error: `Object not found: ${objectKey}`
        };
      }

      const targetStorageType = storageType || metadata.storageType;

      // Generate URL
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

  async objectExists(objectKey: string): Promise<boolean> {
    try {
      const metadata = await this.loadObjectMetadata(objectKey);
      return metadata !== null;
    } catch {
      return false;
    }
  }


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


  getServiceState(): S3ServiceState {
    return {
      isLocalServerRunning: false, // Will be updated when server integration is added
      localServerPort: 9000,
      metadataStorePath: this.metadataDir,
      totalObjectsStored: this.metadataCache.size,
      lastActivity: TimeUtils.getCurrentTimestamp()
    };
  }

  private async initializeDirectories(): Promise<void> {
    try {
      await FileSystemUtils.ensureDirectory(this.metadataDir);
      await FileSystemUtils.ensureDirectory(this.binaryCache);
      console.log(`[S3ServiceManager] Initialized directories:`);
      console.log(`  Metadata: ${this.metadataDir}`);
      console.log(`  Binary cache: ${this.binaryCache}`);
    } catch (error) {
      console.error('[S3ServiceManager] Failed to initialize directories:', error);
      throw error;
    }
  }

  /**
   * Initialize Cloudflare R2 cloud storage service
   * Loads credentials from environment variables
   */
  private initializeR2Service(): void {
    try {
      const accountId = process.env.R2_ACCOUNT_ID;
      const accessKeyId = process.env.R2_ACCESS_KEY_ID;
      const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
      const bucketName = process.env.R2_BUCKET_NAME || 'electron-app-storage';

      // Validate required credentials
      if (!accountId || !accessKeyId || !secretAccessKey) {
        console.warn('[S3ServiceManager] R2 credentials missing, cloud storage disabled');
        this.cloudStorageEnabled = false;
        return;
      }

      const r2Config: R2Config = {
        accountId,
        accessKeyId,
        secretAccessKey,
        bucketName,
      };

      this.r2Service = new R2Service(r2Config);

      if (this.r2Service.isServiceAvailable()) {
        console.log('[S3ServiceManager] R2 cloud storage initialized successfully');
      } else {
        console.warn('[S3ServiceManager] R2 service unavailable, cloud storage disabled');
        this.cloudStorageEnabled = false;
        this.r2Service = null;
      }
    } catch (error) {
      console.error('[S3ServiceManager] Failed to initialize R2 service:', error);
      this.cloudStorageEnabled = false;
      this.r2Service = null;
    }
  }


  getBinaryCachePath(objectKey: string): string {
    return path.join(this.binaryCache, objectKey);
  }


  async isBinaryCached(objectKey: string): Promise<boolean> {
    const cachePath = this.getBinaryCachePath(objectKey);
    return await FileSystemUtils.fileExists(cachePath);
  }


  shouldBackupToCloud(fileSizeBytes: number, thresholdMB: number = 5): boolean {
    const thresholdBytes = thresholdMB * 1024 * 1024; // Convert MB to bytes
    return fileSizeBytes > thresholdBytes;
  }


  async copyToCache(sourcePath: string, objectKey: string): Promise<{ success: boolean; cachePath?: string; error?: string }> {
    try {
      const cachePath = this.getBinaryCachePath(objectKey);

      if (!await FileSystemUtils.fileExists(sourcePath)) {
        return { success: false, error: `Source file not found: ${sourcePath}` };
      }

      await fs.copyFile(sourcePath, cachePath);
      console.log(`[S3ServiceManager] Copied file to cache: ${objectKey}`);

      return { success: true, cachePath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }


  async downloadToCache(objectKey: string): Promise<{ success: boolean; cachePath?: string; error?: string }> {
    try {
      // 1. Check if already cached
      if (await this.isBinaryCached(objectKey)) {
        const cachePath = this.getBinaryCachePath(objectKey);
        console.log(`[S3ServiceManager] File already cached: ${objectKey}`);
        return { success: true, cachePath };
      }

      console.log(`[S3ServiceManager] Starting download to cache: ${objectKey}`);

      // 2. Load metadata to get storage type
      const metadata = await this.loadObjectMetadata(objectKey);
      if (!metadata) {
        return {
          success: false,
          error: `Metadata not found for object: ${objectKey}`
        };
      }

      // 3. Generate presigned download URL
      const downloadResult = await this.generatePresignedDownloadURL(objectKey, metadata.storageType);
      if (!downloadResult.success || !downloadResult.signedUrl) {
        return {
          success: false,
          error: downloadResult.error || 'Failed to generate download URL'
        };
      }

      console.log(`[S3ServiceManager] Downloading from ${metadata.storageType} storage...`);

      // 4. Fetch file content from presigned URL
      const response = await fetch(downloadResult.signedUrl);
      if (!response.ok) {
        return {
          success: false,
          error: `Download failed with status: ${response.status}`
        };
      }

      const buffer = await response.arrayBuffer();
      console.log(`[S3ServiceManager] Downloaded ${buffer.byteLength} bytes`);

      // 5. Ensure cache directory exists
      await FileSystemUtils.ensureDirectory(this.binaryCache);

      // 6. Write to cache (always overwrite)
      const cachePath = this.getBinaryCachePath(objectKey);
      await fs.writeFile(cachePath, Buffer.from(buffer));

      console.log(`[S3ServiceManager] File cached successfully: ${cachePath}`);

      return { success: true, cachePath };
    } catch (error) {
      console.error(`[S3ServiceManager] Download to cache error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }


  async downloadToNeutralBase(objectKey: string): Promise<{ success: boolean; path?: string; message?: string; error?: string }> {
    try {
      console.log(`[S3ServiceManager] Downloading file to neutral base: ${objectKey}`);

      // Use the downloadToCache method to fetch and cache the file
      const result = await this.downloadToCache(objectKey);

      if (!result.success || !result.cachePath) {
        return {
          success: false,
          error: result.error || 'Download failed',
          message: 'Failed to download file to neutral base'
        };
      }

      // Load metadata for additional info
      const metadata = await this.loadObjectMetadata(objectKey);
      const fileName = metadata?.fileName || 'unknown';
      const fileSize = metadata?.fileSize || 0;
      const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);

      console.log(`[S3ServiceManager] File downloaded successfully: ${result.cachePath}`);

      return {
        success: true,
        path: result.cachePath,
        message: `File '${fileName}' (${sizeMB} MB) downloaded to neutral base`
      };
    } catch (error) {
      console.error(`[S3ServiceManager] Download to neutral base error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to download file to neutral base'
      };
    }
  }


  private async loadObjectMetadata(objectKey: string): Promise<FileMetadata | null> {
    try {
      if (this.metadataCache.has(objectKey)) {
        return this.metadataCache.get(objectKey)!;
      }

      const metadataPath = this.getMetadataPath(objectKey);
      const metadata = await MetadataStoreUtils.loadMetadata(metadataPath);

      if (metadata) {
        this.metadataCache.set(objectKey, metadata);
      }

      return metadata;
    } catch (error) {
      console.error(`[S3ServiceManager] Error loading metadata for ${objectKey}:`, error);
      return null;
    }
  }


  private async saveObjectMetadata(objectKey: string, metadata: FileMetadata): Promise<void> {
    const metadataPath = this.getMetadataPath(objectKey);
    await MetadataStoreUtils.saveMetadata(metadataPath, metadata);

    this.metadataCache.set(objectKey, metadata);
  }


  private getMetadataPath(objectKey: string): string {
    return path.join(this.metadataDir, `${objectKey}.json`);
  }


  private generateLocalUploadURL(objectKey: string): string {
    return URLUtils.buildLocalURL(`/upload-metadata/${objectKey}`);
  }


  private generateLocalDownloadURL(objectKey: string): string {
    return URLUtils.buildLocalURL(`/download-metadata/${objectKey}`);
  }


  /**
   * Generate presigned URL for cloud upload via Cloudflare R2
   * Automatically falls back to local storage if cloud is unavailable
   */
  private async generateCloudUploadURL(objectKey: string, contentType: string): Promise<string> {
    // Check if cloud storage is available
    if (!this.cloudStorageEnabled || !this.r2Service) {
      if (this.cloudStorageFallback) {
        console.warn('[S3ServiceManager] Cloud storage unavailable, falling back to local');
        return this.generateLocalUploadURL(objectKey);
      }
      throw new Error('Cloud storage not available');
    }

    try {
      const signedUrl = await this.r2Service.generateUploadURL(objectKey, contentType);
      console.log('[S3ServiceManager] Cloud upload URL generated', { objectKey });
      return signedUrl;
    } catch (error) {
      console.error('[S3ServiceManager] Failed to generate cloud upload URL:', error);

      // Automatic fallback to local storage if enabled
      if (this.cloudStorageFallback) {
        console.warn('[S3ServiceManager] Falling back to local storage');
        return this.generateLocalUploadURL(objectKey);
      }

      throw error;
    }
  }

  /**
   * Generate presigned URL for cloud download via Cloudflare R2
   * Automatically falls back to local storage if cloud is unavailable
   */
  private async generateCloudDownloadURL(objectKey: string): Promise<string> {
    // Check if cloud storage is available
    if (!this.cloudStorageEnabled || !this.r2Service) {
      if (this.cloudStorageFallback) {
        console.warn('[S3ServiceManager] Cloud storage unavailable, falling back to local');
        return this.generateLocalDownloadURL(objectKey);
      }
      throw new Error('Cloud storage not available');
    }

    try {
      const signedUrl = await this.r2Service.generateDownloadURL(objectKey);
      console.log('[S3ServiceManager] Cloud download URL generated', { objectKey });
      return signedUrl;
    } catch (error) {
      console.error('[S3ServiceManager] Failed to generate cloud download URL:', error);

      // Automatic fallback to local storage if enabled
      if (this.cloudStorageFallback) {
        console.warn('[S3ServiceManager] Falling back to local storage');
        return this.generateLocalDownloadURL(objectKey);
      }

      throw error;
    }
  }


  detectStorageTypeFromURL(url: string): StorageType {
    return URLUtils.detectStorageTypeFromURL(url);
  }


  generateObjectKey(filePath: string): string {
    return ObjectKeyUtils.generateObjectKey(filePath);
  }
}