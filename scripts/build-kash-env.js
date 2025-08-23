#!/usr/bin/env node

/**
 * Build script to create a standalone Python environment with Kash
 * using py-app-standalone. This bundles Python + Kash so users
 * don't need Python installed on their machines.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PYTHON_VERSION = '3.11';
const TARGET_DIR = path.join(__dirname, '..', 'electron', 'resources', 'kash-env');

async function checkUv() {
  return new Promise((resolve) => {
    const check = spawn('uvx', ['--version']);
    check.on('close', (code) => {
      resolve(code === 0);
    });
    check.on('error', () => {
      resolve(false);
    });
  });
}

async function installUv() {
  console.log('Installing uv...');
  return new Promise((resolve, reject) => {
    const install = spawn('curl', ['-LsSf', 'https://astral.sh/uv/install.sh'], {
      shell: true
    });
    
    const sh = spawn('sh', [], { stdio: ['pipe', 'inherit', 'inherit'] });
    install.stdout.pipe(sh.stdin);
    
    sh.on('close', (code) => {
      if (code === 0) {
        console.log('✓ uv installed successfully');
        resolve();
      } else {
        reject(new Error(`Failed to install uv (exit code ${code})`));
      }
    });
  });
}

async function buildKashEnvironment() {
  console.log(`Building standalone Python environment with Kash...`);
  console.log(`Target directory: ${TARGET_DIR}`);
  console.log(`Python version: ${PYTHON_VERSION}`);
  
  // Remove existing environment if it exists
  if (fs.existsSync(TARGET_DIR)) {
    console.log('Removing existing environment...');
    fs.rmSync(TARGET_DIR, { recursive: true, force: true });
  }
  
  return new Promise((resolve, reject) => {
    // Build command with all required packages
    const args = [
      'py-app-standalone',
      'kash',              // Main Kash package
      'kash-media',        // For OCR and media processing
      'python-docx',       // For DOCX file handling
      'docx2txt',          // Alternative DOCX converter
      'html2text',         // For HTML to Markdown
      'beautifulsoup4',    // For HTML parsing
      'mammoth',           // Another DOCX converter option
      '--target', TARGET_DIR,
      '--python-version', PYTHON_VERSION
    ];
    
    console.log('Running:', 'uvx', args.join(' '));
    
    const build = spawn('uvx', args, {
      stdio: 'inherit'
    });
    
    build.on('close', (code) => {
      if (code === 0) {
        console.log('✓ Kash environment built successfully');
        resolve();
      } else {
        reject(new Error(`py-app-standalone failed with exit code ${code}`));
      }
    });
    
    build.on('error', (err) => {
      reject(new Error(`Failed to run py-app-standalone: ${err.message}`));
    });
  });
}

async function verifyEnvironment() {
  console.log('Verifying Kash environment...');
  
  // Find the Python executable
  const pythonPaths = [
    path.join(TARGET_DIR, 'bin', 'python3'),
    path.join(TARGET_DIR, 'bin', 'python'),
    // macOS/Linux with version
    path.join(TARGET_DIR, `cpython-${PYTHON_VERSION}*`, 'bin', 'python3'),
    // Windows
    path.join(TARGET_DIR, 'Scripts', 'python.exe'),
  ];
  
  let pythonPath = null;
  for (const p of pythonPaths) {
    // Handle glob patterns
    const glob = require('glob');
    const matches = glob.sync(p);
    if (matches.length > 0 && fs.existsSync(matches[0])) {
      pythonPath = matches[0];
      break;
    }
    if (fs.existsSync(p)) {
      pythonPath = p;
      break;
    }
  }
  
  if (!pythonPath) {
    throw new Error('Python executable not found in built environment');
  }
  
  console.log(`Found Python at: ${pythonPath}`);
  
  // Test that Kash is available
  return new Promise((resolve, reject) => {
    const test = spawn(pythonPath, ['-c', 'import kash; print("Kash imported successfully")']);
    
    let output = '';
    test.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    test.stderr.on('data', (data) => {
      console.error('Error:', data.toString());
    });
    
    test.on('close', (code) => {
      if (code === 0) {
        console.log('✓', output.trim());
        
        // Save the Python path for later use
        const configPath = path.join(TARGET_DIR, 'python-path.json');
        fs.writeFileSync(configPath, JSON.stringify({
          pythonPath: path.relative(TARGET_DIR, pythonPath),
          version: PYTHON_VERSION,
          platform: process.platform
        }, null, 2));
        
        console.log(`✓ Configuration saved to ${configPath}`);
        resolve();
      } else {
        reject(new Error('Failed to import Kash in built environment'));
      }
    });
  });
}

async function main() {
  try {
    console.log('=== Building Kash Standalone Environment ===\n');
    
    // Check if uv is installed
    const hasUv = await checkUv();
    if (!hasUv) {
      console.log('uv not found. Installing...');
      await installUv();
    } else {
      console.log('✓ uv is installed');
    }
    
    // Build the Kash environment
    await buildKashEnvironment();
    
    // Verify it works
    await verifyEnvironment();
    
    console.log('\n=== Build Complete ===');
    console.log(`Kash environment is ready at: ${TARGET_DIR}`);
    console.log('This environment includes:');
    console.log('  - Python', PYTHON_VERSION);
    console.log('  - Kash (file processing framework)');
    console.log('  - Document converters (docx, html, etc.)');
    console.log('\nNo Python installation required on user machines!');
    
  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}