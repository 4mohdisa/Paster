// S3 Service Utilities - Helper functions for S3 operations
// Following modular patterns consistent with existing live-app architecture

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  StorageType,
  FileMetadata,
  S3_CONFIG_DEFAULTS,
  S3ErrorCode,
  S3ServiceError
} from './S3Types';

/**
 * Object key generation and validation utilities
 */
export class ObjectKeyUtils {
  /**
   * Generate a unique object key from file path using MD5 hash
   * Consistent with existing live-app file ID generation patterns
   */
  static generateObjectKey(filePath: string): string {
    const normalizedPath = path.resolve(filePath);
    return crypto.createHash('md5').update(normalizedPath).digest('hex');
  }

  /**
   * Generate object key with custom prefix
   */
  static generateObjectKeyWithPrefix(filePath: string, prefix: string = 'file'): string {
    const hash = this.generateObjectKey(filePath);
    return `${prefix}-${hash}`;
  }

  /**
   * Validate object key format (32 character hex string)
   */
  static isValidObjectKey(objectKey: string): boolean {
    return /^[a-f0-9]{32}$/.test(objectKey) || /^[a-zA-Z]+-[a-f0-9]{32}$/.test(objectKey);
  }

  /**
   * Extract file hash from prefixed object key
   */
  static extractHashFromKey(objectKey: string): string {
    const parts = objectKey.split('-');
    return parts.length > 1 ? parts[parts.length - 1] : objectKey;
  }
}

/**
 * URL utilities for storage type detection and validation
 */
