import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const create = mutation({
  args: {
    familyId: v.id('families'),
    name: v.string(),
    category: v.union(
      v.literal('protein'),
      v.literal('vegetable'),
      v.literal('fruit'),
      v.literal('grain'),
      v.literal('dairy'),
      v.literal('other')
    ),
    defaultPreparation: v.optional(v.string()),
    isSafeFood: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('foods', args);
  },
});

export const getByFamily = query({
  args: { familyId: v.id('families') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('foods')
      .withIndex('by_family', (q) => q.eq('familyId', args.familyId))
      .collect();
  },
});

export const get = query({
  args: { id: v.id('foods') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const update = mutation({
  args: {
    id: v.id('foods'),
    name: v.optional(v.string()),
    category: v.optional(v.union(
      v.literal('protein'),
      v.literal('vegetable'),
      v.literal('fruit'),
      v.literal('grain'),
      v.literal('dairy'),
      v.literal('other')
    )),
    defaultPreparation: v.optional(v.string()),
    isSafeFood: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }
    return await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id('foods') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
