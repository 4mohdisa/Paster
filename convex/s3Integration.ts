import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

// Get upload URL
export const requestUploadURL = mutation({
  args: {
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Call S3 service
      const response = await fetch("http://localhost:9000/api/s3/generate-upload-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filePath: `/temp/${args.fileName}`,
          storageType: args.fileSize > 5 * 1024 * 1024 ? "cloud" : "local",
          fileName: args.fileName,
          contentType: args.mimeType
        }),
      });

      if (!response.ok) {
        throw new Error(`S3 service error: ${response.status}`);
      }

      const s3Result = await response.json();

      // Store data
      const objectId = await ctx.db.insert("s3Objects", {
        objectKey: s3Result.objectKey,
        fileName: args.fileName,
        fileSize: args.fileSize,
        mimeType: args.mimeType,
        storageType: args.fileSize > 5 * 1024 * 1024 ? "cloud" : "local",
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

// Helper query to get S3 object by objectKey
export const getS3Object = query({
  args: {
    objectKey: v.string(),
  },
  handler: async (ctx, args) => {
    const s3Object = await ctx.db
      .query("s3Objects")
      .withIndex("by_object_key", (q) => q.eq("objectKey", args.objectKey))
      .first();

    return s3Object;
  },
});

// Get download URL for existing S3 object
export const getDownloadURL = action({
  args: {
    objectKey: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // First, verify the object exists in our database
      const s3Object = await ctx.runQuery(api.s3Integration.getS3Object, {
        objectKey: args.objectKey
      });

      if (!s3Object) {
        return {
          success: false,
          error: "Object not found in database",
          message: "S3 object key not found"
        };
      }

      // Call S3 service to generate download URL
      const response = await fetch("http://localhost:9000/api/s3/generate-download-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          objectKey: args.objectKey,
          storageType: s3Object.storageType,
          expiresIn: 3600
        }),
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

// Store S3 object metadata (when S3 URL was obtained directly by client)
export const storeS3Metadata = mutation({
  args: {
    objectKey: v.string(),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    storageType: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Store metadata in Convex database
      const objectId = await ctx.db.insert("s3Objects", {
        objectKey: args.objectKey,
        fileName: args.fileName,
        fileSize: args.fileSize,
        mimeType: args.mimeType,
        storageType: args.storageType,
        timestamp: Date.now(),
      });

      return {
        success: true,
        objectId,
        message: "S3 object metadata stored successfully"
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: "Failed to store S3 metadata"
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

// Delete S3 object from database and optionally from storage
export const deleteS3Object = mutation({
  args: {
    objectId: v.id("s3Objects"),
  },
  handler: async (ctx, args) => {
    try {
      // Get the object details before deleting
      const s3Object = await ctx.db.get(args.objectId);

      if (!s3Object) {
        return {
          success: false,
          error: "Object not found",
          message: "S3 object not found in database"
        };
      }

      // Delete from S3 storage (optional - call S3 service)
      try {
        const response = await fetch(`http://localhost:9000/api/s3/objects/${s3Object.objectKey}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          console.warn(`S3 deletion failed: ${response.status}`);
          // Continue with database deletion even if S3 deletion fails
        }
      } catch (error) {
        console.warn("S3 deletion error:", error);
        // Continue with database deletion
      }

      // Delete from Convex database
      await ctx.db.delete(args.objectId);

      return {
        success: true,
        objectId: args.objectId,
        fileName: s3Object.fileName,
        message: "S3 object deleted successfully"
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: "Failed to delete S3 object"
      };
    }
  },
});