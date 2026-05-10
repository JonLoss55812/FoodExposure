import {
  STAGE_ORDER,
  STAGE_CONFIG,
  FOOD_CATEGORIES,
  CATEGORY_CONFIG,
  RATING_CONFIG,
  TARGET_EXPOSURES,
  APP_VERSION,
  MEAL_TYPES,
  SETTINGS,
  TEMPERATURES,
  TEXTURES,
  PREPARATIONS,
  getCategoryConfig,
  getStageConfig,
} from '../constants';
import { exposureSchema, foodSchema } from '../validation';

describe('STAGE_ORDER', () => {
  it('has exactly 6 stages', () => {
    expect(STAGE_ORDER).toHaveLength(6);
  });

  it('is in correct progression order', () => {
    expect(STAGE_ORDER).toEqual([
      'tolerate',
      'interact',
      'smell',
      'touch',
      'taste',
      'eat',
    ]);
  });
});

describe('STAGE_CONFIG', () => {
  it('has config for every stage', () => {
    for (const stage of STAGE_ORDER) {
      expect(STAGE_CONFIG[stage]).toBeDefined();
      expect(STAGE_CONFIG[stage].label).toBeTruthy();
      expect(STAGE_CONFIG[stage].icon).toBeTruthy();
      expect(STAGE_CONFIG[stage].color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(STAGE_CONFIG[stage].description).toBeTruthy();
    }
  });

  it('has unique colors for each stage', () => {
    const colors = STAGE_ORDER.map((s) => STAGE_CONFIG[s].color);
    expect(new Set(colors).size).toBe(6);
  });
});

describe('FOOD_CATEGORIES', () => {
  it('has 6 categories', () => {
    expect(FOOD_CATEGORIES).toHaveLength(6);
  });

  it('includes expected categories', () => {
    expect(FOOD_CATEGORIES).toContain('protein');
    expect(FOOD_CATEGORIES).toContain('vegetable');
    expect(FOOD_CATEGORIES).toContain('fruit');
    expect(FOOD_CATEGORIES).toContain('grain');
    expect(FOOD_CATEGORIES).toContain('dairy');
    expect(FOOD_CATEGORIES).toContain('other');
  });
});

describe('CATEGORY_CONFIG', () => {
  it('has config for every category', () => {
    for (const cat of FOOD_CATEGORIES) {
      expect(CATEGORY_CONFIG[cat]).toBeDefined();
      expect(CATEGORY_CONFIG[cat].label).toBeTruthy();
      expect(CATEGORY_CONFIG[cat].icon).toBeTruthy();
      expect(CATEGORY_CONFIG[cat].color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('RATING_CONFIG', () => {
  it('has 5 ratings from 1 to 5', () => {
    expect(RATING_CONFIG).toHaveLength(5);
    expect(RATING_CONFIG[0].value).toBe(1);
    expect(RATING_CONFIG[4].value).toBe(5);
  });

  it('each rating has emoji and label', () => {
    for (const rating of RATING_CONFIG) {
      expect(rating.emoji).toBeTruthy();
      expect(rating.label).toBeTruthy();
      expect(rating.value).toBeGreaterThanOrEqual(1);
      expect(rating.value).toBeLessThanOrEqual(5);
    }
  });

  it('ratings are in ascending order', () => {
    for (let i = 1; i < RATING_CONFIG.length; i++) {
      expect(RATING_CONFIG[i].value).toBeGreaterThan(RATING_CONFIG[i - 1].value);
    }
  });
});

describe('TARGET_EXPOSURES', () => {
  it('is 15 (research-backed)', () => {
    expect(TARGET_EXPOSURES).toBe(15);
  });
});

describe('APP_VERSION', () => {
  it('is a valid semver string with v-prefix', () => {
    expect(APP_VERSION).toMatch(/^v\d+\.\d+\.\d+$/);
  });
});

describe('enum arrays', () => {
  it('MEAL_TYPES has 4 options', () => {
    expect(MEAL_TYPES).toHaveLength(4);
    expect(MEAL_TYPES).toContain('breakfast');
    expect(MEAL_TYPES).toContain('dinner');
  });

  it('TEMPERATURES has 4 options', () => {
    expect(TEMPERATURES).toHaveLength(4);
  });

  it('TEXTURES has 5 options', () => {
    expect(TEXTURES).toHaveLength(5);
  });

  it('SETTINGS has 4 options', () => {
    expect(SETTINGS).toHaveLength(4);
    expect(SETTINGS).toContain('home');
    expect(SETTINGS).toContain('school');
    expect(SETTINGS).toContain('restaurant');
    expect(SETTINGS).toContain('therapy');
  });

  it('PREPARATIONS has 8 options', () => {
    expect(PREPARATIONS).toHaveLength(8);
  });
});

describe('constants align with validation schema enums', () => {
  // The form chip rows on `app/(tabs)/log.tsx` and `app/food/add.tsx` iterate
  // over the constants here, but the form's onSubmit validates against
  // exposureSchema/foodSchema in `validation.ts`. If a contributor edits one
  // file without the other (e.g. adds 'park' to SETTINGS but forgets the
  // zod enum), a chip would render that submission silently rejects.

  function getEnumValues(schema: { shape: Record<string, unknown> }, key: string): string[] {
    const field = schema.shape[key] as { unwrap?: () => { options: string[] }; options?: string[] };
    const enumDef = typeof field.unwrap === 'function' ? field.unwrap() : field;
    return [...(enumDef.options ?? [])].sort();
  }

  it('MEAL_TYPES matches exposureSchema.mealType enum', () => {
    expect(getEnumValues(exposureSchema, 'mealType')).toEqual([...MEAL_TYPES].sort());
  });

  it('TEMPERATURES matches exposureSchema.temperature enum', () => {
    expect(getEnumValues(exposureSchema, 'temperature')).toEqual([...TEMPERATURES].sort());
  });

  it('TEXTURES matches exposureSchema.texture enum', () => {
    expect(getEnumValues(exposureSchema, 'texture')).toEqual([...TEXTURES].sort());
  });

  it('SETTINGS matches exposureSchema.setting enum', () => {
    expect(getEnumValues(exposureSchema, 'setting')).toEqual([...SETTINGS].sort());
  });

  it('STAGE_ORDER matches exposureSchema.stage enum', () => {
    expect(getEnumValues(exposureSchema, 'stage')).toEqual([...STAGE_ORDER].sort());
  });

  it('FOOD_CATEGORIES matches foodSchema.category enum', () => {
    expect(getEnumValues(foodSchema, 'category')).toEqual([...FOOD_CATEGORIES].sort());
  });
});

describe('getCategoryConfig', () => {
  it('returns the matching config for every known category', () => {
    for (const cat of FOOD_CATEGORIES) {
      expect(getCategoryConfig(cat)).toBe(CATEGORY_CONFIG[cat]);
    }
  });

  it('falls back to "other" for unknown category strings', () => {
    expect(getCategoryConfig('legume')).toBe(CATEGORY_CONFIG.other);
    expect(getCategoryConfig('PROTEIN')).toBe(CATEGORY_CONFIG.other);
    expect(getCategoryConfig('')).toBe(CATEGORY_CONFIG.other);
  });

  it('falls back to "other" for null and undefined', () => {
    expect(getCategoryConfig(null)).toBe(CATEGORY_CONFIG.other);
    expect(getCategoryConfig(undefined)).toBe(CATEGORY_CONFIG.other);
  });
});

describe('getStageConfig', () => {
  it('returns the matching config for every known stage', () => {
    for (const stage of STAGE_ORDER) {
      expect(getStageConfig(stage)).toBe(STAGE_CONFIG[stage]);
    }
  });

  it('falls back to "tolerate" for unknown stage strings', () => {
    expect(getStageConfig('mystery')).toBe(STAGE_CONFIG.tolerate);
    expect(getStageConfig('TOLERATE')).toBe(STAGE_CONFIG.tolerate);
    expect(getStageConfig('')).toBe(STAGE_CONFIG.tolerate);
  });

  it('falls back to "tolerate" for null and undefined', () => {
    expect(getStageConfig(null)).toBe(STAGE_CONFIG.tolerate);
    expect(getStageConfig(undefined)).toBe(STAGE_CONFIG.tolerate);
  });

  it('returned config carries non-empty label, icon, color, and description', () => {
    const config = getStageConfig('not-a-stage');
    expect(config.label).toBeTruthy();
    expect(config.icon).toBeTruthy();
    expect(config.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(config.description).toBeTruthy();
  });
});
