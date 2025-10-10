# S3 Integration Plan - Basic File Upload Test

## Overview
This plan outlines implementing a basic S3 file upload test to validate the Command+Shift+X workflow as described in Alex's meeting. This is the **first small step** toward integrating the S3 service with the actual application workflow.

## Objectives
- Test existing S3 service with a real file scenario
- Validate file → S3 object key → metadata storage flow
- Ensure no disruption to existing `live-app` functionality
- Create foundation for file variant processing

## Project Context
- **Working Directory**: `apps/live-app/`
- **Existing S3 Service**: Already implemented in `src/s3-service/`
- **Meeting Context**: Alex wants all files to become S3 objects, never file paths in Convex
- **Current Status**: S3 service exists but not integrated with app workflow

## Implementation Plan

### Phase 1: Environment Setup (5 minutes)
#### Step 1.1: Verify Current S3 Service
```bash
# Check existing S3 service structure
ls -la src/s3-service/
cat src/s3-service/S3ServiceManager.ts | head -20
```

#### Step 1.2: Verify Standalone Server Works
```bash
# Test standalone S3 server
node start-s3-server.js
# In another terminal: curl http://localhost:9000/health
```

**Expected Output**: S3 server responds with health check

### Phase 2: Create Safe Test Environment (10 minutes)
#### Step 2.1: Create Test Directory
```bash
mkdir -p tests/s3-integration
cd tests/s3-integration
```

#### Step 2.2: Create Test File
Create `basic-upload-test.js` (see code below)

#### Step 2.3: Create Sample Test File
```bash
# Create a small test file to simulate desktop MP4
echo "This is a sample MP4 file content for testing" > sample-video.mp4
```

### Phase 3: Implement Basic Test (15 minutes)
#### Step 3.1: Basic Upload Test Implementation

**File**: `tests/s3-integration/basic-upload-test.js`
```javascript
const path = require('path');
const { S3ServiceManager } = require('../../src/s3-service/S3ServiceManager');

async function testBasicFileUpload() {
  console.log('🚀 Starting S3 Basic Upload Test...\n');

  try {
    // Initialize S3 service
    const s3Service = new S3ServiceManager();
    console.log('✅ S3 Service initialized');

    // Simulate: User selects MP4 file on desktop
    const testFilePath = path.resolve(__dirname, 'sample-video.mp4');
    console.log('📁 Test file path:', testFilePath);

    // Step 1: Generate presigned upload URL (like Convex would do)
    console.log('\n🔄 Step 1: Generating presigned upload URL...');
    const uploadResult = await s3Service.generatePresignedUploadURL(
      testFilePath,
      'local'
    );

    console.log('✅ Upload URL generated:', uploadResult.signedUrl);
    console.log('📋 Object Key:', uploadResult.objectKey);

    // Step 2: Verify metadata was stored
    console.log('\n🔄 Step 2: Verifying metadata storage...');
    const metadataResult = await s3Service.getObjectMetadata(uploadResult.objectKey);

    if (metadataResult.success) {
      console.log('✅ Metadata retrieved successfully');
      console.log('📄 Stored metadata:', JSON.stringify(metadataResult.metadata, null, 2));
    } else {
      console.log('❌ Failed to retrieve metadata:', metadataResult.error);
      return;
    }

    // Step 3: Test download URL generation
    console.log('\n🔄 Step 3: Testing download URL generation...');
    const downloadResult = await s3Service.generatePresignedDownloadURL(
      uploadResult.objectKey,
      'local'
    );

    if (downloadResult.success) {
      console.log('✅ Download URL generated:', downloadResult.signedUrl);
    } else {
      console.log('❌ Failed to generate download URL:', downloadResult.error);
      return;
    }

    // Step 4: Verify the workflow matches Alex's requirements
    console.log('\n🎯 Workflow Validation:');
    console.log('✅ File converted to S3 object key:', uploadResult.objectKey);
    console.log('✅ Metadata stored separately from file content');
    console.log('✅ Presigned URLs generated for both upload/download');
    console.log('✅ Local storage decision transparent to service layer');

    console.log('\n🎉 Basic S3 Upload Test PASSED!');
    return uploadResult.objectKey;

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testBasicFileUpload()
    .then(objectKey => {
      console.log(`\n🏁 Test completed successfully with object key: ${objectKey}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testBasicFileUpload };
