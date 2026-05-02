export const STAGE_ORDER = ['tolerate', 'interact', 'smell', 'touch', 'taste', 'eat'] as const;
export type ExposureStage = typeof STAGE_ORDER[number];

export const STAGE_CONFIG: Record<ExposureStage, { label: string; icon: string; color: string; description: string }> = {
  tolerate: { label: 'Tolerate', icon: '👁️', color: '#94A3B8', description: 'Food is present nearby' },
  interact: { label: 'Interact', icon: '🍴', color: '#60A5FA', description: 'Touch with utensils, move around' },
  smell: { label: 'Smell', icon: '👃', color: '#A78BFA', description: 'Lean in, sniff, describe' },
  touch: { label: 'Touch', icon: '✋', color: '#FB923C', description: 'Hold, squish, put to lips' },
  taste: { label: 'Taste', icon: '👅', color: '#F472B6', description: 'Lick, place on tongue' },
  eat: { label: 'Eat', icon: '😋', color: '#34D399', description: 'Bite, chew, swallow' },
};

export const FOOD_CATEGORIES = ['protein', 'vegetable', 'fruit', 'grain', 'dairy', 'other'] as const;
export type FoodCategory = typeof FOOD_CATEGORIES[number];

export const CATEGORY_CONFIG: Record<FoodCategory, { label: string; icon: string; color: string }> = {
  protein: { label: 'Protein', icon: '🥩', color: '#EF4444' },
  vegetable: { label: 'Vegetable', icon: '🥦', color: '#22C55E' },
  fruit: { label: 'Fruit', icon: '🍎', color: '#F59E0B' },
  grain: { label: 'Grain', icon: '🍞', color: '#D97706' },
  dairy: { label: 'Dairy', icon: '🧀', color: '#3B82F6' },
  other: { label: 'Other', icon: '🍽️', color: '#6B7280' },
};

export const RATING_CONFIG = [
  { value: 1, emoji: '😫', label: 'Refused' },
  { value: 2, emoji: '😕', label: 'Reluctant' },
  { value: 3, emoji: '😐', label: 'Neutral' },
  { value: 4, emoji: '🙂', label: 'Willing' },
  { value: 5, emoji: '😋', label: 'Enjoyed' },
] as const;

export const TARGET_EXPOSURES = 15;

export const APP_VERSION = 'v0.5.35';

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export const SETTINGS = ['home', 'school', 'restaurant', 'therapy'] as const;
export const TEMPERATURES = ['hot', 'warm', 'room', 'cold'] as const;
export const TEXTURES = ['smooth', 'crunchy', 'soft', 'chewy', 'mixed'] as const;
export const PREPARATIONS = ['raw', 'steamed', 'boiled', 'baked', 'fried', 'grilled', 'roasted', 'pureed'] as const;
