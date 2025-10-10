# S3 Service Postman Testing Examples

Complete testing guide for the S3 Service Express server endpoints with ready-to-use Postman examples.

## Server Setup

First, start the S3 Service server:

```typescript
import { createLocalS3Server } from './s3-service';

// Start server on default port 9000
const server = await createLocalS3Server();
console.log('S3 Service server running on http://localhost:9000');
```

Base URL: `http://localhost:9000`

## Core API Endpoints (Postman Ready)

### 1. Health Check
**GET** `/health`

**Purpose**: Verify server is running and get basic status information

**Request**:
```
Method: GET
URL: http://localhost:9000/health
Headers: None required
Body: None
```

**Expected Response**:
```json
{
  "status": "ok",
  "service": "LocalS3Server",
  "version": "1.0.0",
  "timestamp": "2025-01-18T10:30:00.000Z",
  "port": 9000,
  "endpoint": "http://localhost:9000"
}
```

### 2. Generate Upload URL
**POST** `/api/s3/generate-upload-url`

**Purpose**: Create presigned URL for file upload and store metadata

**Request**:
```
Method: POST
URL: http://localhost:9000/api/s3/generate-upload-url
Headers:
  Content-Type: application/json
Body (JSON):
{
  "filePath": "/Users/username/Documents/test-file.pdf",
  "storageType": "local",
  "fileName": "test-file.pdf",
  "contentType": "application/pdf"
}
```

**Expected Response**:
```json
{
  "success": true,
  "signedUrl": "http://localhost:9000/upload-metadata/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "objectKey": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

### 3. Generate Download URL
**POST** `/api/s3/generate-download-url`

**Purpose**: Create presigned URL for file download

**Request**:
```
Method: POST
URL: http://localhost:9000/api/s3/generate-download-url
Headers:
  Content-Type: application/json
Body (JSON):
{
  "objectKey": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "storageType": "local",
  "expiresIn": 3600
}
```

**Expected Response**:
```json
{
  "success": true,
  "signedUrl": "http://localhost:9000/download-metadata/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "metadata": {
    "objectKey": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "filePath": "/Users/username/Documents/test-file.pdf",
    "fileName": "test-file.pdf",
    "fileSize": 102400,
    "mimeType": "application/pdf",
    "createdAt": "2025-01-18T10:30:00.000Z",
    "lastModified": "2025-01-18T10:25:00.000Z",
    "storageType": "local"
  }
}
```

### 4. Get Object Metadata
**GET** `/api/s3/metadata/:objectKey`

**Purpose**: Retrieve metadata for a specific object

**Request**:
```
Method: GET
URL: http://localhost:9000/api/s3/metadata/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
Headers: None required
Body: None
```

**Expected Response**:
```json
{
  "success": true,
  "metadata": {
    "objectKey": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "filePath": "/Users/username/Documents/test-file.pdf",
    "fileName": "test-file.pdf",
    "fileSize": 102400,
    "mimeType": "application/pdf",
    "createdAt": "2025-01-18T10:30:00.000Z",
    "lastModified": "2025-01-18T10:25:00.000Z",
    "storageType": "local"
  }
}
```

### 5. List All Objects
**GET** `/api/s3/objects`

**Purpose**: Get list of all stored objects with metadata

**Request**:
```
Method: GET
URL: http://localhost:9000/api/s3/objects
Headers: None required
Body: None
```

**Expected Response**:
```json
{
  "success": true,
  "objects": [
    {
      "objectKey": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
      "filePath": "/Users/username/Documents/test-file.pdf",
      "fileName": "test-file.pdf",
      "fileSize": 102400,
      "mimeType": "application/pdf",
      "createdAt": "2025-01-18T10:30:00.000Z",
      "lastModified": "2025-01-18T10:25:00.000Z",
      "storageType": "local"
    }
  ],
  "count": 1,
  "timestamp": "2025-01-18T10:35:00.000Z"
}
```

### 6. Delete Object
**DELETE** `/api/s3/objects/:objectKey`

**Purpose**: Delete object metadata from storage

**Request**:
```
Method: DELETE
URL: http://localhost:9000/api/s3/objects/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
Headers: None required
Body: None
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Object a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6 deleted successfully"
}
```

### 7. Service Status
**GET** `/api/s3/status`

**Purpose**: Get detailed service status and statistics

**Request**:
```
Method: GET
URL: http://localhost:9000/api/s3/status
Headers: None required
Body: None
```

**Expected Response**:
```json
{
  "success": true,
  "status": {
    "isLocalServerRunning": true,
    "localServerPort": 9000,
    "metadataStorePath": "/Users/username/.neutralbase/s3-metadata",
    "totalObjectsStored": 5,
    "lastActivity": "2025-01-18T10:35:00.000Z"
  },
  "server": {
    "port": 9000,
    "endpoint": "http://localhost:9000",
    "uptime": 1234.567
  }
}
```

### 8. Service Configuration
**GET** `/api/s3/config`

**Purpose**: Get service configuration and available endpoints

**Request**:
```
Method: GET
URL: http://localhost:9000/api/s3/config
Headers: None required
Body: None
```

**Expected Response**:
```json
{
  "success": true,
  "config": {
    "localEndpoint": "http://localhost:9000",
    "defaultExpiry": 3600,
    "metadataDir": "s3-metadata",
    "defaultBucket": "local-files"
  },
  "endpoints": {
    "health": "/health",
    "generateUploadURL": "/api/s3/generate-upload-url",
    "generateDownloadURL": "/api/s3/generate-download-url",
    "getMetadata": "/api/s3/metadata/:objectKey",
    "listObjects": "/api/s3/objects",
    "deleteObject": "/api/s3/objects/:objectKey"
  }
}
```

## S3-Compatible Endpoints (Future AWS SDK Integration)

### 9. S3 PUT Object Metadata
**PUT** `/upload-metadata/:objectKey`

**Purpose**: S3-compatible metadata storage endpoint

**Request**:
```
Method: PUT
URL: http://localhost:9000/upload-metadata/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
Headers:
  Content-Type: application/json
