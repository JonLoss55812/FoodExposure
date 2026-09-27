import * as Sentry from '@sentry/react-native';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry() {
  if (!SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 1.0,
    enableAutoSessionTracking: true,
    // Off on purpose: every screen in this app shows a child's name, feeding
    // notes or exposure history, and an error-event screenshot would ship that
    // to a third party. Stack traces are enough to debug from.
    attachScreenshot: false,
    environment: __DEV__ ? 'development' : 'production',
  });
}

export { Sentry };
