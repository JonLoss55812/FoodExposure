import PostHog from 'posthog-react-native';

const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let posthog: PostHog | null = null;

export async function initPostHog() {
  if (!POSTHOG_API_KEY) return;

  posthog = new PostHog(POSTHOG_API_KEY, {
    host: POSTHOG_HOST,
  });
}

export function captureEvent(event: string, properties?: Record<string, any>) {
  posthog?.capture(event, properties);
}

export function identifyUser(userId: string, properties?: Record<string, any>) {
  posthog?.identify(userId, properties);
}
