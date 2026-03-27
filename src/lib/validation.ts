import { z } from 'zod';

export const childSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  dateOfBirth: z.string().optional(),
  avatarEmoji: z.string().default('👶'),
  notes: z.string().optional(),
});

export type ChildFormData = z.infer<typeof childSchema>;

export const foodSchema = z.object({
  name: z.string().min(1, 'Food name is required'),
  category: z.enum(['protein', 'vegetable', 'fruit', 'grain', 'dairy', 'other']),
  defaultPreparation: z.string().optional(),
  isSafeFood: z.boolean().default(false),
});

export type FoodFormData = z.infer<typeof foodSchema>;

export const exposureSchema = z.object({
  childId: z.string().min(1, 'Select a child'),
  foodId: z.string().min(1, 'Select a food'),
  stage: z.enum(['tolerate', 'interact', 'smell', 'touch', 'taste', 'eat']),
  rating: z.number().min(1).max(5).optional(),
  preparation: z.string().optional(),
  temperature: z.enum(['hot', 'warm', 'room', 'cold']).optional(),
  texture: z.enum(['smooth', 'crunchy', 'soft', 'chewy', 'mixed']).optional(),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
  setting: z.enum(['home', 'school', 'restaurant', 'therapy']).optional(),
  notes: z.string().optional(),
});

export type ExposureFormData = z.infer<typeof exposureSchema>;

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = loginSchema.extend({
  displayName: z.string().min(1, 'Name is required'),
  familyName: z.string().min(1, 'Family name is required'),
});

export type RegisterFormData = z.infer<typeof registerSchema>;

export const joinFamilySchema = z.object({
  inviteCode: z.string().length(6, 'Invite code must be 6 characters'),
  displayName: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type JoinFamilyFormData = z.infer<typeof joinFamilySchema>;
