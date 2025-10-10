import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  clipboardHistory: defineTable({
    content: v.string(),
    formatted: v.string(),
    format: v.string(),
    timestamp: v.number(),
  })
    .index("by_timestamp", ["timestamp"]),
  
  conversionHistory: defineTable({
    originalPath: v.string(),
    originalName: v.string(),
    convertedPath: v.string(),
    convertedName: v.string(),
    fromFormat: v.string(),
    toFormat: v.string(),
    fileSize: v.optional(v.number()),
    preview: v.optional(v.string()),
    timestamp: v.number(),
    success: v.boolean(),
    error: v.optional(v.string()),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_success", ["success", "timestamp"]),

  // S3 file objects - stores S3 object keys instead of file paths
  s3Objects: defineTable({
    objectKey: v.string(),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    storageType: v.string(),
    parentObjectKey: v.optional(v.string()),
    variantType: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_object_key", ["objectKey"])
    .index("by_parent", ["parentObjectKey"]),

  fileVariants: defineTable({
    parentObjectKey: v.string(),
    childObjectKey: v.string(),
    variantType: v.string(),
    timestamp: v.number(),
  })
    .index("by_parent", ["parentObjectKey"])
    .index("by_child", ["childObjectKey"]),
});