import { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { router } from 'expo-router';
import type { ErrorBoundaryProps } from 'expo-router';
import { Sentry } from '@/src/lib/sentry';
import { EmptyState } from './EmptyState';

/**
 * Fallback for an uncaught render error, exported as `ErrorBoundary` from the
 * root layout (the safety net) and from each tab and food/child modal screen,
 * where it contains the crash to that screen so the navigator stays usable.
 *
 * It reports explicitly: an error caught by a React boundary never reaches
 * Sentry's global handler, and React only `console.error`s it, which Sentry
 * records as a breadcrumb rather than an event. The raw message is not shown —
 * a failed drizzle query's message carries its bound values (v0.5.181).
 */
/**
 * Whether there is a screen to pop back to. At the root this boundary renders
 * outside the navigator, where asking it can throw — and a fallback that
 * crashes on top of the crash it is reporting shows nothing at all.
 */
function canGoBackSafely(): boolean {
  try {
    return router.canGoBack();
  } catch {
    return false;
  }
}

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
      >
        {/* On a modal, Try again re-renders the same broken screen and Android
            has no swipe-to-dismiss, so offer the way out explicitly. Hidden
            at a tab root, where there is nothing behind this screen. */}
        {canGoBackSafely() && (
          <Pressable
            style={styles.backAction}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backText}>Go back</Text>
          </Pressable>
        )}
      </EmptyState>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  backAction: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  backText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.primaryStrong,
  },
}));
