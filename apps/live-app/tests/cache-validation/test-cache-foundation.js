// Test cache foundation functionality
// Based on Alex's feedback: validate basic cache operations first

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

async function createTestFiles() {
  const testDir = path.join(__dirname, 'test-files');

  // Create test directory
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Create test files of various sizes
  const files = [
    { name: 'small-1mb.txt', size: 1024 * 1024 },
    { name: 'medium-5mb.txt', size: 5 * 1024 * 1024 },
    { name: 'large-10mb.txt', size: 10 * 1024 * 1024 }
  ];

  console.log('Creating test files...');

  for (const file of files) {
    const filePath = path.join(testDir, file.name);
    const content = crypto.randomBytes(file.size);
    fs.writeFileSync(filePath, content);
    console.log(`Created ${file.name} (${file.size} bytes)`);
  }

  return testDir;
}

async function testCacheOperations() {
  console.log('Testing cache operations...\n');

  // Import S3ServiceManager
  const { S3ServiceManager } = require('../../src/s3-service/S3ServiceManager');
  const service = new S3ServiceManager();

  const testDir = await createTestFiles();
  const testFiles = fs.readdirSync(testDir);

  for (const fileName of testFiles) {
    const filePath = path.join(testDir, fileName);
    const stats = fs.statSync(filePath);

    console.log(`\nTesting ${fileName} (${stats.size} bytes):`);

    // Generate object key
    const objectKey = service.generateObjectKey(filePath);
    console.log(`  Object key: ${objectKey}`);

    // Test file size rule
    const shouldBackup = service.shouldBackupToCloud(stats.size);
    console.log(`  Should backup to cloud: ${shouldBackup} (size: ${stats.size} bytes)`);

    // Test cache before copy
    const cachedBefore = await service.isBinaryCached(objectKey);
    console.log(`  Cached before copy: ${cachedBefore}`);

    // Copy to cache
    const copyResult = await service.copyToCache(filePath, objectKey);
    console.log(`  Copy to cache: ${copyResult.success ? 'SUCCESS' : 'FAILED'}`);
    if (copyResult.success) {
      console.log(`  Cache path: ${copyResult.cachePath}`);
    }

    // Test cache after copy
    const cachedAfter = await service.isBinaryCached(objectKey);
    console.log(`  Cached after copy: ${cachedAfter}`);

    // Verify cached file exists and has correct size
    if (cachedAfter) {
      const cachePath = service.getBinaryCachePath(objectKey);
      const cacheStats = fs.statSync(cachePath);
      console.log(`  Cache file size matches: ${cacheStats.size === stats.size}`);
    }
  }
}

async function runTests() {
  try {
    console.log('=== Cache Foundation Test ===');
    console.log('Testing basic cache operations as per Alex\'s priority\n');

    await testCacheOperations();

    console.log('\n=== Test Summary ===');
    console.log('Cache foundation tests completed');
    console.log('Next: Test download functionality');

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };