import { ReactNode, useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { expoDb } from '../db/client';

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initDb() {
      try {
        // Run migrations
        await expoDb.execAsync(`
          CREATE TABLE IF NOT EXISTS families (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            invite_code TEXT NOT NULL CHECK(length(invite_code) = 6),
            created_at INTEGER NOT NULL CHECK(created_at > 0),
            synced_at INTEGER
          );

          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            family_id TEXT REFERENCES families(id),
            email TEXT NOT NULL,
            display_name TEXT NOT NULL,
            avatar_url TEXT,
            created_at INTEGER NOT NULL CHECK(created_at > 0),
            synced_at INTEGER
          );

          CREATE TABLE IF NOT EXISTS children (
            id TEXT PRIMARY KEY,
            family_id TEXT NOT NULL REFERENCES families(id),
            name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 50),
            date_of_birth TEXT,
            avatar_emoji TEXT NOT NULL DEFAULT '👶',
            notes TEXT,
            created_at INTEGER NOT NULL CHECK(created_at > 0),
            synced_at INTEGER
          );

          CREATE TABLE IF NOT EXISTS foods (
            id TEXT PRIMARY KEY,
            family_id TEXT NOT NULL REFERENCES families(id),
            name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
            category TEXT NOT NULL CHECK(category IN ('protein','vegetable','fruit','grain','dairy','other')),
            default_preparation TEXT,
            image_url TEXT,
            is_safe_food INTEGER NOT NULL DEFAULT 0 CHECK(is_safe_food IN (0, 1)),
            created_at INTEGER NOT NULL CHECK(created_at > 0),
            synced_at INTEGER
          );

          CREATE TABLE IF NOT EXISTS exposures (
            id TEXT PRIMARY KEY,
            child_id TEXT NOT NULL REFERENCES children(id),
            food_id TEXT NOT NULL REFERENCES foods(id),
            stage TEXT NOT NULL CHECK(stage IN ('tolerate','interact','smell','touch','taste','eat')),
            rating INTEGER CHECK(rating BETWEEN 1 AND 5),
            preparation TEXT,
            temperature TEXT CHECK(temperature IN ('hot','warm','room','cold')),
            texture TEXT CHECK(texture IN ('smooth','crunchy','soft','chewy','mixed')),
            meal_type TEXT CHECK(meal_type IN ('breakfast','lunch','dinner','snack')),
            setting TEXT CHECK(setting IN ('home','school','restaurant','therapy')),
            notes TEXT,
            logged_by TEXT REFERENCES users(id),
            occurred_at INTEGER NOT NULL CHECK(occurred_at > 0),
            created_at INTEGER NOT NULL CHECK(created_at > 0),
            synced_at INTEGER
          );

          CREATE TABLE IF NOT EXISTS food_chains (
            id TEXT PRIMARY KEY,
            child_id TEXT NOT NULL REFERENCES children(id),
            source_food_id TEXT NOT NULL REFERENCES foods(id),
            target_food_id TEXT NOT NULL REFERENCES foods(id),
            similarity_note TEXT,
            created_at INTEGER NOT NULL CHECK(created_at > 0),
            synced_at INTEGER
          );

          -- Indexes on the columns the app actually filters, joins and sorts by.
          -- exposures is the only unboundedly-growing table (15-30 rows per food
          -- per child), and every child-scoped read was a full table scan without
          -- these. CREATE INDEX IF NOT EXISTS runs on every launch, so unlike the
          -- CHECK constraints above this applies retroactively to existing installs.
          --
          -- Measured on a ~9.6k-row exposures table (node:sqlite, see the
          -- .planning/pusher report for the harness):
          --   dashboard "Today's Exposures"   0.683ms -> 0.012ms  (58x)
          --   dashboard recent-10 desc + join 1.501ms -> 0.035ms  (43x)
          --   food detail history for a child 0.724ms -> 0.095ms  (7.6x)
          --   deleteFoodCascade               1.176ms -> 0.326ms  (3.6x)
          -- Cost: +5us per exposure insert, and deleteChildCascade 3.9ms -> 9.4ms
          -- (two index rows to unwind per deleted exposure). Both are one-off user
          -- actions; the reads above run on every tab focus.
          CREATE INDEX IF NOT EXISTS idx_exposures_child_occurred
            ON exposures(child_id, occurred_at);
          CREATE INDEX IF NOT EXISTS idx_exposures_child_food_occurred
            ON exposures(child_id, food_id, occurred_at);
          CREATE INDEX IF NOT EXISTS idx_exposures_food
            ON exposures(food_id);
        `);

        setIsReady(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Database initialization failed');
      }
    }

    initDb();
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: 'red', textAlign: 'center' }}>Database Error: {error}</Text>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  return <>{children}</>;
}
