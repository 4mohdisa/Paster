#!/usr/bin/env node

/**
 * Script to download and embed uv binary for macOS
 * Downloads appropriate architecture (x64 or arm64)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// uv release version to use
const UV_VERSION = '0.8.13';

// Determine architecture
const arch = process.arch === 'arm64' ? 'aarch64' : 'x86_64';
const platform = 'apple-darwin';

// Download URL
const downloadUrl = `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/uv-${arch}-${platform}.tar.gz`;

// Target paths
const resourcesDir = path.join(__dirname, '..', 'electron', 'resources');
const binDir = path.join(resourcesDir, 'bin');
const uvPath = path.join(binDir, 'uv');
const tempFile = path.join(binDir, 'uv.tar.gz');

// Ensure directories exist
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

// Check if uv already exists
if (fs.existsSync(uvPath)) {
  try {
    const version = execSync(`${uvPath} --version`, { encoding: 'utf8' }).trim();
    console.log(`✅ uv already installed: ${version}`);
    process.exit(0);
  } catch (e) {
    console.log('⚠️  Existing uv binary is corrupted, re-downloading...');
    fs.unlinkSync(uvPath);
  }
}

console.log(`📦 Downloading uv ${UV_VERSION} for ${arch}...`);
console.log(`   URL: ${downloadUrl}`);

// Download function
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        file.close();
        return download(response.headers.location, dest).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        const percent = Math.round((downloadedSize / totalSize) * 100);
        process.stdout.write(`\r   Progress: ${percent}% (${Math.round(downloadedSize / 1024 / 1024 * 10) / 10}MB)`);
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log('\n');
        resolve();
      });
    }).on('error', (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

// Main execution
async function main() {
  try {
    // Download tar.gz
    await download(downloadUrl, tempFile);
    console.log('✅ Download complete');
    
    // Extract tar.gz (creates a directory with uv and uvx binaries)
    console.log('📂 Extracting uv binary...');
    execSync(`tar -xzf ${tempFile} -C ${binDir}`, { stdio: 'inherit' });
    
    // Move uv binary from extracted directory to bin/
    const extractedDir = path.join(binDir, `uv-${arch}-${platform}`);
    const extractedUv = path.join(extractedDir, 'uv');
    const extractedUvx = path.join(extractedDir, 'uvx');
    
    if (fs.existsSync(extractedUv)) {
      fs.renameSync(extractedUv, uvPath);
      
      // Also move uvx if present (though we won't use it for lazy loading)
      const uvxPath = path.join(binDir, 'uvx');
      if (fs.existsSync(extractedUvx)) {
        fs.renameSync(extractedUvx, uvxPath);
      }
      
      // Clean up extracted directory
      fs.rmSync(extractedDir, { recursive: true });
    } else {
      throw new Error('uv binary not found in extracted archive');
    }
    
    // Make it executable
    fs.chmodSync(uvPath, '755');
    
    // Clean up tar file
    fs.unlinkSync(tempFile);
    
    // Verify installation
    const version = execSync(`${uvPath} --version`, { encoding: 'utf8' }).trim();
    console.log(`✅ uv successfully installed: ${version}`);
    console.log(`📍 Location: ${uvPath}`);
    
    // Create a symlink for different architectures if needed
    const uvUniversal = path.join(binDir, `uv-${process.arch}`);
    if (!fs.existsSync(uvUniversal)) {
      fs.symlinkSync(uvPath, uvUniversal);
    }
    
  } catch (error) {
    console.error('❌ Failed to install uv:', error.message);
    process.exit(1);
  }
}

main();