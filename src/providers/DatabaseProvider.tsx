import { ReactNode, useCallback, useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, Pressable } from 'react-native';
import { expoDb } from '../db/client';
import { runMigrations } from '../db/migrate';

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every screen sits behind this gate, so a failed migration used to be a
  // dead end twice over: nothing was logged (Sentry only hears about errors
  // that reach console.error or are thrown), and the only way past a
  // transient failure such as a locked database was to kill the app.
  const initDb = useCallback(async () => {
    setError(null);
    try {
      await runMigrations(expoDb);
      setIsReady(true);
    } catch (err) {
      console.error('Failed to initialize database:', err);
      setError(err instanceof Error ? err.message : 'Database initialization failed');
    }
  }, []);

  useEffect(() => {
    initDb();
  }, [initDb]);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, gap: 16 }}>
        <Text style={{ color: 'red', textAlign: 'center' }}>Database Error: {error}</Text>
        <Pressable
          onPress={initDb}
          accessibilityRole="button"
          accessibilityLabel="Retry opening the database"
          style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 20 }}
        >
          <Text style={{ color: '#C2410C', fontWeight: '600' }}>Try Again</Text>
        </Pressable>
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