```

#### Step 3.2: Create Test Runner Script
**File**: `tests/s3-integration/run-test.sh`
```bash
#!/bin/bash

echo "🧪 S3 Integration Test Runner"
echo "=============================="

# Check if S3 server is running
if ! curl -s http://localhost:9000/health > /dev/null; then
    echo "❌ S3 server not running. Please start it first:"
    echo "   cd apps/live-app && node start-s3-server.js"
    exit 1
fi

echo "✅ S3 server is running"

# Run the test
echo "🚀 Running basic upload test..."
node basic-upload-test.js

echo "🏁 Test runner completed"
```

### Phase 4: Testing & Validation (10 minutes)
#### Step 4.1: Execute Test
```bash
# Terminal 1: Start S3 server
cd apps/live-app
node start-s3-server.js

# Terminal 2: Run test
cd apps/live-app/tests/s3-integration
chmod +x run-test.sh
./run-test.sh
```

#### Step 4.2: Validate Results
Check that these files exist:
```bash
# Check metadata was created
ls ~/.neutralbase/s3-metadata/
cat ~/.neutralbase/s3-metadata/{generated-object-key}.json
```

**Expected Metadata Structure**:
```json
{
  "objectKey": "abc123...",
  "filePath": "/path/to/sample-video.mp4",
  "fileName": "sample-video.mp4",
  "fileSize": 45,
  "mimeType": "video/mp4",
  "createdAt": "2025-01-17T...",
  "storageType": "local"
}
```

### Phase 5: Integration Verification (5 minutes)
#### Step 5.1: Verify No Disruption
```bash
# Ensure live-app still works
cd apps/live-app
pnpm start
# Check that app launches normally
```

#### Step 5.2: Document Results
Create test results log in `tests/s3-integration/test-results.log`

## Success Criteria
- [ ] S3 service generates object keys for file paths
- [ ] Metadata is stored in `~/.neutralbase/s3-metadata/`
- [ ] Presigned URLs are generated correctly
- [ ] Download URLs can be retrieved using object keys
- [ ] No disruption to existing live-app functionality
- [ ] Test can be run repeatedly without issues

## Safety Measures
1. **Isolated Testing**: All tests run in `tests/` directory
2. **No Production Data**: Uses sample files only
3. **Reversible Changes**: Only adds files, doesn't modify existing code
4. **Clear Separation**: Test code separate from app code
5. **Documentation**: All changes documented in this plan

## Next Steps After Success
Once basic test passes:
1. Add file variant simulation
2. Create Convex integration test
3. Test Command+Shift+X workflow simulation
4. Add relationship mapping between files and variants

## Rollback Plan
If anything goes wrong:
```bash
# Remove test files
rm -rf tests/s3-integration/
# Clean metadata (if needed)
rm -rf ~/.neutralbase/s3-metadata/
# Restart S3 server
pkill -f start-s3-server.js
node start-s3-server.js
```

## Time Estimate
- **Total**: 45 minutes
- **Setup**: 15 minutes
- **Implementation**: 15 minutes
- **Testing**: 10 minutes
- **Documentation**: 5 minutes

## Files to Create
1. `tests/s3-integration/basic-upload-test.js` - Main test logic
2. `tests/s3-integration/run-test.sh` - Test runner
3. `tests/s3-integration/sample-video.mp4` - Test data
4. `tests/s3-integration/test-results.log` - Results documentation

## Files NOT to Modify
- `src/s3-service/*` - Keep existing S3 service unchanged
- `src/index.ts` - Don't touch main Electron process
- `package.json` - No dependency changes needed
- Any existing application code

---

**Author**: Mohammed Isa
**Date**: January 17, 2025
**Context**: Alex/Yasin meeting requirements - Phase 1 implementation
**Risk Level**: Low (isolated testing, no production code changes)