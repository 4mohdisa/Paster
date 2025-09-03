#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';

console.log('🧹 AiPaste Fresh Start - Cleaning all temporary files and caches...\n');

// Paths to clean
const projectRoot = path.join(__dirname, '..');
const cleanPaths = [
  // Node modules
  'node_modules',
  'apps/*/node_modules',
  'packages/*/node_modules',
  'electron/node_modules',
  'native/*/node_modules',

  // Build artifacts
  'apps/*/.next',
  'electron/dist',
  'electron/build',
  'electron/out',
  'native/swift-cli/.build',

  // Lock files
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',

  // Convex binaries and data
  'electron/resources/bin',
  'electron/resources/temp',
  'electron/convex_local_backend.sqlite3',
  'electron/convex_local_backend.sqlite3-shm',
  'electron/convex_local_backend.sqlite3-wal',
  '.convex-dev-db',
  'electron/.convex-dev-db',

  // Kash environment
  'electron/resources/kash-env',

  // TypeScript build info
  '**/*.tsbuildinfo',

  // Log files
  '**/*.log',
  'logs',

  // Settings file (for development)
  '.aipaste-settings.json',
];

// User data paths (platform specific)
const userDataPaths = [];

if (isMac) {
  userDataPaths.push(
    path.join(os.homedir(), 'Library', 'Application Support', 'AiPaste'),
    path.join(os.homedir(), 'Library', 'Application Support', 'AiPaste', 'aipaste-convex-db'),
    path.join(os.homedir(), 'Library', 'Application Support', 'AiPaste', 'Local Storage'),  // This clears localStorage
    path.join(os.homedir(), 'Library', 'Application Support', 'AiPaste', 'settings.json'),  // Production settings file
    path.join(os.homedir(), 'Library', 'Caches', 'AiPaste'),
    path.join(os.homedir(), 'Library', 'Logs', 'AiPaste'),
    path.join(os.homedir(), 'Library', 'Preferences', 'com.aipaste.app.plist'),
    // KASH (CLI-style data under home)
    path.join(os.homedir(), '.aipaste'),
    path.join(os.homedir(), '.aipaste', 'kash-env'),
    path.join(os.homedir(), '.aipaste', 'kash-workspace'),
    path.join(os.homedir(), '.aipaste', 'enabled-actions.json')
  );
} else if (isWindows) {
  userDataPaths.push(
    path.join(os.homedir(), 'AppData', 'Roaming', '@aipaste'),
    path.join(os.homedir(), 'AppData', 'Local', '@aipaste'),
  );
} else {
  // Linux
  userDataPaths.push(
    path.join(os.homedir(), '.config', '@aipaste'),
    path.join(os.homedir(), '.cache', '@aipaste'),
    path.join(os.homedir(), '.local', 'share', '@aipaste')
  );
}

// Function to expand glob patterns
function expandGlob(pattern, basePath) {
  const fullPattern = path.join(basePath, pattern);
  try {
    // Use simple glob expansion for common patterns
    if (pattern.includes('*')) {
      const parts = pattern.split('/');
      let currentPaths = [basePath];

      for (const part of parts) {
        const newPaths = [];
        for (const currentPath of currentPaths) {
          if (part === '*') {
            // Match all directories at this level
            if (fs.existsSync(currentPath) && fs.statSync(currentPath).isDirectory()) {
              const items = fs.readdirSync(currentPath);
              for (const item of items) {
                const itemPath = path.join(currentPath, item);
                if (fs.statSync(itemPath).isDirectory()) {
                  newPaths.push(itemPath);
                }
              }
            }
          } else if (part.includes('*')) {
            // Handle patterns like *.log
            if (fs.existsSync(currentPath) && fs.statSync(currentPath).isDirectory()) {
              const items = fs.readdirSync(currentPath);
              const regex = new RegExp('^' + part.replace(/\*/g, '.*') + '$');
              for (const item of items) {
                if (regex.test(item)) {
                  newPaths.push(path.join(currentPath, item));
                }
              }
            }
          } else {
            // Exact match
            newPaths.push(path.join(currentPath, part));
          }
        }
        currentPaths = newPaths;
      }
      return currentPaths;
    } else {
      // No glob pattern, return as is
      return [fullPattern];
    }
  } catch (error) {
    return [];
  }
}

// Function to safely remove a path
function removePath(targetPath) {
  try {
    if (fs.existsSync(targetPath)) {
      const stats = fs.statSync(targetPath);
      const relativePath = path.relative(projectRoot, targetPath);
      const displayPath = relativePath.startsWith('..') ? targetPath : relativePath;

      if (stats.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
        console.log(`  ✓ Removed directory: ${displayPath}`);
      } else {
        fs.unlinkSync(targetPath);
        console.log(`  ✓ Removed file: ${displayPath}`);
      }
      return true;
    }
  } catch (error) {
    console.log(`  ⚠️  Failed to remove: ${targetPath} - ${error.message}`);
  }
  return false;
}

// Kill any running processes
console.log('📋 Stopping running processes...');
try {
  if (isMac || !isWindows) {
    // Kill Electron processes
    execSync("pkill -f 'electron-aipaste/node_modules/.*/Electron' 2>/dev/null || true", { stdio: 'ignore' });
    // Kill Swift CLI processes
    execSync("pkill -f 'AiPasteHelper' 2>/dev/null || true", { stdio: 'ignore' });
    // Kill node processes related to the project
    execSync("pkill -f 'aipaste' 2>/dev/null || true", { stdio: 'ignore' });
    // Kill Convex backend
    execSync("pkill -f 'convex-local-backend' 2>/dev/null || true", { stdio: 'ignore' });
  } else {
    // Windows commands
    execSync('taskkill /F /IM electron.exe 2>NUL || exit 0', { stdio: 'ignore' });
    execSync('taskkill /F /IM AiPasteHelper.exe 2>NUL || exit 0', { stdio: 'ignore' });
    execSync('taskkill /F /IM convex-local-backend.exe 2>NUL || exit 0', { stdio: 'ignore' });
  }
  console.log('  ✓ Stopped all processes\n');
} catch (error) {
  console.log('  ⚠️  Some processes may still be running\n');
}

// Clean project paths
console.log('📁 Cleaning project files...');
let cleanedCount = 0;
for (const pattern of cleanPaths) {
  const paths = expandGlob(pattern, projectRoot);
  for (const targetPath of paths) {
    if (removePath(targetPath)) {
      cleanedCount++;
    }
  }
}

// Clean user data (optional - ask for confirmation)
console.log('\n🏠 Cleaning user data...');
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Do you want to clean user data as well? This will remove all app settings and history. (y/N): ', (answer) => {
  if (answer.toLowerCase() === 'y') {
    for (const userPath of userDataPaths) {
      if (removePath(userPath)) {
        cleanedCount++;
      }
    }
  }

  console.log(`\n✨ Cleanup complete! Removed ${cleanedCount} items.`);
  console.log('\n📦 Next steps:');
  console.log('  1. Run: pnpm install    (installs deps + Convex binary)');
  console.log('  2. Run: pnpm build      (builds Swift CLI)');
  console.log('  3. Run: pnpm dev        (starts app with Convex backend)\n');
  console.log('💡 Note: Convex backend will auto-start on port 52100');
  console.log('         Check the UI for connection status toasts\n');

  rl.close();
});