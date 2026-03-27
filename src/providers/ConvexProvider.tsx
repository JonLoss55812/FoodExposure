import { ConvexProvider as BaseConvexProvider, ConvexReactClient } from 'convex/react';
import { ReactNode } from 'react';

// TODO: Replace with your actual Convex URL from `npx convex dev`
const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL || 'https://placeholder.convex.cloud';

const convex = new ConvexReactClient(CONVEX_URL);

export function ConvexProvider({ children }: { children: ReactNode }) {
  return <BaseConvexProvider client={convex}>{children}</BaseConvexProvider>;
}

export { convex };
