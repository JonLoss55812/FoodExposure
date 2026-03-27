import {
  STAGE_ORDER,
  STAGE_CONFIG,
  FOOD_CATEGORIES,
  CATEGORY_CONFIG,
  RATING_CONFIG,
  TARGET_EXPOSURES,
  MEAL_TYPES,
  TEMPERATURES,
  TEXTURES,
  PREPARATIONS,
} from '../constants';

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

  it('PREPARATIONS has 8 options', () => {
    expect(PREPARATIONS).toHaveLength(8);
  });
});