export class URLUtils {
  /**
   * Detect storage type from URL (local vs cloud)
   * Following Alex's architecture from conversation screenshots
   */
  static detectStorageTypeFromURL(url: string): StorageType {
    try {
      const urlObj = new URL(url);

      // Check for localhost or 127.0.0.1 with port 9000
      if (
        (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') &&
        urlObj.port === '9000'
      ) {
        return 'local';
      }

      // Everything else is considered cloud storage
      return 'cloud';
    } catch (error) {
      // Invalid URL defaults to local
      return 'local';
    }
  }

  /**
   * Build local S3 endpoint URL
   */
  static buildLocalURL(path: string): string {
    const baseURL = S3_CONFIG_DEFAULTS.LOCAL_ENDPOINT;
    return `${baseURL}${path.startsWith('/') ? path : '/' + path}`;
  }

  /**
   * Validate URL format
   */
  static isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * File system utilities for metadata and file operations
 */
export class FileSystemUtils {
  /**
   * Get file stats and metadata
   */
  static async getFileMetadata(filePath: string): Promise<Partial<FileMetadata>> {
    try {
      const stats = await fs.promises.stat(filePath);
      const parsedPath = path.parse(filePath);

      return {
        fileName: parsedPath.base,
        fileSize: stats.size,
        lastModified: stats.mtime.toISOString(),
        createdAt: stats.birthtime.toISOString()
      };
    } catch (error) {
      throw new S3ServiceError(
        `Failed to read file metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        S3ErrorCode.FILE_NOT_FOUND,
        404
      );
    }
  }

  /**
   * Check if file exists and is accessible
   */
  static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get MIME type from file extension
   */
  static getMimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();

    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Ensure directory exists (create if needed)
   */
  static async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw new S3ServiceError(
        `Failed to create directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
        S3ErrorCode.METADATA_STORE_ERROR,
        500
      );
    }
  }
}

/**
 * Metadata store utilities for JSON file operations
 */
export class MetadataStoreUtils {
  /**
   * Load metadata from JSON file
   */
  static async loadMetadata(metadataPath: string): Promise<FileMetadata | null> {
    try {
      if (!await FileSystemUtils.fileExists(metadataPath)) {
        return null;
      }

      const jsonData = await fs.promises.readFile(metadataPath, 'utf-8');
      return JSON.parse(jsonData) as FileMetadata;
    } catch (error) {
      throw new S3ServiceError(
        `Failed to load metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        S3ErrorCode.METADATA_STORE_ERROR,
        500
      );
    }
  }

  /**
   * Save metadata to JSON file
   */
  static async saveMetadata(metadataPath: string, metadata: FileMetadata): Promise<void> {
    try {
      // Ensure directory exists
      await FileSystemUtils.ensureDirectory(path.dirname(metadataPath));

      // Write metadata with pretty formatting
      const jsonData = JSON.stringify(metadata, null, 2);
      await fs.promises.writeFile(metadataPath, jsonData, 'utf-8');
    } catch (error) {
      throw new S3ServiceError(
        `Failed to save metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        S3ErrorCode.METADATA_STORE_ERROR,
        500
      );
    }
  }

  /**
   * Delete metadata file
   */
  static async deleteMetadata(metadataPath: string): Promise<void> {
    try {
      if (await FileSystemUtils.fileExists(metadataPath)) {
        await fs.promises.unlink(metadataPath);
      }
    } catch (error) {
      throw new S3ServiceError(
        `Failed to delete metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        S3ErrorCode.METADATA_STORE_ERROR,
        500
      );
    }
  }

  /**
   * List all metadata files in directory
   */
  static async listMetadataFiles(metadataDir: string): Promise<string[]> {
    try {
      if (!await FileSystemUtils.fileExists(metadataDir)) {
        return [];
      }

      const files = await fs.promises.readdir(metadataDir);
      return files.filter(file => file.endsWith('.json'));
    } catch (error) {
      throw new S3ServiceError(
        `Failed to list metadata files: ${error instanceof Error ? error.message : 'Unknown error'}`,
        S3ErrorCode.METADATA_STORE_ERROR,
        500
      );
    }
  }
}

/**
 * Time and date utilities
 */
export class TimeUtils {
  /**
   * Get current ISO timestamp
   */
  static getCurrentTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Check if timestamp is expired
   */
  static isExpired(timestamp: string, expirySeconds: number): boolean {
    const now = Date.now();
    const created = new Date(timestamp).getTime();
    return (now - created) > (expirySeconds * 1000);
  }

  /**
   * Get expiry timestamp from current time
   */
  static getExpiryTimestamp(expirySeconds: number = S3_CONFIG_DEFAULTS.DEFAULT_EXPIRY): string {
    const expiry = new Date(Date.now() + (expirySeconds * 1000));
    return expiry.toISOString();
  }
}

/**
 * Validation utilities for request data
 */
export class ValidationUtils {
  /**
   * Validate file path format
   */
  static isValidFilePath(filePath: string): boolean {
    return typeof filePath === 'string' &&
           filePath.length > 0 &&
           !filePath.includes('..') &&
           path.isAbsolute(filePath);
  }

  /**
   * Validate storage type
   */
  static isValidStorageType(storageType: any): storageType is StorageType {
    return storageType === 'local' || storageType === 'cloud';
  }

  /**
   * Validate expiry time
   */
  static isValidExpiryTime(expiresIn: any): boolean {
    return typeof expiresIn === 'number' &&
           expiresIn > 0 &&
           expiresIn <= 86400; // Max 24 hours
  }
}

/**
 * Error handling utilities
 */
export class ErrorUtils {
  /**
   * Create S3ServiceError with proper code and status
   */
  static createError(
    message: string,
    code: S3ErrorCode,
    statusCode: number,
    objectKey?: string
  ): S3ServiceError {
    const error = new S3ServiceError(message, code, statusCode);
    if (objectKey) {
      error.objectKey = objectKey;
    }
    return error;
  }

  /**
   * Convert unknown error to S3ServiceError
   */
  static toS3Error(error: unknown, defaultCode: S3ErrorCode = S3ErrorCode.SERVER_ERROR): S3ServiceError {
    if (error instanceof S3ServiceError) {
      return error;
    }

    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return new S3ServiceError(message, defaultCode, 500);
  }
}