Body (JSON):
{
  "objectKey": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "filePath": "/Users/username/Documents/test-file.pdf",
  "fileName": "test-file.pdf",
  "fileSize": 102400,
  "mimeType": "application/pdf",
  "storageType": "local"
}
```

### 10. S3 GET Object Metadata
**GET** `/download-metadata/:objectKey`

**Purpose**: S3-compatible metadata retrieval endpoint

**Request**:
```
Method: GET
URL: http://localhost:9000/download-metadata/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
Headers: None required
Body: None
```

### 11. S3 HEAD Object Check
**HEAD** `/download-metadata/:objectKey`

**Purpose**: S3-compatible object existence check

**Request**:
```
Method: HEAD
URL: http://localhost:9000/download-metadata/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
Headers: None required
Body: None
```

### 12. S3 DELETE Object
**DELETE** `/delete-metadata/:objectKey`

**Purpose**: S3-compatible object deletion endpoint

**Request**:
```
Method: DELETE
URL: http://localhost:9000/delete-metadata/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
Headers: None required
Body: None
```

## Error Response Examples

### 400 Bad Request
```json
{
  "success": false,
  "error": "Missing required fields: filePath and storageType are required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Object not found: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Failed generating upload URL",
  "message": "File not found: /invalid/path/file.txt",
  "timestamp": "2025-01-18T10:30:00.000Z"
}
```

## Testing Workflow

### Step-by-Step Testing Process

1. **Start Server**: Ensure the S3 service is running
2. **Health Check**: Verify server is responding
3. **Generate Upload URL**: Create upload URL for a test file
4. **Store Metadata**: Use the upload URL to store file metadata
5. **List Objects**: Verify object appears in the list
6. **Get Metadata**: Retrieve specific object metadata
7. **Generate Download URL**: Create download URL for the object
8. **Delete Object**: Clean up test data

### Quick Test Script

```javascript
// Basic test sequence for Postman or JavaScript
const baseUrl = 'http://localhost:9000';

// 1. Health check
fetch(`${baseUrl}/health`)
  .then(r => r.json())
  .then(console.log);

// 2. Generate upload URL
fetch(`${baseUrl}/api/s3/generate-upload-url`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    filePath: '/path/to/test/file.txt',
    storageType: 'local'
  })
})
.then(r => r.json())
.then(console.log);
```

## Notes for Yasin's Integration

The main function Yasin needs is available through the S3ServiceManager:

```typescript
import { S3ServiceManager } from './s3-service';

const s3Service = new S3ServiceManager();

// Main function for getting download URLs
const downloadUrl = await s3Service.getPresignedDownloadURLObjectKey('your-object-key');
```

All endpoints are ready for testing and integration with the existing Electron architecture.