import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const create = mutation({
  args: {
    familyId: v.id('families'),
    name: v.string(),
    dateOfBirth: v.optional(v.string()),
    avatarEmoji: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('children', args);
  },
});

export const getByFamily = query({
  args: { familyId: v.id('families') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('children')
      .withIndex('by_family', (q) => q.eq('familyId', args.familyId))
      .collect();
  },
});

export const get = query({
  args: { id: v.id('children') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const update = mutation({
  args: {
    id: v.id('children'),
    name: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    avatarEmoji: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    // Filter out undefined values
    const updates: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }
    return await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id('children') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
