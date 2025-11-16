// Start S3 Server for Postman Testing
// Run with: node start-s3-server.js

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

console.log('🚀 Starting S3 Service Server for Postman Testing...\n');

// Create Express app
const app = express();
const port = 9000;

// Middleware
app.use(express.json({ limit: '50mb', strict: true }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[S3Server] ${timestamp} ${req.method} ${req.url}`);

  // CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  next();
});

// Handle preflight requests
app.options('*', (req, res) => {
  res.sendStatus(200);
});

// Utility functions
const generateObjectKey = (filePath) => {
  const normalizedPath = path.resolve(filePath);
  return crypto.createHash('md5').update(normalizedPath).digest('hex');
};

const getMetadataDir = () => {
  const baseDir = path.join(os.homedir(), '.neutralbase');
  const metadataDir = path.join(baseDir, 's3-metadata');

  // Ensure directory exists
  if (!fs.existsSync(metadataDir)) {
    fs.mkdirSync(metadataDir, { recursive: true });
  }

  return metadataDir;
};

// Routes

// 1. Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'LocalS3Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    port: port,
    endpoint: `http://localhost:${port}`
  });
});

// 2. Generate Upload URL
app.post('/api/s3/generate-upload-url', (req, res) => {
  try {
    const { filePath, storageType, fileName, contentType } = req.body;

    if (!filePath || !storageType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: filePath and storageType are required'
      });
    }

    // Generate object key
    const objectKey = generateObjectKey(filePath);

    // Create metadata
    const metadata = {
      objectKey,
      filePath: path.resolve(filePath),
      fileName: fileName || path.basename(filePath),
      fileSize: 0, // Would be populated from actual file
      mimeType: contentType || 'application/octet-stream',
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      storageType
    };

    // Save metadata
    const metadataDir = getMetadataDir();
    const metadataPath = path.join(metadataDir, `${objectKey}.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    // Generate presigned URL for actual file upload
    const signedUrl = `http://localhost:${port}/upload/${objectKey}`;

    res.json({
      success: true,
      signedUrl,
      objectKey
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed generating upload URL',
      message: error.message
    });
  }
});

// 2b. Handle actual file upload
app.put('/upload/:objectKey', express.raw({ type: '*/*', limit: '50mb' }), (req, res) => {
  try {
    const { objectKey } = req.params;

    if (!objectKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing objectKey parameter'
      });
    }

    // Load metadata
    const metadataDir = getMetadataDir();
    const metadataPath = path.join(metadataDir, `${objectKey}.json`);

    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({
        success: false,
        error: `Object metadata not found: ${objectKey}`
      });
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

    // Save file to binary cache
    const binaryCacheDir = path.join(os.homedir(), '.neutralbase', 'binary-cache');
    if (!fs.existsSync(binaryCacheDir)) {
      fs.mkdirSync(binaryCacheDir, { recursive: true });
    }

    const filePath = path.join(binaryCacheDir, objectKey);
    fs.writeFileSync(filePath, req.body);

    // Update metadata with actual file size
    metadata.fileSize = req.body.length;
    metadata.uploadedAt = new Date().toISOString();
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    console.log(`✅ File uploaded successfully: ${objectKey} (${req.body.length} bytes)`);

    res.json({
      success: true,
      objectKey,
      fileSize: req.body.length,
      message: 'File uploaded successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to upload file',
      message: error.message
    });
  }
});

// 3. Generate Download URL
app.post('/api/s3/generate-download-url', (req, res) => {
  try {
    const { objectKey, storageType, expiresIn } = req.body;

    if (!objectKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: objectKey'
      });
    }

    // Load metadata
    const metadataDir = getMetadataDir();
    const metadataPath = path.join(metadataDir, `${objectKey}.json`);

    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({
        success: false,
        error: `Object not found: ${objectKey}`
      });
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    const signedUrl = `http://localhost:${port}/download/${objectKey}`;

    res.json({
      success: true,
      signedUrl,
      metadata
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed generating download URL',
      message: error.message
    });
  }
});

