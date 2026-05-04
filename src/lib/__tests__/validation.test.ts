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

  it('accepts a 50-character name (boundary)', () => {
    const result = childSchema.safeParse({ name: 'a'.repeat(50) });
    expect(result.success).toBe(true);
  });

  it('rejects a 51-character name (boundary +1)', () => {
    const result = childSchema.safeParse({ name: 'a'.repeat(51) });
    expect(result.success).toBe(false);
  });

  it('accepts 500-character notes (boundary)', () => {
    const result = childSchema.safeParse({ name: 'Emma', notes: 'a'.repeat(500) });
    expect(result.success).toBe(true);
  });

  it('rejects 501-character notes (boundary +1)', () => {
    const result = childSchema.safeParse({ name: 'Emma', notes: 'a'.repeat(501) });
    expect(result.success).toBe(false);
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

  it('accepts an 80-character name (boundary)', () => {
    const result = foodSchema.safeParse({
      name: 'a'.repeat(80),
      category: 'other',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an 81-character name (boundary +1)', () => {
    const result = foodSchema.safeParse({
      name: 'a'.repeat(81),
      category: 'other',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a 50-character defaultPreparation (boundary)', () => {
    const result = foodSchema.safeParse({
      name: 'Broccoli',
      category: 'vegetable',
      defaultPreparation: 'a'.repeat(50),
    });
    expect(result.success).toBe(true);
  });

  it('rejects a 51-character defaultPreparation (boundary +1)', () => {
    const result = foodSchema.safeParse({
      name: 'Broccoli',
      category: 'vegetable',
      defaultPreparation: 'a'.repeat(51),
    });
    expect(result.success).toBe(false);
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

  it('validates mealType enum', () => {
    expect(
      exposureSchema.safeParse({
        childId: 'c1',
        foodId: 'f1',
        stage: 'eat',
        mealType: 'brunch',
      }).success
    ).toBe(false);
  });

  it('validates setting enum', () => {
    expect(
      exposureSchema.safeParse({
        childId: 'c1',
        foodId: 'f1',
        stage: 'eat',
        setting: 'park',
      }).success
    ).toBe(false);
  });

  it('accepts 50-character preparation (boundary)', () => {
    const result = exposureSchema.safeParse({
      childId: 'c1',
      foodId: 'f1',
      stage: 'eat',
      preparation: 'a'.repeat(50),
    });
    expect(result.success).toBe(true);
  });

  it('rejects 51-character preparation (boundary +1)', () => {
    const result = exposureSchema.safeParse({
      childId: 'c1',
      foodId: 'f1',
      stage: 'eat',
      preparation: 'a'.repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it('accepts 500-character notes (boundary)', () => {
    const result = exposureSchema.safeParse({
      childId: 'c1',
      foodId: 'f1',
      stage: 'eat',
      notes: 'a'.repeat(500),
    });
    expect(result.success).toBe(true);
  });

  it('rejects 501-character notes (boundary +1)', () => {
    const result = exposureSchema.safeParse({
      childId: 'c1',
      foodId: 'f1',
      stage: 'eat',
      notes: 'a'.repeat(501),
    });
    expect(result.success).toBe(false);
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

  it('rejects 254-character email under the local-part limit (boundary +1)', () => {
    const result = loginSchema.safeParse({
      email: 'a'.repeat(255) + '@e.com',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a 129-character password (boundary +1)', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'a'.repeat(129),
    });
    expect(result.success).toBe(false);
  });

  it('accepts a 128-character password (boundary)', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'a'.repeat(128),
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

  it('rejects a 51-character displayName (boundary +1)', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
      displayName: 'a'.repeat(51),
      familyName: 'Test Family',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a 51-character familyName (boundary +1)', () => {
    const result = registerSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
      displayName: 'Test User',
      familyName: 'a'.repeat(51),
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

  it('rejects invalid email', () => {
    expect(
      joinFamilySchema.safeParse({
        inviteCode: 'ABC123',
        displayName: 'Partner',
        email: 'not-an-email',
        password: 'password123',
      }).success
    ).toBe(false);
  });

  it('rejects short password', () => {
    expect(
      joinFamilySchema.safeParse({
        inviteCode: 'ABC123',
        displayName: 'Partner',
        email: 'p@e.com',
        password: 'short',
      }).success
    ).toBe(false);
  });
});
