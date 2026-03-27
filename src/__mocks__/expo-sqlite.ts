// Simple in-memory mock for expo-sqlite
const databases = new Map<string, MockDatabase>();

class MockDatabase {
  private tables = new Map<string, any[]>();

  execAsync(sql: string) {
    // Parse CREATE TABLE statements and initialize empty tables
    const createMatches = sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g);
    for (const match of createMatches) {
      if (!this.tables.has(match[1])) {
        this.tables.set(match[1], []);
      }
    }
    return Promise.resolve();
  }

  runAsync(sql: string, params?: any[]) {
    return Promise.resolve({ changes: 1, lastInsertRowId: 1 });
  }

  getFirstAsync(sql: string, params?: any[]) {
    return Promise.resolve(null);
  }

  getAllAsync(sql: string, params?: any[]) {
    return Promise.resolve([]);
  }
}

export function openDatabaseSync(name: string, options?: any) {
  if (!databases.has(name)) {
    databases.set(name, new MockDatabase());
  }
  return databases.get(name)!;
}
