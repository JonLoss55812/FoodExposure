import { z } from 'zod';

const optionalTrimmedText = (max: number, label: string) =>
  z.string()
    .optional()
    .transform((val) => {
      if (typeof val !== 'string') return undefined;
      const trimmed = val.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    })
    .pipe(z.string().max(max, `${label} must be ${max} characters or less`).optional());

export const childSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(50, 'Name must be 50 characters or less'),
  dateOfBirth: z
    .string()
    .trim()
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return false;
        const d = new Date(`${val}T00:00:00Z`);
        return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(val);
      },
      { message: 'Date of birth must be a valid YYYY-MM-DD date' }
    ),
  avatarEmoji: z.string().default('👶'),
  notes: optionalTrimmedText(500, 'Notes'),
});

export type ChildFormData = z.infer<typeof childSchema>;

export const foodSchema = z.object({
  name: z.string().trim().min(1, 'Food name is required').max(80, 'Food name must be 80 characters or less'),
  category: z.enum(['protein', 'vegetable', 'fruit', 'grain', 'dairy', 'other']),
  defaultPreparation: optionalTrimmedText(50, 'Preparation'),
  isSafeFood: z.boolean().default(false),
});

export type FoodFormData = z.infer<typeof foodSchema>;

export const exposureSchema = z.object({
  childId: z.string().min(1, 'Select a child'),
  foodId: z.string().min(1, 'Select a food'),
  stage: z.enum(['tolerate', 'interact', 'smell', 'touch', 'taste', 'eat']),
  rating: z.number().int('Rating must be a whole number').min(1).max(5).optional(),
  preparation: optionalTrimmedText(50, 'Preparation'),
  temperature: z.enum(['hot', 'warm', 'room', 'cold']).optional(),
  texture: z.enum(['smooth', 'crunchy', 'soft', 'chewy', 'mixed']).optional(),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
  setting: z.enum(['home', 'school', 'restaurant', 'therapy']).optional(),
  notes: optionalTrimmedText(500, 'Notes'),
});

export type ExposureFormData = z.infer<typeof exposureSchema>;

export const loginSchema = z.object({
  email: z.string().email('Invalid email').max(254, 'Email must be 254 characters or less'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password must be 128 characters or less'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = loginSchema.extend({
  displayName: z.string().trim().min(1, 'Name is required').max(50, 'Name must be 50 characters or less'),
  familyName: z.string().trim().min(1, 'Family name is required').max(50, 'Family name must be 50 characters or less'),
});

export type RegisterFormData = z.infer<typeof registerSchema>;

export const joinFamilySchema = z.object({
  inviteCode: z.string().trim().length(6, 'Invite code must be 6 characters'),
  displayName: z.string().trim().min(1, 'Name is required').max(50, 'Name must be 50 characters or less'),
  email: z.string().email('Invalid email').max(254, 'Email must be 254 characters or less'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password must be 128 characters or less'),
});

export type JoinFamilyFormData = z.infer<typeof joinFamilySchema>;
