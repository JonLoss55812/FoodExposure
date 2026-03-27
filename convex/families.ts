import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const create = mutation({
  args: {
    name: v.string(),
    inviteCode: v.string(),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('families', args);
  },
});

export const getByInviteCode = query({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('families')
      .withIndex('by_invite_code', (q) => q.eq('inviteCode', args.inviteCode))
      .first();
  },
});

export const get = query({
  args: { id: v.id('families') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
