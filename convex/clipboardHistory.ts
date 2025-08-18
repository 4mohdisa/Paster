import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get clipboard history
export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    
    return await ctx.db
      .query("clipboardHistory")
      .order("desc")
      .take(limit);
  },
});

// Add clipboard entry
export const add = mutation({
  args: {
    content: v.string(),
    formatted: v.string(),
    format: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("clipboardHistory", {
      content: args.content,
      formatted: args.formatted,
      format: args.format,
      timestamp: Date.now(),
    });
  },
});

// Clear history
export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("clipboardHistory").collect();
    
    for (const item of items) {
      await ctx.db.delete(item._id);
    }
    
    return { deleted: items.length };
  },
});

