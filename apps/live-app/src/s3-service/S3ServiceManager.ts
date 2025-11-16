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

export class S3ServiceManager {
  private baseDir: string;
  private metadataDir: string;
  private binaryCache: string;
  private config: S3Config;
  private metadataCache: Map<string, FileMetadata>;

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

  async generatePresignedUploadURL(
    filePath: string,
    storageType: StorageType
  ): Promise<GenerateUploadURLResponse> {
    try {
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

      if (!await FileSystemUtils.fileExists(filePath)) {
        return {
          success: false,
          error: `File not found: ${filePath}`
        };
      }

      const objectKey = ObjectKeyUtils.generateObjectKey(filePath);
      const fileStats = await FileSystemUtils.getFileMetadata(filePath);
      const mimeType = FileSystemUtils.getMimeType(fileStats.fileName || path.basename(filePath));

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

          await this.saveObjectMetadata(objectKey, metadata);

      // Generate URL
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
      if (await this.isBinaryCached(objectKey)) {
        const cachePath = this.getBinaryCachePath(objectKey);
        return { success: true, cachePath };
      }

      // TODO: Implement actual S3 download
      // For now, this is a placeholder structure for Alex's download button experiment
      console.log(`[S3ServiceManager] Download to cache requested for: ${objectKey}`);

      return {
        success: false,
        error: "Download functionality not yet implemented - placeholder for experiments"
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
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


  private async generateCloudUploadURL(objectKey: string, contentType: string): Promise<string> {
    // TODO: Implement cloud presigned URL generation using AWS SDK
    // This will be implemented when cloud integration is added
    throw new Error('Cloud upload URLs not yet implemented');
  }


  private async generateCloudDownloadURL(objectKey: string): Promise<string> {
    // TODO: Implement cloud presigned URL generation using AWS SDK
    // This will be implemented when cloud integration is added
    throw new Error('Cloud download URLs not yet implemented');
  }


  detectStorageTypeFromURL(url: string): StorageType {
    return URLUtils.detectStorageTypeFromURL(url);
  }


  generateObjectKey(filePath: string): string {
    return ObjectKeyUtils.generateObjectKey(filePath);
  }
}