import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, Text, Pressable } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { expoDb } from '../db/client';
import { runMigrations } from '../db/migrate';
import { createInFlightLatch } from '../lib/in-flight';

export function DatabaseProvider({ children }: { children: ReactNode }) {
  // Usable here even though this gate wraps every screen: Unistyles 3 needs no
  // provider, and _layout imports src/styles/theme (StyleSheet.configure)
  // before it renders.
  const { theme } = useUnistyles();
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every screen sits behind this gate, so a failed migration used to be a
  // dead end twice over: nothing was logged (Sentry only hears about errors
  // that reach console.error or are thrown), and the only way past a
  // transient failure such as a locked database was to kill the app.
  //
  // Single-flight: a second run started before the first finishes (StrictMode's
  // double effect, a retry) would read the same user_version and re-apply
  // every step, and a non-idempotent ALTER TABLE step would then fail and
  // cover the first run's success with an error screen.
  const initLatch = useRef(createInFlightLatch()).current;
  const initDb = useCallback(async () => {
    if (!initLatch.tryAcquire()) return;
    setError(null);
    try {
      await runMigrations(expoDb);
      // expo-sqlite opens connections with foreign keys off, which left every
      // REFERENCES clause decorative. It is a per-connection setting, so it
      // lives here rather than in a migration step, and it comes *after* the
      // migrations: step 2 repairs the orphans an unenforced database could
      // accumulate, and a future step that rebuilds a table needs it off.
      await expoDb.execAsync('PRAGMA foreign_keys = ON;');
      setIsReady(true);
    } catch (err) {
      console.error('Failed to initialize database:', err);
      setError(err instanceof Error ? err.message : 'Database initialization failed');
    } finally {
      initLatch.release();
    }
  }, [initLatch]);

  useEffect(() => {
    initDb();
  }, [initDb]);

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
          gap: 16,
          backgroundColor: theme.colors.background,
        }}
      >
        <Text style={{ color: theme.colors.error, textAlign: 'center' }}>Database Error: {error}</Text>
        <Pressable
          onPress={initDb}
          accessibilityRole="button"
          accessibilityLabel="Retry opening the database"
          style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 20 }}
        >
          <Text style={{ color: theme.colors.primaryStrong, fontWeight: '600' }}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}
