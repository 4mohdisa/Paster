import { mutation } from "./_generated/server";

// Test function that demonstrates the complete Convex ↔ S3 workflow
export const testCompleteWorkflow = mutation({
  args: {},
  handler: async (ctx) => {
    const results: any[] = [];

    try {
      // Step 1: Test S3 server connectivity
      results.push("🔄 Step 1: Testing S3 server connectivity...");

      const healthResponse = await fetch("http://localhost:9000/health");
      const healthData = await healthResponse.json();

      if (healthData.status === "ok") {
        results.push("✅ S3 server is reachable");
      } else {
        results.push("❌ S3 server health check failed");
        return { success: false, results };
      }

      // Step 2: Request upload URL and store object key
      results.push("🔄 Step 2: Requesting upload URL and storing object key...");

      const uploadResponse = await fetch("http://localhost:9000/api/s3/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: "test-integration.mp4",
          fileSize: 1024,
          mimeType: "video/mp4",
          storageType: "local"
        }),
      });

      if (!uploadResponse.ok) {
        results.push(`❌ Upload URL request failed: ${uploadResponse.status}`);
        return { success: false, results };
      }

      const uploadData = await uploadResponse.json();
      results.push(`✅ Upload URL generated: ${uploadData.signedUrl}`);
      results.push(`✅ Object key created: ${uploadData.objectKey}`);

      // Step 3: Store object key in Convex database
      const objectId = await ctx.db.insert("s3Objects", {
        objectKey: uploadData.objectKey,
        fileName: "test-integration.mp4",
        fileSize: 1024,
        mimeType: "video/mp4",
        storageType: "local",
        timestamp: Date.now(),
      });

      results.push(`✅ Object key stored in Convex with ID: ${objectId}`);

      // Step 4: Retrieve object from database
      const storedObject = await ctx.db.get(objectId);
      if (storedObject) {
        results.push(`✅ Object retrieved from Convex: ${storedObject.objectKey}`);
      } else {
        results.push("❌ Failed to retrieve object from Convex");
        return { success: false, results };
      }

      // Step 5: Generate download URL
      results.push("🔄 Step 3: Generating download URL...");

      const downloadResponse = await fetch(`http://localhost:9000/api/s3/download/${uploadData.objectKey}`);

      if (!downloadResponse.ok) {
        results.push(`❌ Download URL generation failed: ${downloadResponse.status}`);
        return { success: false, results };
      }

      const downloadData = await downloadResponse.json();
      results.push(`✅ Download URL generated: ${downloadData.signedUrl}`);

      // Final success
      results.push("🎉 Complete Convex ↔ S3 integration test PASSED!");
      results.push(`📋 Workflow: file info → S3 object key → Convex storage → download URL`);

      return {
        success: true,
        results,
        objectKey: uploadData.objectKey,
        objectId: objectId,
        message: "Complete integration test successful"
      };

    } catch (error) {
      results.push(`❌ Test failed: ${error.message}`);
      return {
        success: false,
        results,
        error: error.message
      };
    }
  },
});