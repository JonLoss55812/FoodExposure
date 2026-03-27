import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  families: defineTable({
    name: v.string(),
    inviteCode: v.string(),
    createdBy: v.string(),
  }).index('by_invite_code', ['inviteCode']),

  users: defineTable({
    email: v.string(),
    displayName: v.string(),
    familyId: v.id('families'),
    avatarUrl: v.optional(v.string()),
    externalId: v.optional(v.string()),
  })
    .index('by_email', ['email'])
    .index('by_family', ['familyId'])
    .index('by_external_id', ['externalId']),

  children: defineTable({
    familyId: v.id('families'),
    name: v.string(),
    dateOfBirth: v.optional(v.string()),
    avatarEmoji: v.string(),
    notes: v.optional(v.string()),
  }).index('by_family', ['familyId']),

  foods: defineTable({
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
    imageUrl: v.optional(v.string()),
    isSafeFood: v.boolean(),
  }).index('by_family', ['familyId']),

  exposures: defineTable({
    childId: v.id('children'),
    foodId: v.id('foods'),
    stage: v.union(
      v.literal('tolerate'),
      v.literal('interact'),
      v.literal('smell'),
      v.literal('touch'),
      v.literal('taste'),
      v.literal('eat')
    ),
    rating: v.optional(v.number()),
    preparation: v.optional(v.string()),
    temperature: v.optional(v.union(
      v.literal('hot'),
      v.literal('warm'),
      v.literal('room'),
      v.literal('cold')
    )),
    texture: v.optional(v.union(
      v.literal('smooth'),
      v.literal('crunchy'),
      v.literal('soft'),
      v.literal('chewy'),
      v.literal('mixed')
    )),
    mealType: v.optional(v.union(
      v.literal('breakfast'),
      v.literal('lunch'),
      v.literal('dinner'),
      v.literal('snack')
    )),
    setting: v.optional(v.union(
      v.literal('home'),
      v.literal('school'),
      v.literal('restaurant'),
      v.literal('therapy')
    )),
    notes: v.optional(v.string()),
    loggedBy: v.id('users'),
    occurredAt: v.number(),
    familyId: v.id('families'),
  })
    .index('by_child', ['childId'])
    .index('by_food', ['foodId'])
    .index('by_family', ['familyId'])
    .index('by_child_and_food', ['childId', 'foodId']),

  foodChains: defineTable({
    childId: v.id('children'),
    sourceFoodId: v.id('foods'),
    targetFoodId: v.id('foods'),
    similarityNote: v.optional(v.string()),
    familyId: v.id('families'),
  })
    .index('by_child', ['childId'])
    .index('by_family', ['familyId']),
});
