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

  describe('avatarEmoji length and trim handling', () => {
    it('accepts a single 2-unit emoji', () => {
      const result = childSchema.safeParse({ name: 'Emma', avatarEmoji: '👧' });
      expect(result.success).toBe(true);
    });

    it('accepts a 5-unit ZWJ sequence (cook chef)', () => {
      const result = childSchema.safeParse({ name: 'Emma', avatarEmoji: '🧑‍🍳' });
      expect(result.success).toBe(true);
    });

    it('accepts an 8-character avatar (boundary)', () => {
      const result = childSchema.safeParse({ name: 'Emma', avatarEmoji: 'a'.repeat(8) });
      expect(result.success).toBe(true);
    });

    it('rejects a 9-character avatar (boundary +1)', () => {
      const result = childSchema.safeParse({ name: 'Emma', avatarEmoji: 'a'.repeat(9) });
      expect(result.success).toBe(false);
    });

    it('rejects whitespace-only avatarEmoji', () => {
      const result = childSchema.safeParse({ name: 'Emma', avatarEmoji: '   ' });
      expect(result.success).toBe(false);
    });

    it('strips surrounding whitespace from avatarEmoji', () => {
      const result = childSchema.safeParse({ name: 'Emma', avatarEmoji: '  👧  ' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.avatarEmoji).toBe('👧');
      }
    });
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

  it('accepts a 64-character childId (boundary — conservative cap above 36-char uuid)', () => {
    const result = exposureSchema.safeParse({
      childId: 'a'.repeat(64),
      foodId: 'f1',
      stage: 'taste',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a 65-character childId (boundary +1)', () => {
    const result = exposureSchema.safeParse({
      childId: 'a'.repeat(65),
      foodId: 'f1',
      stage: 'taste',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a 64-character foodId (boundary)', () => {
    const result = exposureSchema.safeParse({
      childId: 'c1',
      foodId: 'a'.repeat(64),
      stage: 'taste',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a 65-character foodId (boundary +1)', () => {
    const result = exposureSchema.safeParse({
      childId: 'c1',
      foodId: 'a'.repeat(65),
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

  it('rejects non-integer rating values', () => {
    // RatingPicker only emits integers, but the schema is the contract for any
    // future surface (CSV import, sync layer). A 3.7 is meaningless on a 1–5
    // ordinal scale and would round-trip ambiguously through downstream readers.
    expect(
      exposureSchema.safeParse({ childId: 'c1', foodId: 'f1', stage: 'eat', rating: 3.7 }).success
    ).toBe(false);
    expect(
      exposureSchema.safeParse({ childId: 'c1', foodId: 'f1', stage: 'eat', rating: 1.5 }).success
    ).toBe(false);
    // Boundary integers still accepted.
    for (const v of [1, 2, 3, 4, 5]) {
      expect(
        exposureSchema.safeParse({ childId: 'c1', foodId: 'f1', stage: 'eat', rating: v }).success
      ).toBe(true);
    }
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
      inviteCode: 'ABC234',
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
        inviteCode: 'ABC234',
        displayName: 'Partner',
        email: 'not-an-email',
        password: 'password123',
      }).success
    ).toBe(false);
  });

  it('rejects short password', () => {
    expect(
      joinFamilySchema.safeParse({
        inviteCode: 'ABC234',
        displayName: 'Partner',
        email: 'p@e.com',
        password: 'short',
      }).success
    ).toBe(false);
  });

  it('rejects invite codes containing visually-ambiguous letters O or I', () => {
    expect(
      joinFamilySchema.safeParse({
        inviteCode: 'ABCO23',
        displayName: 'Partner',
        email: 'p@e.com',
        password: 'password123',
      }).success
    ).toBe(false);

    expect(
      joinFamilySchema.safeParse({
        inviteCode: 'ABCI23',
        displayName: 'Partner',
        email: 'p@e.com',
        password: 'password123',
      }).success
    ).toBe(false);
  });

  it('rejects invite codes containing visually-ambiguous digits 0 or 1', () => {
    expect(
      joinFamilySchema.safeParse({
        inviteCode: 'ABC023',
        displayName: 'Partner',
        email: 'p@e.com',
        password: 'password123',
      }).success
    ).toBe(false);

    expect(
      joinFamilySchema.safeParse({
        inviteCode: 'ABC123',
        displayName: 'Partner',
        email: 'p@e.com',
        password: 'password123',
      }).success
    ).toBe(false);
  });

  it('normalizes lowercase inviteCode to uppercase before validating', () => {
    const result = joinFamilySchema.safeParse({
      inviteCode: 'abc234',
      displayName: 'Partner',
      email: 'p@e.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.inviteCode).toBe('ABC234');
  });

  it('normalizes mixed-case inviteCode after trimming surrounding whitespace', () => {
    const result = joinFamilySchema.safeParse({
      inviteCode: '  AbC234  ',
      displayName: 'Partner',
      email: 'p@e.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.inviteCode).toBe('ABC234');
  });

  it('rejects invite codes with punctuation even after case normalization', () => {
    expect(
      joinFamilySchema.safeParse({
        inviteCode: 'ABC-23',
        displayName: 'Partner',
        email: 'p@e.com',
        password: 'password123',
      }).success
    ).toBe(false);

    expect(
      joinFamilySchema.safeParse({
        inviteCode: 'abc-23',
        displayName: 'Partner',
        email: 'p@e.com',
        password: 'password123',
      }).success
    ).toBe(false);
  });
});

describe('whitespace handling on required string fields', () => {
  it('childSchema rejects whitespace-only name', () => {
    expect(childSchema.safeParse({ name: '   ' }).success).toBe(false);
  });

  it('childSchema strips surrounding whitespace from name', () => {
    const result = childSchema.safeParse({ name: '  Emma  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe('Emma');
  });

  it('foodSchema rejects whitespace-only name', () => {
    expect(foodSchema.safeParse({ name: '   ', category: 'other' }).success).toBe(false);
  });

  it('foodSchema strips surrounding whitespace from name', () => {
    const result = foodSchema.safeParse({ name: '  Broccoli  ', category: 'vegetable' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe('Broccoli');
  });

  it('registerSchema rejects whitespace-only displayName', () => {
    const result = registerSchema.safeParse({
      email: 'a@b.co',
      password: 'a'.repeat(8),
      displayName: '   ',
      familyName: 'Test',
    });
    expect(result.success).toBe(false);
  });

  it('registerSchema rejects whitespace-only familyName', () => {
    const result = registerSchema.safeParse({
      email: 'a@b.co',
      password: 'a'.repeat(8),
      displayName: 'Test',
      familyName: '   ',
    });
    expect(result.success).toBe(false);
  });

  it('joinFamilySchema rejects whitespace-only displayName', () => {
    const result = joinFamilySchema.safeParse({
      inviteCode: 'ABC234',
      displayName: '   ',
      email: 'p@e.com',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('joinFamilySchema strips surrounding whitespace from inviteCode before length check', () => {
    const result = joinFamilySchema.safeParse({
      inviteCode: '  ABC234  ',
      displayName: 'Partner',
      email: 'p@e.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.inviteCode).toBe('ABC234');
  });

  it('joinFamilySchema rejects pure-whitespace inviteCode', () => {
    const result = joinFamilySchema.safeParse({
      inviteCode: '      ',
      displayName: 'Partner',
      email: 'p@e.com',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });
});

describe('whitespace handling on email fields', () => {
  it('loginSchema strips surrounding whitespace from email before format check', () => {
    const result = loginSchema.safeParse({
      email: '  test@example.com  ',
      password: 'password123',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('test@example.com');
  });

  it('loginSchema rejects whitespace-only email (fails format check after trim)', () => {
    const result = loginSchema.safeParse({
      email: '   ',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('registerSchema inherits the email trim from loginSchema', () => {
    const result = registerSchema.safeParse({
      email: '  user@example.com  ',
      password: 'password123',
      displayName: 'Test',
      familyName: 'Test Family',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('user@example.com');
  });

  it('joinFamilySchema strips surrounding whitespace from email before format check', () => {
    const result = joinFamilySchema.safeParse({
      inviteCode: 'ABC234',
      displayName: 'Partner',
      email: '  partner@example.com  ',
      password: 'password123',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('partner@example.com');
  });

  it('joinFamilySchema rejects whitespace-only email (fails format check after trim)', () => {
    const result = joinFamilySchema.safeParse({
      inviteCode: 'ABC234',
      displayName: 'Partner',
      email: '   ',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });
});

// Email local-part case-sensitivity is RFC-permissible but no real-world
// provider treats `John@Example.com` and `john@example.com` as different
// inboxes. Normalizing to lowercase prevents duplicate-account-by-case
// bugs at the future Convex sync boundary. Same shape as the v0.5.75
// `.trim()` work — normalize at the schema, single source of truth.
describe('email lowercasing on auth schemas', () => {
  it('loginSchema lowercases mixed-case email', () => {
    const result = loginSchema.safeParse({
      email: 'John@Example.COM',
      password: 'password123',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('john@example.com');
  });

  it('loginSchema combines trim + lowercase', () => {
    const result = loginSchema.safeParse({
      email: '  John@Example.COM  ',
      password: 'password123',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('john@example.com');
  });

  it('registerSchema inherits lowercasing from loginSchema', () => {
    const result = registerSchema.safeParse({
      email: 'USER@EXAMPLE.COM',
      password: 'password123',
      displayName: 'Test',
      familyName: 'Test Family',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('user@example.com');
  });

  it('joinFamilySchema lowercases mixed-case email', () => {
    const result = joinFamilySchema.safeParse({
      inviteCode: 'ABC234',
      displayName: 'Partner',
      email: 'Partner@Example.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('partner@example.com');
  });

  it('loginSchema preserves already-lowercase email unchanged', () => {
    const result = loginSchema.safeParse({
      email: 'already@lower.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('already@lower.com');
  });
});

describe('childSchema.dateOfBirth format validation', () => {
  it('accepts undefined dateOfBirth (field is optional)', () => {
    const result = childSchema.safeParse({ name: 'Emma' });
    expect(result.success).toBe(true);
  });

  it('accepts empty string dateOfBirth (after trim)', () => {
    const result = childSchema.safeParse({ name: 'Emma', dateOfBirth: '' });
    expect(result.success).toBe(true);
  });

  it('accepts whitespace-only dateOfBirth (trims to empty, treated as optional)', () => {
    const result = childSchema.safeParse({ name: 'Emma', dateOfBirth: '   ' });
    expect(result.success).toBe(true);
  });

  it('accepts a valid YYYY-MM-DD date', () => {
    const result = childSchema.safeParse({ name: 'Emma', dateOfBirth: '2020-01-15' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.dateOfBirth).toBe('2020-01-15');
  });

  it('strips surrounding whitespace before validating the date', () => {
    const result = childSchema.safeParse({ name: 'Emma', dateOfBirth: '  2020-01-15  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.dateOfBirth).toBe('2020-01-15');
  });

  it('rejects US-style MM/DD/YYYY format', () => {
    const result = childSchema.safeParse({ name: 'Emma', dateOfBirth: '12/05/2020' });
    expect(result.success).toBe(false);
  });

  it('rejects free-form text', () => {
    const result = childSchema.safeParse({ name: 'Emma', dateOfBirth: 'yesterday' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid month (2020-13-01)', () => {
    const result = childSchema.safeParse({ name: 'Emma', dateOfBirth: '2020-13-01' });
    expect(result.success).toBe(false);
  });

  it('rejects a date that does not exist due to month rollover (2020-02-30)', () => {
    const result = childSchema.safeParse({ name: 'Emma', dateOfBirth: '2020-02-30' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid day (2020-04-31)', () => {
    const result = childSchema.safeParse({ name: 'Emma', dateOfBirth: '2020-04-31' });
    expect(result.success).toBe(false);
  });

  it('accepts a leap-year Feb 29 (2020-02-29)', () => {
    const result = childSchema.safeParse({ name: 'Emma', dateOfBirth: '2020-02-29' });
    expect(result.success).toBe(true);
  });

  it('rejects a non-leap-year Feb 29 (2021-02-29)', () => {
    const result = childSchema.safeParse({ name: 'Emma', dateOfBirth: '2021-02-29' });
    expect(result.success).toBe(false);
  });
});

describe('childSchema.dateOfBirth future-date guard', () => {
  const yyyymmdd = (d: Date): string => {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  it('accepts today as dateOfBirth', () => {
    const today = yyyymmdd(new Date());
    const result = childSchema.safeParse({ name: 'Emma', dateOfBirth: today });
    expect(result.success).toBe(true);
  });

  it('rejects tomorrow as dateOfBirth with the future-date message', () => {
    const tomorrow = yyyymmdd(new Date(Date.now() + 24 * 60 * 60 * 1000));
    const result = childSchema.safeParse({ name: 'Emma', dateOfBirth: tomorrow });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Date of birth cannot be in the future');
    }
  });

  it('rejects a far-future date (2099-05-07)', () => {
    const result = childSchema.safeParse({ name: 'Emma', dateOfBirth: '2099-05-07' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Date of birth cannot be in the future');
    }
  });

  it('still surfaces the format error for malformed strings, not the future-date message', () => {
    const result = childSchema.safeParse({ name: 'Emma', dateOfBirth: 'tomorrow' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Date of birth must be a valid YYYY-MM-DD date');
    }
  });
});

describe('childSchema.dateOfBirth past-date guard', () => {
  const yyyymmdd = (d: Date): string => {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  it('accepts a date 1 year ago', () => {
    const oneYearAgo = new Date();
    oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);
    const result = childSchema.safeParse({ name: 'Emma', dateOfBirth: yyyymmdd(oneYearAgo) });
    expect(result.success).toBe(true);
  });

  it('accepts a date 100 years ago (within 130-year limit)', () => {
    const hundredYearsAgo = new Date();
    hundredYearsAgo.setUTCFullYear(hundredYearsAgo.getUTCFullYear() - 100);
    const result = childSchema.safeParse({ name: 'Emma', dateOfBirth: yyyymmdd(hundredYearsAgo) });
    expect(result.success).toBe(true);
  });

  it('rejects a date 150 years ago with the past-date message', () => {
    const tooOld = new Date();
    tooOld.setUTCFullYear(tooOld.getUTCFullYear() - 150);
    const result = childSchema.safeParse({ name: 'Emma', dateOfBirth: yyyymmdd(tooOld) });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Date of birth is too far in the past');
    }
  });

  it('rejects a far-past year typo (1925-05-07, off-by-100 fat-finger)', () => {
    const result = childSchema.safeParse({ name: 'Emma', dateOfBirth: '1825-05-07' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Date of birth is too far in the past');
    }
  });

  it('rejects year 0001-01-01', () => {
    const result = childSchema.safeParse({ name: 'Emma', dateOfBirth: '0001-01-01' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Date of birth is too far in the past');
    }
  });

  it('still surfaces the format error for malformed strings, not the past-date message', () => {
    const result = childSchema.safeParse({ name: 'Emma', dateOfBirth: '99-99-99' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Date of birth must be a valid YYYY-MM-DD date');
    }
  });
});

describe('whitespace handling on optional string fields', () => {
  describe('childSchema.notes', () => {
    it('coerces whitespace-only notes to undefined', () => {
      const result = childSchema.safeParse({ name: 'Emma', notes: '   ' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.notes).toBeUndefined();
    });

    it('coerces empty string notes to undefined', () => {
      const result = childSchema.safeParse({ name: 'Emma', notes: '' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.notes).toBeUndefined();
    });

    it('strips surrounding whitespace from non-empty notes', () => {
      const result = childSchema.safeParse({ name: 'Emma', notes: '  picky eater  ' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.notes).toBe('picky eater');
    });
  });

  describe('foodSchema.defaultPreparation', () => {
    it('coerces whitespace-only defaultPreparation to undefined', () => {
      const result = foodSchema.safeParse({
        name: 'Broccoli',
        category: 'vegetable',
        defaultPreparation: '   ',
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.defaultPreparation).toBeUndefined();
    });

    it('strips surrounding whitespace from non-empty defaultPreparation', () => {
      const result = foodSchema.safeParse({
        name: 'Broccoli',
        category: 'vegetable',
        defaultPreparation: '  steamed  ',
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.defaultPreparation).toBe('steamed');
    });
  });

  describe('exposureSchema.preparation', () => {
    it('coerces whitespace-only preparation to undefined', () => {
      const result = exposureSchema.safeParse({
        childId: 'c1',
        foodId: 'f1',
        stage: 'taste',
        preparation: '   ',
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.preparation).toBeUndefined();
    });

    it('strips surrounding whitespace from non-empty preparation', () => {
      const result = exposureSchema.safeParse({
        childId: 'c1',
        foodId: 'f1',
        stage: 'taste',
        preparation: '  roasted  ',
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.preparation).toBe('roasted');
    });
  });

  describe('exposureSchema.notes', () => {
    it('coerces whitespace-only notes to undefined', () => {
      const result = exposureSchema.safeParse({
        childId: 'c1',
        foodId: 'f1',
        stage: 'taste',
        notes: '   ',
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.notes).toBeUndefined();
    });

    it('coerces empty string notes to undefined', () => {
      const result = exposureSchema.safeParse({
        childId: 'c1',
        foodId: 'f1',
        stage: 'taste',
        notes: '',
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.notes).toBeUndefined();
    });

    it('strips surrounding whitespace from non-empty notes', () => {
      const result = exposureSchema.safeParse({
        childId: 'c1',
        foodId: 'f1',
        stage: 'taste',
        notes: '  spit it out  ',
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.notes).toBe('spit it out');
    });
  });
});
