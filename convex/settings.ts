import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get a setting value
export const get = query({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    
    return setting?.value ?? null;
  },
});

// Get all settings
export const getAll = query({
  handler: async (ctx) => {
    const settings = await ctx.db.query("settings").collect();
    
    // Convert to key-value object
    const result: Record<string, any> = {};
    for (const setting of settings) {
      result[setting.key] = setting.value;
    }
    
    return result;
  },
});

// Update a setting
export const set = mutation({
  args: {
    key: v.string(),
    value: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      return await ctx.db.insert("settings", {
        key: args.key,
        value: args.value,
        updatedAt: Date.now(),
      });
    }
  },
});

// Sync settings
export const sync = mutation({
  args: {
    settings: v.record(v.string(), v.any()),
  },
  handler: async (ctx, args) => {
    const results = [];
    
    for (const [key, value] of Object.entries(args.settings)) {
      const existing = await ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first();
      
      if (existing) {
        await ctx.db.patch(existing._id, {
          value,
          updatedAt: Date.now(),
        });
        results.push(key);
      } else {
        await ctx.db.insert("settings", {
          key,
          value,
          updatedAt: Date.now(),
        });
        results.push(key);
      }
    }
    
    return { synced: results };
  },
});