#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const CONVEX_VERSION = 'latest'; // You can pin this to a specific version
const BASE_URL = 'https://github.com/get-convex/convex-backend/releases/download';

// Map platform/arch to Convex binary names
const BINARY_MAP = {
  'darwin-arm64': 'convex-local-backend-aarch64-apple-darwin.zip',
  'darwin-x64': 'convex-local-backend-x86_64-apple-darwin.zip',
  'linux-x64': 'convex-local-backend-x86_64-unknown-linux-gnu.tar.xz',
  'win32-x64': 'convex-local-backend-x86_64-pc-windows-msvc.zip'
};

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        https.get(response.headers.location, (redirectResponse) => {
          redirectResponse.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        }).on('error', reject);
      } else {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }
    }).on('error', reject);
  });
}

async function extractArchive(archivePath, destDir) {
  const ext = path.extname(archivePath);
  
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  if (ext === '.zip') {
    // Use unzip for .zip files
    execSync(`unzip -o "${archivePath}" -d "${destDir}"`, { stdio: 'inherit' });
  } else if (archivePath.endsWith('.tar.xz')) {
    // Use tar for .tar.xz files
    execSync(`tar -xf "${archivePath}" -C "${destDir}"`, { stdio: 'inherit' });
  } else {
    throw new Error(`Unsupported archive format: ${ext}`);
  }
}

async function main() {
  const platform = process.platform;
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const platformKey = `${platform}-${arch}`;
  
  const binaryName = BINARY_MAP[platformKey];
  if (!binaryName) {
    console.error(`Unsupported platform: ${platformKey}`);
    process.exit(1);
  }
  
  console.log(`Downloading Convex backend for ${platformKey}...`);
  
  // Determine paths
  const resourcesDir = path.join(__dirname, '..', 'resources');
  const binDir = path.join(resourcesDir, 'bin', platformKey);
  const tempDir = path.join(resourcesDir, 'temp');
  const archivePath = path.join(tempDir, binaryName);
  
  // Create directories
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Build download URL
  let downloadUrl;
  if (CONVEX_VERSION === 'latest') {
    // For latest, we need to fetch the latest release info first
    console.log('Fetching latest release info...');
    const latestUrl = 'https://api.github.com/repos/get-convex/convex-backend/releases/latest';
    
    const releaseInfo = await new Promise((resolve, reject) => {
      https.get(latestUrl, { headers: { 'User-Agent': 'electron-aipaste' } }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });
    
    const asset = releaseInfo.assets.find(a => a.name === binaryName);
    if (!asset) {
      console.error(`Binary ${binaryName} not found in latest release`);
      process.exit(1);
    }
    downloadUrl = asset.browser_download_url;
  } else {
    downloadUrl = `${BASE_URL}/v${CONVEX_VERSION}/${binaryName}`;
  }
  
  console.log(`Downloading from: ${downloadUrl}`);
  
  // Download the archive
  await downloadFile(downloadUrl, archivePath);
  console.log('Download complete.');
  
  // Extract the archive
  console.log('Extracting archive...');
  await extractArchive(archivePath, binDir);
  
  // Make binary executable (Unix-like systems)
  if (platform !== 'win32') {
    const binaryPath = path.join(binDir, 'convex-local-backend');
    if (fs.existsSync(binaryPath)) {
      fs.chmodSync(binaryPath, '755');
      console.log(`Made ${binaryPath} executable`);
    }
  }
  
  // Clean up temp files
  fs.rmSync(tempDir, { recursive: true, force: true });
  
  console.log(`✅ Convex backend binary installed to ${binDir}`);
}

main().catch(error => {
  console.error('Error downloading Convex binary:', error);
  process.exit(1);
});