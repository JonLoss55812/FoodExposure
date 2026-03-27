import {
  childSchema,
  foodSchema,
  exposureSchema,
  loginSchema,
  registerSchema,
  joinFamilySchema,
} from '../validation';

describe('childSchema', () => {
  it('accepts valid child data', () => {
    const result = childSchema.safeParse({
      name: 'Emma',
      avatarEmoji: '👧',
    });
    expect(result.success).toBe(true);
  });

  it('requires name', () => {
    const result = childSchema.safeParse({
      name: '',
      avatarEmoji: '👧',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional fields', () => {
    const result = childSchema.safeParse({
      name: 'Emma',
      dateOfBirth: '2022-01-15',
      avatarEmoji: '👧',
      notes: 'Allergic to peanuts',
    });
    expect(result.success).toBe(true);
  });

  it('defaults avatarEmoji to baby emoji', () => {
    const result = childSchema.safeParse({ name: 'Emma' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.avatarEmoji).toBe('👶');
    }
  });
});

describe('foodSchema', () => {
  it('accepts valid food data', () => {
    const result = foodSchema.safeParse({
      name: 'Broccoli',
      category: 'vegetable',
    });
    expect(result.success).toBe(true);
  });

  it('requires name', () => {
    const result = foodSchema.safeParse({
      name: '',
      category: 'vegetable',
    });
    expect(result.success).toBe(false);
  });

  it('validates category enum', () => {
    const result = foodSchema.safeParse({
      name: 'Pizza',
      category: 'junkfood',
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid categories', () => {
    const categories = ['protein', 'vegetable', 'fruit', 'grain', 'dairy', 'other'];
    for (const category of categories) {
      const result = foodSchema.safeParse({ name: 'Test', category });
      expect(result.success).toBe(true);
    }
  });

  it('defaults isSafeFood to false', () => {
    const result = foodSchema.safeParse({
      name: 'Broccoli',
      category: 'vegetable',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isSafeFood).toBe(false);
    }
  });
});

describe('exposureSchema', () => {
  it('accepts valid exposure data', () => {
    const result = exposureSchema.safeParse({
      childId: 'child-123',
      foodId: 'food-456',
      stage: 'taste',
    });
    expect(result.success).toBe(true);
  });

  it('requires childId', () => {
    const result = exposureSchema.safeParse({
      childId: '',
      foodId: 'food-456',
      stage: 'taste',
    });
    expect(result.success).toBe(false);
  });

  it('requires foodId', () => {
    const result = exposureSchema.safeParse({
      childId: 'child-123',
      foodId: '',
      stage: 'taste',
    });
    expect(result.success).toBe(false);
  });

  it('validates stage enum', () => {
    const result = exposureSchema.safeParse({
      childId: 'child-123',
      foodId: 'food-456',
      stage: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid stages', () => {
    const stages = ['tolerate', 'interact', 'smell', 'touch', 'taste', 'eat'];
    for (const stage of stages) {
      const result = exposureSchema.safeParse({
        childId: 'c1',
        foodId: 'f1',
        stage,
      });
      expect(result.success).toBe(true);
    }
  });

  it('validates rating range', () => {
    expect(
      exposureSchema.safeParse({ childId: 'c1', foodId: 'f1', stage: 'eat', rating: 0 }).success
    ).toBe(false);
    expect(
      exposureSchema.safeParse({ childId: 'c1', foodId: 'f1', stage: 'eat', rating: 6 }).success
    ).toBe(false);
    expect(
      exposureSchema.safeParse({ childId: 'c1', foodId: 'f1', stage: 'eat', rating: 3 }).success
    ).toBe(true);
  });

  it('accepts all optional fields', () => {
    const result = exposureSchema.safeParse({
      childId: 'c1',
      foodId: 'f1',
      stage: 'eat',
      rating: 5,
      preparation: 'steamed',
      temperature: 'warm',
      texture: 'soft',
      mealType: 'dinner',
      setting: 'home',
      notes: 'Ate the whole piece!',
    });
    expect(result.success).toBe(true);
  });

  it('validates temperature enum', () => {
    expect(
      exposureSchema.safeParse({ childId: 'c1', foodId: 'f1', stage: 'eat', temperature: 'lukewarm' }).success
    ).toBe(false);
  });

  it('validates texture enum', () => {
    expect(
      exposureSchema.safeParse({ childId: 'c1', foodId: 'f1', stage: 'eat', texture: 'gooey' }).success
    ).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts valid login', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects short password', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: '1234567',
    });
    expect(result.success).toBe(false);
  });

  it('accepts exactly 8 char password', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: '12345678',
    });
    expect(result.success).toBe(true);
  });
});

describe('registerSchema', () => {
  it('accepts valid registration', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
      displayName: 'Test User',
      familyName: 'Test Family',
    });
    expect(result.success).toBe(true);
  });

  it('requires displayName', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
      displayName: '',
      familyName: 'Test Family',
    });
    expect(result.success).toBe(false);
  });

  it('requires familyName', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
      displayName: 'Test User',
      familyName: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('joinFamilySchema', () => {
  it('accepts valid join data', () => {
    const result = joinFamilySchema.safeParse({
      inviteCode: 'ABC123',
      displayName: 'Partner',
      email: 'partner@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('requires exactly 6 char invite code', () => {
    expect(
      joinFamilySchema.safeParse({
        inviteCode: 'ABC',
        displayName: 'Partner',
        email: 'p@e.com',
        password: 'password123',
      }).success
    ).toBe(false);

    expect(
      joinFamilySchema.safeParse({
        inviteCode: 'ABCDEFG',
        displayName: 'Partner',
        email: 'p@e.com',
        password: 'password123',
      }).success
    ).toBe(false);
  });
});
