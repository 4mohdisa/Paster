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
  
  // Example: User settings synced across devices
  settings: defineTable({
    key: v.string(),
    value: v.any(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"]),
});