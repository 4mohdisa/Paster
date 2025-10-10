# Postman Testing Guide for S3 Service

## Step 1: Start the Server

First, start the S3 service server:

```bash
cd /Users/mohammedisa/Development/App/electron-aipaste/apps/live-app
node start-s3-server.js
```

You should see:
```
✅ S3 Service Server started on http://localhost:9000
🏥 Health check: http://localhost:9000/health
📋 Configuration: http://localhost:9000/api/s3/config
🧪 Ready for Postman testing!
```

**Keep this terminal running while testing in Postman!**

## Step 2: Open Postman

1. Open Postman application
2. Create a new Collection called "S3 Service Tests"

## Step 3: Test Each Endpoint

### Test 1: Health Check ✅
**Method:** `GET`
**URL:** `http://localhost:9000/health`
**Headers:** None needed
**Body:** None

**Expected Response:**
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

### Test 2: Get Configuration ✅
**Method:** `GET`
**URL:** `http://localhost:9000/api/s3/config`
**Headers:** None needed
**Body:** None

**Expected Response:**
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

### Test 3: Generate Upload URL 📤
**Method:** `POST`
**URL:** `http://localhost:9000/api/s3/generate-upload-url`
**Headers:**
- `Content-Type: application/json`

**Body (JSON):**
```json
{
  "filePath": "/Users/test/document.pdf",
  "storageType": "local",
  "fileName": "document.pdf",
  "contentType": "application/pdf"
}
```

**Expected Response:**
```json
{
  "success": true,
  "signedUrl": "http://localhost:9000/upload-metadata/a1b2c3d4e5f6g7h8...",
  "objectKey": "a1b2c3d4e5f6g7h8..."
}
```

**⚠️ Copy the `objectKey` from the response - you'll need it for the next tests!**

### Test 4: Get Object Metadata 📋
**Method:** `GET`
**URL:** `http://localhost:9000/api/s3/metadata/{objectKey}`
**Replace `{objectKey}` with the actual key from Test 3**
**Headers:** None needed
**Body:** None

**Expected Response:**
```json
{
  "success": true,
  "metadata": {
    "objectKey": "your-object-key-here",
    "filePath": "/Users/test/document.pdf",
    "fileName": "document.pdf",
    "fileSize": 0,
    "mimeType": "application/pdf",
    "createdAt": "2025-01-18T10:30:00.000Z",
    "lastModified": "2025-01-18T10:30:00.000Z",
    "storageType": "local"
  }
}
```

### Test 5: Generate Download URL ⬇️
**Method:** `POST`
**URL:** `http://localhost:9000/api/s3/generate-download-url`
**Headers:**
- `Content-Type: application/json`

**Body (JSON):**
```json
{
  "objectKey": "your-object-key-from-test-3",
  "storageType": "local",
  "expiresIn": 3600
}
```

**Expected Response:**
```json
{
  "success": true,
  "signedUrl": "http://localhost:9000/download-metadata/your-object-key",
  "metadata": {
    "objectKey": "your-object-key",
    "filePath": "/Users/test/document.pdf",
    "fileName": "document.pdf",
    "storageType": "local"
  }
}
```

### Test 6: List All Objects 📋
**Method:** `GET`
**URL:** `http://localhost:9000/api/s3/objects`
**Headers:** None needed
**Body:** None

**Expected Response:**
```json
{
  "success": true,
  "objects": [
    {
      "objectKey": "your-object-key",
      "filePath": "/Users/test/document.pdf",
      "fileName": "document.pdf",
      "storageType": "local"
    }
  ],
  "count": 1,
  "timestamp": "2025-01-18T10:35:00.000Z"
}
```

### Test 7: Get Service Status 📊
**Method:** `GET`
**URL:** `http://localhost:9000/api/s3/status`
**Headers:** None needed
**Body:** None

**Expected Response:**
```json
{
  "success": true,
  "status": {
    "isLocalServerRunning": true,
    "localServerPort": 9000,
    "metadataStorePath": "/Users/username/.neutralbase/s3-metadata",
    "totalObjectsStored": 1,
    "lastActivity": "2025-01-18T10:35:00.000Z"
  },
  "server": {
    "port": 9000,
    "endpoint": "http://localhost:9000",
    "uptime": 123.456
  }
}
```

### Test 8: Delete Object 🗑️
**Method:** `DELETE`
**URL:** `http://localhost:9000/api/s3/objects/{objectKey}`
**Replace `{objectKey}` with your actual object key**
**Headers:** None needed
**Body:** None

**Expected Response:**
```json
{
  "success": true,
  "message": "Object your-object-key deleted successfully"
}
```

## Quick Testing Workflow

1. **Start Server:** Run `node start-s3-server.js`
2. **Health Check:** GET `/health` (should return status: "ok")
3. **Create Object:** POST `/api/s3/generate-upload-url` with test file path
4. **Verify Object:** GET `/api/s3/metadata/{objectKey}` using the returned key
5. **Get Download URL:** POST `/api/s3/generate-download-url` with the object key
6. **List Objects:** GET `/api/s3/objects` (should show your test object)
7. **Clean Up:** DELETE `/api/s3/objects/{objectKey}` to remove test data

## Troubleshooting

### Server Not Starting
- Check if port 9000 is already in use: `lsof -ti:9000`
- Kill existing process: `kill -9 $(lsof -ti:9000)`

### "Connection Refused" in Postman
- Ensure the server is running (check terminal output)
- Verify the URL is exactly `http://localhost:9000`

### JSON Parse Errors
- Make sure `Content-Type: application/json` header is set for POST requests
- Verify JSON syntax in request body

### Metadata Not Found
- Object keys are case-sensitive
- Make sure you created an object first with the upload URL endpoint

## Success Indicators

✅ **All tests pass:** S3 service is working correctly
✅ **Consistent object keys:** Same file path always generates same key
✅ **Metadata persistence:** Objects remain listed between requests
✅ **Clean responses:** All responses have proper `success` field

## Ready for Alex!

When all these tests pass, you can confidently tell Alex:
- ✅ Express server is running and responding
- ✅ All API endpoints are functional
- ✅ Object key generation works consistently
- ✅ Metadata storage and retrieval is working
- ✅ Main `getPresignedDownloadURLObjectKey` function is ready for Yasin

**Stop the server with Ctrl+C when done testing.**