import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Example: Clipboard history stored in Convex
  clipboardHistory: defineTable({
    content: v.string(),
    formatted: v.string(),
    format: v.string(),
    timestamp: v.number(),
  })
    .index("by_timestamp", ["timestamp"]),
  
  // Kash document conversion history
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
  
  // Example: User settings synced across devices
  settings: defineTable({
    key: v.string(),
    value: v.any(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"]),
});