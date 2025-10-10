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