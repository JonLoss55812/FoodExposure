import { families, users, children, foods, exposures, foodChains } from '../schema';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';

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

  describe('foreign key references', () => {
    /**
     * Resolve the inline foreign keys for `table` and return one entry per FK
     * with the source column name and the resolved foreign-table name. Calling
     * `.reference()` on each ForeignKeyBuilder is what invokes the schema's
     * `() => referencedTable.column` arrow lambdas — without this, those lines
     * stay uncovered (the lambdas are never called at module-import time).
     */
    function resolveForeignKeys(
      table: Parameters<typeof getTableConfig>[0],
    ): { columnName: string; foreignTable: string }[] {
      const cfg = getTableConfig(table);
      return cfg.foreignKeys.map((fkBuilder: any) => {
        const ref = fkBuilder.reference();
        return {
          columnName: ref.columns[0].name,
          foreignTable: ref.foreignTable[Symbol.for('drizzle:Name')] as string,
        };
      });
    }

    it('users.familyId references families', () => {
      const fks = resolveForeignKeys(users);
      expect(fks).toEqual(
        expect.arrayContaining([{ columnName: 'family_id', foreignTable: 'families' }]),
      );
    });

    it('children.familyId references families', () => {
      const fks = resolveForeignKeys(children);
      expect(fks).toEqual(
        expect.arrayContaining([{ columnName: 'family_id', foreignTable: 'families' }]),
      );
    });

    it('foods.familyId references families', () => {
      const fks = resolveForeignKeys(foods);
      expect(fks).toEqual(
        expect.arrayContaining([{ columnName: 'family_id', foreignTable: 'families' }]),
      );
    });

    it('exposures references children, foods, and users', () => {
      const fks = resolveForeignKeys(exposures);
      expect(fks).toEqual(
        expect.arrayContaining([
          { columnName: 'child_id', foreignTable: 'children' },
          { columnName: 'food_id', foreignTable: 'foods' },
          { columnName: 'logged_by', foreignTable: 'users' },
        ]),
      );
    });

    it('foodChains.childId references children, source/target reference foods', () => {
      const fks = resolveForeignKeys(foodChains);
      expect(fks).toEqual(
        expect.arrayContaining([
          { columnName: 'child_id', foreignTable: 'children' },
          { columnName: 'source_food_id', foreignTable: 'foods' },
          { columnName: 'target_food_id', foreignTable: 'foods' },
        ]),
      );
    });

    it('families has no inline foreign keys (root of the hierarchy)', () => {
      expect(resolveForeignKeys(families)).toEqual([]);
    });
  });
});
