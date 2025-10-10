// Local S3 Server - Express server implementation for S3-compatible operations
// Following Context7 Express.js patterns and Alex's lightweight S3 server architecture

import express from 'express';
import {
  GenerateUploadURLRequest,
  GenerateUploadURLResponse,
  GenerateDownloadURLRequest,
  GenerateDownloadURLResponse,
  MetadataResponse,
  RequestWithBody,
  RequestWithParams,
  ObjectKeyParams,
  HTTP_STATUS,
  S3_CONFIG_DEFAULTS
} from './S3Types';
import { S3ServiceManager } from './S3ServiceManager';

/**
 * Local S3-compatible Express server
 * Provides REST API endpoints for S3 operations and metadata management
 */
export class LocalS3Server {
  private app: express.Application;
  private server: any;
  private port: number;
  private s3Service: S3ServiceManager;

  constructor(port: number = 9000, s3Service?: S3ServiceManager) {
    this.port = port;
    this.app = express();
    this.s3Service = s3Service || new S3ServiceManager();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  // =====================================================================
  // Section: Server Setup and Configuration
  // =====================================================================

  /**
   * Setup Express middleware following Context7 patterns
   */
  private setupMiddleware(): void {
    // JSON parsing middleware (Context7 Express v4.16.0+ pattern)
    this.app.use(express.json({
      limit: '50mb',
      strict: true
    }));

    // URL encoded form parsing
    this.app.use(express.urlencoded({
      extended: true,
      limit: '50mb'
    }));

    // Request logging middleware (Context7 pattern)
    this.app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      const timestamp = new Date().toISOString();
      console.log(`[LocalS3Server] ${timestamp} ${req.method} ${req.url}`);

      // Add CORS headers for development
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

      next();
    });