// 3b. Handle actual file download
app.get('/download/:objectKey', (req, res) => {
  try {
    const { objectKey } = req.params;

    if (!objectKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing objectKey parameter'
      });
    }

    // Load metadata
    const metadataDir = getMetadataDir();
    const metadataPath = path.join(metadataDir, `${objectKey}.json`);

    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({
        success: false,
        error: `Object metadata not found: ${objectKey}`
      });
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

    // Load file from binary cache
    const binaryCacheDir = path.join(os.homedir(), '.neutralbase', 'binary-cache');
    const filePath = path.join(binaryCacheDir, objectKey);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: `File not found in storage: ${objectKey}`
      });
    }

    const fileContent = fs.readFileSync(filePath);

    // Set headers for file download
    res.setHeader('Content-Type', metadata.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${metadata.fileName}"`);
    res.setHeader('Content-Length', fileContent.length);

    console.log(`⬇️ File downloaded: ${objectKey} (${fileContent.length} bytes)`);

    res.send(fileContent);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to download file',
      message: error.message
    });
  }
});

// 4. Get Object Metadata
app.get('/api/s3/metadata/:objectKey', (req, res) => {
  try {
    const { objectKey } = req.params;

    const metadataDir = getMetadataDir();
    const metadataPath = path.join(metadataDir, `${objectKey}.json`);

    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({
        success: false,
        error: `Object not found: ${objectKey}`
      });
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

    res.json({
      success: true,
      metadata
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed getting metadata',
      message: error.message
    });
  }
});

// 5. List All Objects
app.get('/api/s3/objects', (req, res) => {
  try {
    const metadataDir = getMetadataDir();
    const files = fs.readdirSync(metadataDir).filter(file => file.endsWith('.json'));

    const objects = files.map(file => {
      const metadataPath = path.join(metadataDir, file);
      return JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    });

    res.json({
      success: true,
      objects,
      count: objects.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed listing objects',
      message: error.message
    });
  }
});

// 6. Delete Object
app.delete('/api/s3/objects/:objectKey', (req, res) => {
  try {
    const { objectKey } = req.params;

    const metadataDir = getMetadataDir();
    const metadataPath = path.join(metadataDir, `${objectKey}.json`);

    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({
        success: false,
        error: `Object ${objectKey} not found or could not be deleted`
      });
    }

    fs.unlinkSync(metadataPath);

    res.json({
      success: true,
      message: `Object ${objectKey} deleted successfully`
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed deleting object',
      message: error.message
    });
  }
});

// 7. Service Status
app.get('/api/s3/status', (req, res) => {
  try {
    const metadataDir = getMetadataDir();
    const files = fs.readdirSync(metadataDir).filter(file => file.endsWith('.json'));

    res.json({
      success: true,
      status: {
        isLocalServerRunning: true,
        localServerPort: port,
        metadataStorePath: metadataDir,
        totalObjectsStored: files.length,
        lastActivity: new Date().toISOString()
      },
      server: {
        port: port,
        endpoint: `http://localhost:${port}`,
        uptime: process.uptime()
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed getting service status',
      message: error.message
    });
  }
});

// 8. Service Configuration
app.get('/api/s3/config', (req, res) => {
  res.json({
    success: true,
    config: {
      localEndpoint: `http://localhost:${port}`,
      defaultExpiry: 3600,
      metadataDir: 's3-metadata',
      defaultBucket: 'local-files'
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
});

// Error handling
app.use((err, req, res, next) => {
  console.error('[S3Server] Unhandled error:', err.message);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// Start server
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`✅ S3 Service Server started on http://localhost:${port}`);
  console.log(`🏥 Health check: http://localhost:${port}/health`);
  console.log(`📋 Configuration: http://localhost:${port}/api/s3/config`);
  console.log('\n🧪 Ready for Postman testing!');
  console.log('\n📝 Quick test URLs:');
  console.log(`   GET  http://localhost:${port}/health`);
  console.log(`   GET  http://localhost:${port}/api/s3/config`);
  console.log(`   GET  http://localhost:${port}/api/s3/objects`);
  console.log('\n⚠️  Press Ctrl+C to stop the server');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down S3 Service Server...');
  server.close(() => {
    console.log('✅ Server stopped gracefully');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  server.close(() => {
    console.log('✅ Server stopped gracefully');
    process.exit(0);
  });
});