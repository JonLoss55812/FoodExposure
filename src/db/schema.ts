import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const families = sqliteTable('families', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  inviteCode: text('invite_code').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  syncedAt: integer('synced_at', { mode: 'timestamp' }),
});

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  familyId: text('family_id').references(() => families.id),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  syncedAt: integer('synced_at', { mode: 'timestamp' }),
});

export const children = sqliteTable('children', {
  id: text('id').primaryKey(),
  familyId: text('family_id').references(() => families.id).notNull(),
  name: text('name').notNull(),
  dateOfBirth: text('date_of_birth'),
  avatarEmoji: text('avatar_emoji').notNull().default('👶'),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  syncedAt: integer('synced_at', { mode: 'timestamp' }),
});

export const foods = sqliteTable('foods', {
  id: text('id').primaryKey(),
  familyId: text('family_id').references(() => families.id).notNull(),
  name: text('name').notNull(),
  category: text('category', { enum: ['protein', 'vegetable', 'fruit', 'grain', 'dairy', 'other'] }).notNull(),
  defaultPreparation: text('default_preparation'),
  imageUrl: text('image_url'),
  isSafeFood: integer('is_safe_food', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  syncedAt: integer('synced_at', { mode: 'timestamp' }),
});

export const exposures = sqliteTable('exposures', {
  id: text('id').primaryKey(),
  childId: text('child_id').references(() => children.id).notNull(),
  foodId: text('food_id').references(() => foods.id).notNull(),
  stage: text('stage', { enum: ['tolerate', 'interact', 'smell', 'touch', 'taste', 'eat'] }).notNull(),
  rating: integer('rating'),  // 1-5
  preparation: text('preparation'),
  temperature: text('temperature', { enum: ['hot', 'warm', 'room', 'cold'] }),
  texture: text('texture', { enum: ['smooth', 'crunchy', 'soft', 'chewy', 'mixed'] }),
  mealType: text('meal_type', { enum: ['breakfast', 'lunch', 'dinner', 'snack'] }),
  setting: text('setting', { enum: ['home', 'school', 'restaurant', 'therapy'] }),
  notes: text('notes'),
  loggedBy: text('logged_by').references(() => users.id),
  occurredAt: integer('occurred_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  syncedAt: integer('synced_at', { mode: 'timestamp' }),
});

export const foodChains = sqliteTable('food_chains', {
  id: text('id').primaryKey(),
  childId: text('child_id').references(() => children.id).notNull(),
  sourceFoodId: text('source_food_id').references(() => foods.id).notNull(),
  targetFoodId: text('target_food_id').references(() => foods.id).notNull(),
  similarityNote: text('similarity_note'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  syncedAt: integer('synced_at', { mode: 'timestamp' }),
});
