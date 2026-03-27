import { families, users, children, foods, exposures, foodChains } from '../schema';
import { getTableColumns } from 'drizzle-orm';

describe('Database Schema', () => {
  describe('families table', () => {
    it('has expected columns', () => {
      const columns = getTableColumns(families);
      expect(columns.id).toBeDefined();
      expect(columns.name).toBeDefined();
      expect(columns.inviteCode).toBeDefined();
      expect(columns.createdAt).toBeDefined();
      expect(columns.syncedAt).toBeDefined();
    });

    it('has id as primary key', () => {
      const columns = getTableColumns(families);
      expect(columns.id.primary).toBe(true);
    });
  });

  describe('users table', () => {
    it('has expected columns', () => {
      const columns = getTableColumns(users);
      expect(columns.id).toBeDefined();
      expect(columns.familyId).toBeDefined();
      expect(columns.email).toBeDefined();
      expect(columns.displayName).toBeDefined();
      expect(columns.avatarUrl).toBeDefined();
      expect(columns.createdAt).toBeDefined();
    });
  });

  describe('children table', () => {
    it('has expected columns', () => {
      const columns = getTableColumns(children);
      expect(columns.id).toBeDefined();
      expect(columns.familyId).toBeDefined();
      expect(columns.name).toBeDefined();
      expect(columns.dateOfBirth).toBeDefined();
      expect(columns.avatarEmoji).toBeDefined();
      expect(columns.notes).toBeDefined();
      expect(columns.createdAt).toBeDefined();
    });
  });

  describe('foods table', () => {
    it('has expected columns', () => {
      const columns = getTableColumns(foods);
      expect(columns.id).toBeDefined();
      expect(columns.familyId).toBeDefined();
      expect(columns.name).toBeDefined();
      expect(columns.category).toBeDefined();
      expect(columns.defaultPreparation).toBeDefined();
      expect(columns.imageUrl).toBeDefined();
      expect(columns.isSafeFood).toBeDefined();
      expect(columns.createdAt).toBeDefined();
    });
  });

  describe('exposures table', () => {
    it('has expected columns', () => {
      const columns = getTableColumns(exposures);
      expect(columns.id).toBeDefined();
      expect(columns.childId).toBeDefined();
      expect(columns.foodId).toBeDefined();
      expect(columns.stage).toBeDefined();
      expect(columns.rating).toBeDefined();
      expect(columns.preparation).toBeDefined();
      expect(columns.temperature).toBeDefined();
      expect(columns.texture).toBeDefined();
      expect(columns.mealType).toBeDefined();
      expect(columns.setting).toBeDefined();
      expect(columns.notes).toBeDefined();
      expect(columns.loggedBy).toBeDefined();
      expect(columns.occurredAt).toBeDefined();
      expect(columns.createdAt).toBeDefined();
      expect(columns.syncedAt).toBeDefined();
    });

    it('has all the tracking fields needed for food exposure', () => {
      const columns = getTableColumns(exposures);
      // Core fields
      expect(columns.childId).toBeDefined();
      expect(columns.foodId).toBeDefined();
      expect(columns.stage).toBeDefined();
      // Optional detail fields
      expect(columns.rating).toBeDefined();
      expect(columns.preparation).toBeDefined();
      expect(columns.temperature).toBeDefined();
      expect(columns.texture).toBeDefined();
      expect(columns.mealType).toBeDefined();
      expect(columns.setting).toBeDefined();
      expect(columns.notes).toBeDefined();
    });
  });

  describe('foodChains table', () => {
    it('has expected columns', () => {
      const columns = getTableColumns(foodChains);
      expect(columns.id).toBeDefined();
      expect(columns.childId).toBeDefined();
      expect(columns.sourceFoodId).toBeDefined();
      expect(columns.targetFoodId).toBeDefined();
      expect(columns.similarityNote).toBeDefined();
      expect(columns.createdAt).toBeDefined();
    });

    it('links source and target foods', () => {
      const columns = getTableColumns(foodChains);
      expect(columns.sourceFoodId).toBeDefined();
      expect(columns.targetFoodId).toBeDefined();
    });
  });

  describe('table count', () => {
    it('has 6 tables total', () => {
      // Verify all tables exist by checking they have columns
      expect(Object.keys(getTableColumns(families)).length).toBeGreaterThan(0);
      expect(Object.keys(getTableColumns(users)).length).toBeGreaterThan(0);
      expect(Object.keys(getTableColumns(children)).length).toBeGreaterThan(0);
      expect(Object.keys(getTableColumns(foods)).length).toBeGreaterThan(0);
      expect(Object.keys(getTableColumns(exposures)).length).toBeGreaterThan(0);
      expect(Object.keys(getTableColumns(foodChains)).length).toBeGreaterThan(0);
    });
  });

  describe('column counts', () => {
    it('families has 5 columns', () => {
      expect(Object.keys(getTableColumns(families))).toHaveLength(5);
    });

    it('users has 7 columns', () => {
      expect(Object.keys(getTableColumns(users))).toHaveLength(7);
    });

    it('children has 8 columns', () => {
      expect(Object.keys(getTableColumns(children))).toHaveLength(8);
    });

    it('foods has 9 columns', () => {
      expect(Object.keys(getTableColumns(foods))).toHaveLength(9);
    });

    it('exposures has 15 columns', () => {
      expect(Object.keys(getTableColumns(exposures))).toHaveLength(15);
    });

    it('foodChains has 7 columns', () => {
      expect(Object.keys(getTableColumns(foodChains))).toHaveLength(7);
    });
  });
});
