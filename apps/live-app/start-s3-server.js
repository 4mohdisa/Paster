// Start S3 Server with Cloud R2 Support
// Run with: node start-s3-server.js
// This server properly routes requests to either local storage or Cloudflare R2

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

console.log('🚀 Starting S3 Service Server with R2 Cloud Integration...\n');

// Use LocalS3Server which properly delegates to S3ServiceManager
const { LocalS3Server } = require('./src/s3-service/LocalS3Server');
const { S3ServiceManager } = require('./src/s3-service/S3ServiceManager');

// Log configuration
const cloudEnabled = process.env.CLOUD_STORAGE_ENABLED === 'true';
const r2AccountId = process.env.R2_ACCOUNT_ID;
const r2BucketName = process.env.R2_BUCKET_NAME || 'electron-app-storage';

console.log('📋 Configuration:');
console.log(`   Cloud Storage: ${cloudEnabled ? '✅ ENABLED' : '❌ DISABLED'}`);
console.log(`   R2 Account ID: ${r2AccountId ? r2AccountId.substring(0, 8) + '...' : 'Not configured'}`);
console.log(`   R2 Bucket: ${r2BucketName}`);
console.log(`   Port: 9000\n`);

const port = 9000;

// Create S3 Service Manager with R2 support
const s3Service = new S3ServiceManager();

// Create and start Local S3 Server with proper cloud routing
const server = new LocalS3Server(port, s3Service);

// Start server
server.start().then(() => {
  console.log('✅ Server started successfully!');
  console.log('🌐 Local endpoint: http://localhost:' + port);
  console.log('🏥 Health check: http://localhost:' + port + '/health');
  console.log('📋 Configuration: http://localhost:' + port + '/api/s3/config');
  console.log('\n⚠️  Press Ctrl+C to stop the server\n');
}).catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  server.stop().then(() => {
    console.log('✅ Server stopped gracefully');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  server.stop().then(() => {
    console.log('✅ Server stopped gracefully');
    process.exit(0);
  });
});