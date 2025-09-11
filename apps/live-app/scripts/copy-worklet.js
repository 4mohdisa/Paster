const fs = require('fs');
const path = require('path');

const sourceFile = path.join(__dirname, '..', 'src', 'services', 'worklets', 'audio-processor.js');
const targetDir = path.join(__dirname, '..', '.vite', 'build', 'renderer', 'src', 'services', 'worklets');
const targetFile = path.join(targetDir, 'audio-processor.js');

// Ensure target directory exists
fs.mkdirSync(targetDir, { recursive: true });

// Copy file
fs.copyFileSync(sourceFile, targetFile);

console.log('Copied audio-processor.js to build directory');