import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

const stageValidator = v.union(
  v.literal('tolerate'),
  v.literal('interact'),
  v.literal('smell'),
  v.literal('touch'),
  v.literal('taste'),
  v.literal('eat')
);

export const create = mutation({
  args: {
    childId: v.id('children'),
    foodId: v.id('foods'),
    stage: stageValidator,
    rating: v.optional(v.number()),
    preparation: v.optional(v.string()),
    temperature: v.optional(v.union(v.literal('hot'), v.literal('warm'), v.literal('room'), v.literal('cold'))),
    texture: v.optional(v.union(v.literal('smooth'), v.literal('crunchy'), v.literal('soft'), v.literal('chewy'), v.literal('mixed'))),
    mealType: v.optional(v.union(v.literal('breakfast'), v.literal('lunch'), v.literal('dinner'), v.literal('snack'))),
    setting: v.optional(v.union(v.literal('home'), v.literal('school'), v.literal('restaurant'), v.literal('therapy'))),
    notes: v.optional(v.string()),
    loggedBy: v.id('users'),
    occurredAt: v.number(),
    familyId: v.id('families'),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('exposures', args);
  },
});

export const getByChild = query({
  args: { childId: v.id('children') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('exposures')
      .withIndex('by_child', (q) => q.eq('childId', args.childId))
      .collect();
  },
});

export const getByChildAndFood = query({
  args: { childId: v.id('children'), foodId: v.id('foods') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('exposures')
      .withIndex('by_child_and_food', (q) =>
        q.eq('childId', args.childId).eq('foodId', args.foodId)
      )
      .collect();
  },
});

export const getByFamily = query({
  args: { familyId: v.id('families') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('exposures')
      .withIndex('by_family', (q) => q.eq('familyId', args.familyId))
      .order('desc')
      .collect();
  },
});

export const getRecentByFamily = query({
  args: { familyId: v.id('families'), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query('exposures')
      .withIndex('by_family', (q) => q.eq('familyId', args.familyId))
      .order('desc')
      .take(args.limit ?? 20);
    return results;
  },
});

export const remove = mutation({
  args: { id: v.id('exposures') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
