#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const kashEnvPath = path.join(__dirname, '..', 'electron', 'resources', 'kash-env');

// Check if kash-env exists and has cpython directory
const hasKashEnv = () => {
  if (!fs.existsSync(kashEnvPath)) return false;
  
  try {
    const dirs = fs.readdirSync(kashEnvPath);
    return dirs.some(dir => dir.startsWith('cpython-'));
  } catch {
    return false;
  }
};

if (!hasKashEnv()) {
  console.log('🔧 Kash environment not found. Building it now...');
  console.log('This is a one-time setup that creates a standalone Python environment.');
  
  try {
    execSync('pnpm build:kash', { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log('✅ Kash environment ready!');
  } catch (error) {
    // Check if Python was actually installed despite the error
    if (fs.existsSync(kashEnvPath)) {
      const dirs = fs.readdirSync(kashEnvPath);
      if (dirs.some(dir => dir.startsWith('cpython-'))) {
        console.log('✅ Kash environment ready (with warnings)');
        return;
      }
    }
    
    console.warn('⚠️  Failed to build Kash environment. Document conversion will be disabled.');
    console.warn('You can manually run "pnpm build:kash" later to enable it.');
    // Don't exit with error - let dev server continue
  }
} else {
  console.log('✅ Kash environment already exists');
}