import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const create = mutation({
  args: {
    email: v.string(),
    displayName: v.string(),
    familyId: v.id('families'),
    externalId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('users', args);
  },
});

export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .first();
  },
});

export const getByFamily = query({
  args: { familyId: v.id('families') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_family', (q) => q.eq('familyId', args.familyId))
      .collect();
  },
});