    // Handle preflight requests
    this.app.options('*', (req: express.Request, res: express.Response) => {
      res.sendStatus(HTTP_STATUS.OK);
    });
  }

  /**
   * Setup API routes following Context7 Express routing patterns
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', this.handleHealthCheck.bind(this));

    // API endpoints for Postman testing
    this.app.post('/api/s3/generate-upload-url', this.handleAPIGenerateUploadURL.bind(this));
    this.app.post('/api/s3/generate-download-url', this.handleAPIGenerateDownloadURL.bind(this));
    this.app.get('/api/s3/metadata/:objectKey', this.handleAPIGetMetadata.bind(this));
    this.app.get('/api/s3/objects', this.handleAPIListObjects.bind(this));
    this.app.delete('/api/s3/objects/:objectKey', this.handleAPIDeleteObject.bind(this));

    // S3-compatible endpoints (for future AWS SDK integration)
    this.app.put('/upload-metadata/:objectKey', this.handleS3PutObject.bind(this));
    this.app.get('/download-metadata/:objectKey', this.handleS3GetObject.bind(this));
    this.app.head('/download-metadata/:objectKey', this.handleS3HeadObject.bind(this));
    this.app.delete('/delete-metadata/:objectKey', this.handleS3DeleteObject.bind(this));

    // Service status and configuration endpoints
    this.app.get('/api/s3/status', this.handleServiceStatus.bind(this));
    this.app.get('/api/s3/config', this.handleServiceConfig.bind(this));

    // Catch-all route for undefined endpoints
    this.app.use('*', this.handleNotFound.bind(this));
  }

  /**
   * Setup error handling middleware (Context7 4-parameter error handler pattern)
   */
  private setupErrorHandling(): void {
    this.app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('[LocalS3Server] Unhandled error:', err.message);
      console.error('[LocalS3Server] Stack trace:', err.stack);

      // Don't expose internal errors in production
      const isDevelopment = process.env.NODE_ENV !== 'production';

      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: 'Internal server error',
        message: isDevelopment ? err.message : 'An internal error occurred',
        timestamp: new Date().toISOString()
      });
    });
  }

  // =====================================================================
  // Section: API Route Handlers (Postman-ready endpoints)
  // =====================================================================

  /**
   * Health check endpoint
   */
  private handleHealthCheck(req: express.Request, res: express.Response): void {
    res.json({
      status: 'ok',
      service: 'LocalS3Server',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      port: this.port,
      endpoint: `http://localhost:${this.port}`
    });
  }

  /**
   * Generate upload URL - POST /api/s3/generate-upload-url
   */
  private async handleAPIGenerateUploadURL(
    req: RequestWithBody<GenerateUploadURLRequest>,
    res: express.Response
  ): Promise<void> {
    try {
      const { filePath, storageType, fileName, contentType } = req.body;

      if (!filePath || !storageType) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'Missing required fields: filePath and storageType are required'
        });
        return;
      }

      const result = await this.s3Service.generatePresignedUploadURL(filePath, storageType);

      const statusCode = result.success ? HTTP_STATUS.OK : HTTP_STATUS.BAD_REQUEST;
      res.status(statusCode).json(result);
    } catch (error) {
      this.handleRouteError(res, error, 'generating upload URL');
    }
  }

  /**
   * Generate download URL - POST /api/s3/generate-download-url
   */
  private async handleAPIGenerateDownloadURL(
    req: RequestWithBody<GenerateDownloadURLRequest>,
    res: express.Response
  ): Promise<void> {
    try {
      const { objectKey, storageType, expiresIn } = req.body;

      if (!objectKey) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'Missing required field: objectKey'
        });
        return;
      }

      const result = await this.s3Service.generatePresignedDownloadURL(objectKey, storageType);

      const statusCode = result.success ? HTTP_STATUS.OK : HTTP_STATUS.NOT_FOUND;
      res.status(statusCode).json(result);
    } catch (error) {
      this.handleRouteError(res, error, 'generating download URL');
    }
  }

  /**
   * Get object metadata - GET /api/s3/metadata/:objectKey
   */
  private async handleAPIGetMetadata(
    req: RequestWithParams<ObjectKeyParams>,
    res: express.Response
  ): Promise<void> {
    try {
      const { objectKey } = req.params;

      if (!objectKey) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'Missing objectKey parameter'
        });
        return;
      }

      const result = await this.s3Service.getObjectMetadata(objectKey);

      const statusCode = result.success ? HTTP_STATUS.OK : HTTP_STATUS.NOT_FOUND;
      res.status(statusCode).json(result);
    } catch (error) {
      this.handleRouteError(res, error, 'getting metadata');
    }
  }

  /**
   * List all objects - GET /api/s3/objects
   */
  private async handleAPIListObjects(req: express.Request, res: express.Response): Promise<void> {
    try {
      const objects = await this.s3Service.listObjects();

      res.json({
        success: true,
        objects,
        count: objects.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleRouteError(res, error, 'listing objects');
    }
  }

  /**
   * Delete object - DELETE /api/s3/objects/:objectKey
   */
  private async handleAPIDeleteObject(
    req: RequestWithParams<ObjectKeyParams>,
    res: express.Response
  ): Promise<void> {
    try {
      const { objectKey } = req.params;

      if (!objectKey) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: 'Missing objectKey parameter'
        });
        return;
      }

      const deleted = await this.s3Service.deleteObject(objectKey);

      if (deleted) {
        res.json({
          success: true,
          message: `Object ${objectKey} deleted successfully`
        });
      } else {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          error: `Object ${objectKey} not found or could not be deleted`
        });
      }
    } catch (error) {
      this.handleRouteError(res, error, 'deleting object');
    }
  }

  // =====================================================================
  // Section: S3-Compatible Route Handlers (Future AWS SDK integration)
  // =====================================================================

  /**
   * S3-compatible PUT object (metadata storage)
   */
  private async handleS3PutObject(
    req: RequestWithParams<ObjectKeyParams>,
    res: express.Response
  ): Promise<void> {
    try {
      const { objectKey } = req.params;
      const metadata = req.body;

      // Validate metadata structure
      if (!metadata || !metadata.filePath) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'Invalid metadata: filePath is required'
        });
        return;
      }

      await this.s3Service.saveObjectKeyToDatabase(objectKey, metadata);

      res.status(HTTP_STATUS.OK).json({
        success: true,
        objectKey,
        message: 'Metadata stored successfully'
      });
    } catch (error) {
      this.handleRouteError(res, error, 'storing S3 object metadata');
    }
  }

  /**
   * S3-compatible GET object (metadata retrieval)
   */
  private async handleS3GetObject(
    req: RequestWithParams<ObjectKeyParams>,
    res: express.Response
  ): Promise<void> {
    try {
      const { objectKey } = req.params;
      const result = await this.s3Service.getObjectMetadata(objectKey);

      if (result.success) {
        res.json(result.metadata);
      } else {
        res.status(HTTP_STATUS.NOT_FOUND).json({
          error: 'Metadata not found for key'
        });
      }
    } catch (error) {
      this.handleRouteError(res, error, 'retrieving S3 object metadata');
    }
  }

  /**
   * S3-compatible HEAD object (metadata check)
   */
  private async handleS3HeadObject(
    req: RequestWithParams<ObjectKeyParams>,
    res: express.Response
  ): Promise<void> {
    try {
      const { objectKey } = req.params;
      const exists = await this.s3Service.objectExists(objectKey);

      if (exists) {
        res.status(HTTP_STATUS.OK).send();
      } else {
        res.status(HTTP_STATUS.NOT_FOUND).send();
      }
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send();
    }
  }

  /**
   * S3-compatible DELETE object
   */
  private async handleS3DeleteObject(
    req: RequestWithParams<ObjectKeyParams>,
    res: express.Response
  ): Promise<void> {
    try {
      const { objectKey } = req.params;
      const deleted = await this.s3Service.deleteObject(objectKey);

      res.status(deleted ? HTTP_STATUS.OK : HTTP_STATUS.NOT_FOUND).send();
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send();
    }
  }

  // =====================================================================
  // Section: Service Information Handlers
  // =====================================================================

  /**
   * Get service status
   */
  private handleServiceStatus(req: express.Request, res: express.Response): void {
    const serviceState = this.s3Service.getServiceState();
    serviceState.isLocalServerRunning = true; // Update since server is running

    res.json({
      success: true,
      status: serviceState,
      server: {
        port: this.port,
        endpoint: `http://localhost:${this.port}`,
        uptime: process.uptime()
      }
    });
  }

  /**
   * Get service configuration
   */
  private handleServiceConfig(req: express.Request, res: express.Response): void {
    res.json({
      success: true,
      config: {
        localEndpoint: S3_CONFIG_DEFAULTS.LOCAL_ENDPOINT,
        defaultExpiry: S3_CONFIG_DEFAULTS.DEFAULT_EXPIRY,
        metadataDir: S3_CONFIG_DEFAULTS.METADATA_DIR_NAME,
        defaultBucket: S3_CONFIG_DEFAULTS.DEFAULT_BUCKET
      },
      endpoints: {
        health: '/health',
        generateUploadURL: '/api/s3/generate-upload-url',
        generateDownloadURL: '/api/s3/generate-download-url',
        getMetadata: '/api/s3/metadata/:objectKey',
        listObjects: '/api/s3/objects',
        deleteObject: '/api/s3/objects/:objectKey'
      }
    });
  }

  /**
   * Handle 404 for undefined routes
   */
  private handleNotFound(req: express.Request, res: express.Response): void {
    res.status(HTTP_STATUS.NOT_FOUND).json({
      success: false,
      error: 'Endpoint not found',
      path: req.path,
      method: req.method,
      availableEndpoints: [
        'GET /health',
        'POST /api/s3/generate-upload-url',
        'POST /api/s3/generate-download-url',
        'GET /api/s3/metadata/:objectKey',
        'GET /api/s3/objects',
        'DELETE /api/s3/objects/:objectKey'
      ]
    });
  }

  // =====================================================================
  // Section: Server Lifecycle Management
  // =====================================================================

  /**
   * Start the Express server
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, '127.0.0.1', () => {
          console.log(`[LocalS3Server] Server started on http://localhost:${this.port}`);
          console.log(`[LocalS3Server] Health check: http://localhost:${this.port}/health`);
          console.log(`[LocalS3Server] API endpoints available at /api/s3/*`);
          resolve();
        });

        this.server.on('error', (error: Error) => {
          console.error('[LocalS3Server] Server error:', error.message);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the Express server gracefully
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close((error?: Error) => {
          if (error) {
            console.error('[LocalS3Server] Error stopping server:', error.message);
          } else {
            console.log('[LocalS3Server] Server stopped gracefully');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get Express app instance (for testing or external integration)
   */
  getApp(): express.Application {
    return this.app;
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.server && this.server.listening;
  }

  // =====================================================================
  // Section: Private Helper Methods
  // =====================================================================

  /**
   * Handle route errors consistently
   */
  private handleRouteError(res: express.Response, error: unknown, operation: string): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[LocalS3Server] Error ${operation}:`, errorMessage);

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: `Failed ${operation}`,
      message: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
}