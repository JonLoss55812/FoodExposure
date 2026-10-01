import { useEffect } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { ErrorBoundaryProps } from 'expo-router';
import { Sentry } from '@/src/lib/sentry';
import { EmptyState } from './EmptyState';

/**
 * Fallback for an uncaught render error, exported as `ErrorBoundary` from the
 * root layout. Without it a throw in any screen has no in-app recovery.
 *
 * It reports explicitly: an error caught by a React boundary never reaches
 * Sentry's global handler, and React only `console.error`s it, which Sentry
 * records as a breadcrumb rather than an event. The raw message is not shown —
 * a failed drizzle query's message carries its bound values (v0.5.181).
 */
export function RouteErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error('Unhandled render error:', error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <View style={styles.container}>
      <EmptyState
        icon="😕"
        title="Something went wrong"
        description="This screen hit an unexpected error. Try again, or restart the app if it keeps happening."
        actionLabel="Try again"
        onAction={() => {
          retry();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));
