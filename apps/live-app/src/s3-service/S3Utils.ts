// S3 Service Utilities

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

// Object key generation and validation utilities
export class ObjectKeyUtils {
  static generateObjectKey(filePath: string): string {
    const normalizedPath = path.resolve(filePath);
    return crypto.createHash('md5').update(normalizedPath).digest('hex');
  }

  static generateObjectKeyWithPrefix(filePath: string, prefix: string = 'file'): string {
    const hash = this.generateObjectKey(filePath);
    return `${prefix}-${hash}`;
  }

  static isValidObjectKey(objectKey: string): boolean {
    return /^[a-f0-9]{32}$/.test(objectKey) || /^[a-zA-Z]+-[a-f0-9]{32}$/.test(objectKey);
  }

  static extractHashFromKey(objectKey: string): string {
    const parts = objectKey.split('-');
    return parts.length > 1 ? parts[parts.length - 1] : objectKey;
  }
}

// URL utilities for storage type detection and validation
export class URLUtils {
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

  static buildLocalURL(path: string): string {
    const baseURL = S3_CONFIG_DEFAULTS.LOCAL_ENDPOINT;
    return `${baseURL}${path.startsWith('/') ? path : '/' + path}`;
  }

  static isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

// File system utilities for metadata and file operations
export class FileSystemUtils {
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

  static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

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

// Metadata store utilities for JSON file operations
export class MetadataStoreUtils {
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

  static async saveMetadata(metadataPath: string, metadata: FileMetadata): Promise<void> {
    try {
      await FileSystemUtils.ensureDirectory(path.dirname(metadataPath));
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

// Time and date utilities
export class TimeUtils {
  static getCurrentTimestamp(): string {
    return new Date().toISOString();
  }

  static isExpired(timestamp: string, expirySeconds: number): boolean {
    const now = Date.now();
    const created = new Date(timestamp).getTime();
    return (now - created) > (expirySeconds * 1000);
  }

  static getExpiryTimestamp(expirySeconds: number = S3_CONFIG_DEFAULTS.DEFAULT_EXPIRY): string {
    const expiry = new Date(Date.now() + (expirySeconds * 1000));
    return expiry.toISOString();
  }
}

// Validation utilities for request data
export class ValidationUtils {
  static isValidFilePath(filePath: string): boolean {
    return typeof filePath === 'string' &&
           filePath.length > 0 &&
           !filePath.includes('..') &&
           path.isAbsolute(filePath);
  }

  static isValidStorageType(storageType: any): storageType is StorageType {
    return storageType === 'local' || storageType === 'cloud';
  }

  static isValidExpiryTime(expiresIn: any): boolean {
    return typeof expiresIn === 'number' &&
           expiresIn > 0 &&
           expiresIn <= 86400; // Max 24 hours
  }
}

// Error handling utilities
export class ErrorUtils {
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

  static toS3Error(error: unknown, defaultCode: S3ErrorCode = S3ErrorCode.SERVER_ERROR): S3ServiceError {
    if (error instanceof S3ServiceError) {
      return error;
    }

    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return new S3ServiceError(message, defaultCode, 500);
  }
}