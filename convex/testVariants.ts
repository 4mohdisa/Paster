import { mutation } from "./_generated/server";

export const testFileVariantWorkflow = mutation({
  args: {},
  handler: async (ctx) => {
    const results = [];

    try {
      results.push("Testing file variant relationship workflow...");

      const parentObjectKey = "test-parent-" + Date.now();

      const parentId = await ctx.db.insert("s3Objects", {
        objectKey: parentObjectKey,
        fileName: "original-video.mp4",
        fileSize: 5000000,
        mimeType: "video/mp4",
        storageType: "local",
        timestamp: Date.now(),
      });
      results.push(`Created parent file: ${parentObjectKey}`);

      const variants = [
        { type: "transcript", fileName: "transcript.txt", mimeType: "text/plain", size: 1024 },
        { type: "summary", fileName: "summary.txt", mimeType: "text/plain", size: 512 },
        { type: "thumbnail", fileName: "thumbnail.jpg", mimeType: "image/jpeg", size: 15000 }
      ];

      for (const variant of variants) {
        const childObjectKey = `${parentObjectKey}-${variant.type}`;

        await ctx.db.insert("s3Objects", {
          objectKey: childObjectKey,
          fileName: variant.fileName,
          fileSize: variant.size,
          mimeType: variant.mimeType,
          storageType: "local",
          parentObjectKey: parentObjectKey,
          variantType: variant.type,
          timestamp: Date.now(),
        });

        await ctx.db.insert("fileVariants", {
          parentObjectKey: parentObjectKey,
          childObjectKey: childObjectKey,
          variantType: variant.type,
          timestamp: Date.now(),
        });

        results.push(`Created ${variant.type} variant: ${childObjectKey}`);
      }

      const variantCount = await ctx.db
        .query("fileVariants")
        .withIndex("by_parent", (q) => q.eq("parentObjectKey", parentObjectKey))
        .collect();

      results.push(`Total variants created: ${variantCount.length}`);
      results.push("File variant workflow test completed successfully!");

      return {
        success: true,
        results,
        parentObjectKey,
        variantCount: variantCount.length
      };

    } catch (error) {
      results.push(`Test failed: ${error.message}`);
      return {
        success: false,
        results,
        error: error.message
      };
    }
  },
});