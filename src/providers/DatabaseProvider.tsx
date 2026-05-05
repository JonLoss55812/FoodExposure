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
            invite_code TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            synced_at INTEGER
          );

          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            family_id TEXT REFERENCES families(id),
            email TEXT NOT NULL,
            display_name TEXT NOT NULL,
            avatar_url TEXT,
            created_at INTEGER NOT NULL,
            synced_at INTEGER
          );

          CREATE TABLE IF NOT EXISTS children (
            id TEXT PRIMARY KEY,
            family_id TEXT NOT NULL REFERENCES families(id),
            name TEXT NOT NULL,
            date_of_birth TEXT,
            avatar_emoji TEXT NOT NULL DEFAULT '👶',
            notes TEXT,
            created_at INTEGER NOT NULL,
            synced_at INTEGER
          );

          CREATE TABLE IF NOT EXISTS foods (
            id TEXT PRIMARY KEY,
            family_id TEXT NOT NULL REFERENCES families(id),
            name TEXT NOT NULL,
            category TEXT NOT NULL CHECK(category IN ('protein','vegetable','fruit','grain','dairy','other')),
            default_preparation TEXT,
            image_url TEXT,
            is_safe_food INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
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
            occurred_at INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            synced_at INTEGER
          );

          CREATE TABLE IF NOT EXISTS food_chains (
            id TEXT PRIMARY KEY,
            child_id TEXT NOT NULL REFERENCES children(id),
            source_food_id TEXT NOT NULL REFERENCES foods(id),
            target_food_id TEXT NOT NULL REFERENCES foods(id),
            similarity_note TEXT,
            created_at INTEGER NOT NULL,
            synced_at INTEGER
          );
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
