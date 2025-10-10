import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createFileVariant = mutation({
  args: {
    parentObjectKey: v.string(),
    childObjectKey: v.string(),
    variantType: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const variantId = await ctx.db.insert("fileVariants", {
        parentObjectKey: args.parentObjectKey,
        childObjectKey: args.childObjectKey,
        variantType: args.variantType,
        timestamp: Date.now(),
      });

      return {
        success: true,
        variantId,
        message: "File variant relationship created"
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },
});

export const getFileVariants = query({
  args: {
    parentObjectKey: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const variants = await ctx.db
        .query("fileVariants")
        .withIndex("by_parent", (q) => q.eq("parentObjectKey", args.parentObjectKey))
        .collect();

      const variantDetails = [];
      for (const variant of variants) {
        const s3Object = await ctx.db
          .query("s3Objects")
          .withIndex("by_object_key", (q) => q.eq("objectKey", variant.childObjectKey))
          .first();

        if (s3Object) {
          variantDetails.push({
            variantType: variant.variantType,
            objectKey: variant.childObjectKey,
            fileName: s3Object.fileName,
            fileSize: s3Object.fileSize,
            mimeType: s3Object.mimeType,
            timestamp: variant.timestamp,
          });
        }
      }

      return {
        success: true,
        parentObjectKey: args.parentObjectKey,
        variants: variantDetails,
        count: variantDetails.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },
});

export const listFileHierarchy = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;

    try {
      const parentFiles = await ctx.db
        .query("s3Objects")
        .filter((q) => q.eq(q.field("parentObjectKey"), undefined))
        .order("desc")
        .take(limit);

      const hierarchy = [];
      for (const parent of parentFiles) {
        const variants = await ctx.db
          .query("fileVariants")
          .withIndex("by_parent", (q) => q.eq("parentObjectKey", parent.objectKey))
          .collect();

        hierarchy.push({
          parent: {
            objectKey: parent.objectKey,
            fileName: parent.fileName,
            fileSize: parent.fileSize,
            mimeType: parent.mimeType,
            timestamp: parent.timestamp,
          },
          variantCount: variants.length,
          variantTypes: variants.map(v => v.variantType),
        });
      }

      return {
        success: true,
        hierarchy,
        count: hierarchy.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },
});