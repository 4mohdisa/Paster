const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'S3 Manager',
    backgroundColor: '#fafafa',
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// --- IPC Handlers ---

ipcMain.handle('storeViaHttp', async (_event, data) => {
  try {
    const response = await fetch('https://beloved-skunk-37.convex.site/storeS3Metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    return await response.json();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('getAllFiles', async () => {
  try {
    const { ConvexHttpClient } = require('convex/browser');
    const { api } = require('../../../convex/_generated/api');

    const client = new ConvexHttpClient('https://beloved-skunk-37.convex.cloud');
    const result = await client.query(api.s3Integration.listS3Objects, { limit: 50 });

    return result.objects || [];
  } catch (error) {
    console.error('Failed to get files:', error.message);
    return [];
  }
});

ipcMain.handle('deleteFile', async (_event, fileId) => {
  try {
    const { ConvexHttpClient } = require('convex/browser');
    const { api } = require('../../../convex/_generated/api');

    const client = new ConvexHttpClient('https://beloved-skunk-37.convex.cloud');
    const result = await client.mutation(api.s3Integration.deleteS3Object, {
      objectId: fileId
    });

    if (result.success) {
      return { success: true, fileName: result.fileName };
    }
    return { success: false, error: result.error };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('downloadFile', async (_event, objectKey) => {
  try {
    const response = await fetch('http://localhost:9000/api/s3/generate-download-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        objectKey,
        storageType: 'local',
        expiresIn: 3600
      })
    });

    const result = await response.json();

    if (result.success) {
      return {
        success: true,
        downloadUrl: result.signedUrl,
        fileName: result.metadata.fileName,
        fileSize: result.metadata.fileSize
      };
    }
    return { success: false, error: result.error };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('generateTestFile', async () => {
  try {
    const crypto = require('crypto');
    const { ConvexHttpClient } = require('convex/browser');
    const { api } = require('../../../convex/_generated/api');

    // Generate 5MB PNG file
    const TARGET_SIZE = 5 * 1024 * 1024;
    const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const WIDTH = 2000;
    const HEIGHT = 2000;

    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(WIDTH, 0);
    ihdrData.writeUInt32BE(HEIGHT, 4);
    ihdrData[8] = 8;
    ihdrData[9] = 6;

    const OVERHEAD = 8 + 25 + 12;
    const idatDataSize = TARGET_SIZE - OVERHEAD - 12;
    const idatData = crypto.randomBytes(idatDataSize);

    const chunks = [
      PNG_SIGNATURE,
      Buffer.concat([
        Buffer.from([0, 0, 0, 13]),
        Buffer.from('IHDR'),
        ihdrData,
        Buffer.alloc(4)
      ]),
      Buffer.concat([
        Buffer.from([
          (idatDataSize >> 24) & 0xFF,
          (idatDataSize >> 16) & 0xFF,
          (idatDataSize >> 8) & 0xFF,
          idatDataSize & 0xFF
        ]),
        Buffer.from('IDAT'),
        idatData,
        Buffer.alloc(4)
      ]),
      Buffer.concat([
        Buffer.from([0, 0, 0, 0]),
        Buffer.from('IEND'),
        Buffer.alloc(4)
      ])
    ];

    const pngData = Buffer.concat(chunks);
    const fileName = `test-file-${Date.now()}.png`;

    // Request upload URL from S3 service
    const uploadUrlResponse = await fetch('http://localhost:9000/api/s3/generate-upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath: `/test/${fileName}`,
        storageType: 'cloud',
        fileName,
        contentType: 'image/png'
      })
    });

    const uploadUrlResult = await uploadUrlResponse.json();
    if (!uploadUrlResult.success) {
      throw new Error('Failed to get upload URL: ' + uploadUrlResult.error);
    }

    // Upload to R2
    const putResponse = await fetch(uploadUrlResult.signedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': pngData.length.toString()
      },
      body: pngData
    });

    if (!putResponse.ok) {
      throw new Error('R2 upload failed: ' + putResponse.status);
    }

    // Store metadata via S3 service
    const metadataResponse = await fetch(`http://localhost:9000/upload-metadata/${uploadUrlResult.objectKey}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath: `/test/${fileName}`,
        fileName,
        fileSize: pngData.length,
        mimeType: 'image/png',
        storageType: 'cloud',
        timestamp: Date.now()
      })
    });

    const metadataResult = await metadataResponse.json();
    if (!metadataResult.success) {
      throw new Error('Failed to store metadata: ' + metadataResult.error);
    }

    // Store in Convex
    const client = new ConvexHttpClient('https://beloved-skunk-37.convex.cloud');
    await client.mutation(api.s3Integration.storeS3Metadata, {
      objectKey: uploadUrlResult.objectKey,
      fileName,
      fileSize: pngData.length,
      mimeType: 'image/png',
      storageType: 'cloud'
    });

    return {
      success: true,
      objectKey: uploadUrlResult.objectKey,
      fileName,
      fileSize: pngData.length
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('downloadToNeutralBase', async (_event, objectKey) => {
  try {
    const response = await fetch('http://localhost:9000/api/s3/download-to-neutral-base', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objectKey })
    });

    const result = await response.json();

    if (result.success) {
      return { success: true, path: result.path, message: result.message };
    }
    return { success: false, error: result.error, message: result.message };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('getCloudStorageStatus', async () => {
  try {
    const dotenv = require('dotenv');
    const envPath = path.join(__dirname, '..', '..', '..', '.env');

    if (!fs.existsSync(envPath)) {
      return { enabled: false, reason: 'No .env configuration file found', localOnly: true };
    }

    dotenv.config({ path: envPath });

    const cloudEnabled = process.env.CLOUD_STORAGE_ENABLED === 'true';
    const r2AccountId = process.env.R2_ACCOUNT_ID;
    const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
    const r2BucketName = process.env.R2_BUCKET_NAME || 'electron-app-storage';
    const fallbackEnabled = process.env.CLOUD_STORAGE_FALLBACK_TO_LOCAL !== 'false';
    const thresholdMB = parseInt(process.env.CLOUD_STORAGE_THRESHOLD_MB || '5');

    if (!cloudEnabled) {
      return { enabled: false, reason: 'CLOUD_STORAGE_ENABLED is false', localOnly: true };
    }

    const hasCredentials = r2AccountId && r2AccessKeyId && process.env.R2_SECRET_ACCESS_KEY;

    if (!hasCredentials) {
      return {
        enabled: false,
        reason: 'R2 credentials not configured',
        localOnly: true,
        missingCredentials: true
      };
    }

    return {
      enabled: true,
      provider: 'Cloudflare R2',
      bucketName: r2BucketName,
      accountId: r2AccountId?.substring(0, 8) + '...',
      thresholdMB,
      fallbackEnabled,
      localOnly: false
    };
  } catch (error) {
    return { enabled: false, reason: 'Error: ' + error.message, localOnly: true };
  }
});

// --- App Lifecycle ---

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
