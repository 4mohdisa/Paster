import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Request presigned upload URL from S3 service
export const requestUploadURL = mutation({
  args: {
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Call our local S3 service to generate presigned upload URL
      const response = await fetch("http://localhost:9000/api/s3/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: args.fileName,
          fileSize: args.fileSize,
          mimeType: args.mimeType,
          storageType: "local" // For now, always use local storage
        }),
      });

      if (!response.ok) {
        throw new Error(`S3 service error: ${response.status}`);
      }

      const s3Result = await response.json();

      // Store the S3 object information in our database
      const objectId = await ctx.db.insert("s3Objects", {
        objectKey: s3Result.objectKey,
        fileName: args.fileName,
        fileSize: args.fileSize,
        mimeType: args.mimeType,
        storageType: "local",
        timestamp: Date.now(),
      });

      return {
        success: true,
        objectId,
        objectKey: s3Result.objectKey,
        uploadUrl: s3Result.signedUrl,
        message: "Presigned URL generated and object key stored"
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: "Failed to request upload URL from S3 service"
      };
    }
  },
});

// Get download URL for existing S3 object
export const getDownloadURL = query({
  args: {
    objectKey: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // First, verify the object exists in our database
      const s3Object = await ctx.db
        .query("s3Objects")
        .withIndex("by_object_key", (q) => q.eq("objectKey", args.objectKey))
        .first();

      if (!s3Object) {
        return {
          success: false,
          error: "Object not found in database",
          message: "S3 object key not found"
        };
      }

      // Call S3 service to generate download URL
      const response = await fetch(`http://localhost:9000/api/s3/download/${args.objectKey}`, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(`S3 service error: ${response.status}`);
      }

      const s3Result = await response.json();

      return {
        success: true,
        objectKey: args.objectKey,
        downloadUrl: s3Result.signedUrl,
        fileName: s3Object.fileName,
        fileSize: s3Object.fileSize,
        message: "Download URL generated successfully"
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: "Failed to generate download URL"
      };
    }
  },
});

// List all S3 objects stored in Convex
export const listS3Objects = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    const objects = await ctx.db
      .query("s3Objects")
      .order("desc")
      .take(limit);

    return {
      success: true,
      objects,
      count: objects.length,
      message: `Retrieved ${objects.length} S3 objects`
    };
  },
});