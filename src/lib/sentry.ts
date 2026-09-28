import * as Sentry from '@sentry/react-native';
import type { Breadcrumb, ErrorEvent } from '@sentry/react-native';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

// drizzle-orm's DrizzleQueryError message is `Failed query: <sql>\nparams: <values>`,
// and the values are whatever the write bound: child names, food names, free-text
// feeding notes. The handlers' `console.error('Failed to …:', err)` puts that into
// a Sentry console breadcrumb. Keep the SQL (it is what you debug from) and drop
// everything from `params:` to the first stack frame, or to the end of the text —
// a note can span lines, so a single-line match would leak the rest of it.
const QUERY_PARAMS = /params: [\s\S]*?(?=\n\s+at |$)/g;

export function redactQueryParams<T extends string | undefined>(text: T): T {
  if (typeof text !== 'string') return text;
  return text.replace(QUERY_PARAMS, 'params: [redacted]') as T;
}

function redactArgument(arg: unknown): unknown {
  if (typeof arg === 'string') return redactQueryParams(arg);
  if (arg instanceof Error) return redactQueryParams(arg.stack ?? `${arg.name}: ${arg.message}`);
  return arg;
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  const args = breadcrumb.data?.arguments;
  return {
    ...breadcrumb,
    message: redactQueryParams(breadcrumb.message),
    ...(Array.isArray(args) ? { data: { ...breadcrumb.data, arguments: args.map(redactArgument) } } : {}),
  };
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const values = event.exception?.values;
  if (!values) return event;
  return {
    ...event,
    exception: {
      ...event.exception,
      values: values.map((v) => ({ ...v, value: redactQueryParams(v.value) })),
    },
  };
}

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
    beforeBreadcrumb: scrubBreadcrumb,
    beforeSend: scrubEvent,
    environment: __DEV__ ? 'development' : 'production',
  });
}

export { Sentry };
