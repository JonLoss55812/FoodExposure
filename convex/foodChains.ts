import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const create = mutation({
  args: {
    childId: v.id('children'),
    sourceFoodId: v.id('foods'),
    targetFoodId: v.id('foods'),
    similarityNote: v.optional(v.string()),
    familyId: v.id('families'),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('foodChains', args);
  },
});

export const getByChild = query({
  args: { childId: v.id('children') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('foodChains')
      .withIndex('by_child', (q) => q.eq('childId', args.childId))
      .collect();
  },
});

export const remove = mutation({
  args: { id: v.id('foodChains') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
