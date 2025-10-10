// S3 Service Module - Main exports for modular S3 operations
// Clean entry point following Context7 module organization patterns

// =====================================================================
// Section: Core Service Exports
// =====================================================================

// Main service class with modular functions for S3 operations
export { S3ServiceManager } from './S3ServiceManager';

// Express server implementation for local S3 endpoints
export { LocalS3Server } from './LocalS3Server';

// =====================================================================
// Section: Type Definitions and Interfaces
// =====================================================================

// Complete type system for S3 operations
export type {
  // Core data structures
  FileMetadata,
  S3Config,
  S3ServiceState,

  // API request/response interfaces
  GenerateUploadURLRequest,
  GenerateUploadURLResponse,
  GenerateDownloadURLRequest,
  GenerateDownloadURLResponse,
  MetadataResponse,

  // Express route handler types
  RequestWithBody,
  RequestWithParams,
  ObjectKeyParams,

  // Utility types
  StorageType,
  HTTPMethod,
  PresignedURLOptions,
  ServiceMethodResult
} from './S3Types';

// Error handling exports
export {
  S3ErrorCode,
  S3ServiceError,
  S3_CONFIG_DEFAULTS,
  HTTP_STATUS
} from './S3Types';

// =====================================================================
// Section: Utility Function Exports
// =====================================================================

// Modular utility functions for S3 operations
export {
  ObjectKeyUtils,
  URLUtils,
  FileSystemUtils,
  MetadataStoreUtils,
  TimeUtils,
  ValidationUtils,
  ErrorUtils
} from './S3Utils';

// =====================================================================
// Section: Quick Start Factory Functions
// =====================================================================

/**
 * Create a new S3 service manager instance
 * Quick factory function for common use cases
 */
export function createS3Service(baseDir?: string): S3ServiceManager {
  return new S3ServiceManager(baseDir);
}

/**
 * Create and start a local S3 server
 * Quick factory function for local development and testing
 */
export async function createLocalS3Server(
  port: number = 9000,
  s3Service?: S3ServiceManager
): Promise<LocalS3Server> {
  const server = new LocalS3Server(port, s3Service);
  await server.start();
  return server;
}

/**
 * Get default S3 configuration for local development
 * Convenience function for quick setup
 */
export function getDefaultS3Config(): typeof S3_CONFIG_DEFAULTS {
  return S3_CONFIG_DEFAULTS;
}