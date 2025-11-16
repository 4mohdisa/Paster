// S3 Service Types

// File metadata stored in local S3 metadata store
export interface FileMetadata {
  objectKey: string;           // Unique S3 object identifier
  filePath: string;           // Actual macOS file location (not duplicated)
  fileName: string;           // Original filename with extension
  fileSize: number;           // File size in bytes
  mimeType?: string;          // MIME type for proper content handling
  createdAt: string;          // ISO timestamp of creation
  lastModified: string;       // ISO timestamp of last modification
  storageType: StorageType;   // Whether file is local or cloud
  checksum?: string;          // Optional file hash for integrity
}

// S3 configuration for both local and cloud endpoints
export interface S3Config {
  localEndpoint: string;      // Local S3 server endpoint (http://localhost:9000)
  cloudEndpoint?: string;     // Future cloud S3 endpoint (R2, AWS, etc.)
  credentials: {
    accessKeyId: string;      // S3 access key (fake for local: 'S3RVER')
    secretAccessKey: string;  // S3 secret key (fake for local: 'S3RVER')
  };
  region?: string;            // AWS region (for cloud operations)
  bucketName?: string;        // Default bucket name
}

// Options for presigned URL generation
export interface PresignedURLOptions {
  expiresIn?: number;         // URL expiry in seconds (default: 3600)
  httpMethod: HTTPMethod;     // HTTP method for the operation
  contentType?: string;       // Content-Type header for uploads
  headers?: Record<string, string>; // Additional headers to sign
}

// Request/Response interfaces for API endpoints
export interface GenerateUploadURLRequest {
  filePath: string;           // Source file path
  storageType: StorageType;   // Target storage type
  fileName?: string;          // Override filename
  contentType?: string;       // Override content type
}

export interface GenerateUploadURLResponse {
  success: boolean;
  signedUrl?: string;         // Presigned upload URL
  objectKey?: string;         // Generated object key
  error?: string;             // Error message if failed
}

export interface GenerateDownloadURLRequest {
  objectKey: string;          // S3 object key to download
  storageType?: StorageType;  // Auto-detected if not provided
  expiresIn?: number;         // Custom expiry time
}

export interface GenerateDownloadURLResponse {
  success: boolean;
  signedUrl?: string;         // Presigned download URL
  metadata?: FileMetadata;    // File metadata
  error?: string;             // Error message if failed
}

export interface MetadataResponse {
  success: boolean;
  metadata?: FileMetadata;    // File metadata
  error?: string;             // Error message if failed
}

// Internal service state and errors
export interface S3ServiceState {
  isLocalServerRunning: boolean;
  localServerPort: number;
  metadataStorePath: string;
  totalObjectsStored: number;
  lastActivity: string;
}

export interface S3ServiceError extends Error {
  code: S3ErrorCode;
  statusCode: number;
  objectKey?: string;
}

// Type definitions and enums
export type StorageType = 'local' | 'cloud';

export type HTTPMethod = 'GET' | 'PUT' | 'POST' | 'DELETE' | 'HEAD';

export enum S3ErrorCode {
  OBJECT_NOT_FOUND = 'ObjectNotFound',
  INVALID_OBJECT_KEY = 'InvalidObjectKey',
  FILE_NOT_FOUND = 'FileNotFound',
  METADATA_STORE_ERROR = 'MetadataStoreError',
  PRESIGNED_URL_ERROR = 'PresignedUrlError',
  SERVER_ERROR = 'ServerError',
  INVALID_STORAGE_TYPE = 'InvalidStorageType',
  PERMISSION_DENIED = 'PermissionDenied'
}

// Express route handler types for type safety
export interface RequestWithBody<T> extends Express.Request {
  body: T;
}

export interface RequestWithParams<T> extends Express.Request {
  params: T;
}

// Utility types for better type inference
export type ObjectKeyParams = {
  objectKey: string;
};

export type ServiceMethodResult<T> = Promise<{
  success: boolean;
  data?: T;
  error?: string;
}>;

// Configuration defaults
export const S3_CONFIG_DEFAULTS = {
  LOCAL_ENDPOINT: 'http://localhost:9000',
  DEFAULT_EXPIRY: 3600,              // 1 hour
  LOCAL_CREDENTIALS: {
    accessKeyId: 'S3RVER',
    secretAccessKey: 'S3RVER'
  },
  METADATA_DIR_NAME: 's3-metadata',
  DEFAULT_BUCKET: 'local-files'
} as const;

// HTTP status codes for API responses
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
} as const;