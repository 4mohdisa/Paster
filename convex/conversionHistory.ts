import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Add a new conversion to history
export const addConversion = mutation({
  args: {
    originalPath: v.string(),
    originalName: v.string(),
    convertedPath: v.string(),
    convertedName: v.string(),
    fromFormat: v.string(),
    toFormat: v.string(),
    fileSize: v.optional(v.number()),
    preview: v.optional(v.string()),
    success: v.boolean(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("conversionHistory", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

// Get recent conversions
export const getRecentConversions = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    return await ctx.db
      .query("conversionHistory")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);
  },
});

// Get successful conversions only
export const getSuccessfulConversions = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    return await ctx.db
      .query("conversionHistory")
      .withIndex("by_success")
      .filter((q) => q.eq(q.field("success"), true))
      .order("desc")
      .take(limit);
  },
});

// Clear old conversion history (keep last N items)
export const clearOldHistory = mutation({
  args: {
    keepCount: v.number(),
  },
  handler: async (ctx, args) => {
    const allConversions = await ctx.db
      .query("conversionHistory")
      .withIndex("by_timestamp")
      .order("desc")
      .collect();
    
    // Delete all but the most recent keepCount items
    const toDelete = allConversions.slice(args.keepCount);
    for (const conversion of toDelete) {
      await ctx.db.delete(conversion._id);
    }
    
    return { deleted: toDelete.length };
  },
});