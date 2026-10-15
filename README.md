# TongueTutor

An offline-first mobile app for tracking a child's food exposures, grounded in evidence-based
pediatric feeding therapy (SOS Approach, Food Chaining, The Three E's).

Research shows a child typically needs **8–15 exposures** to accept a new food; picky eaters
need 15–20, and ARFID/problem feeders 20–30+. Most parents give up after 3–5. TongueTutor
exists to make that count visible.

An "exposure" is not just tasting — it is any step on the six-stage hierarchy:

> **tolerate → interact → smell → touch → taste → eat**

Parents log which stage the child reached, and the app tracks exposures-per-food against the
acceptance threshold for their feeding profile.

## Status

Local-only. All data is stored in on-device SQLite; **nothing syncs to a server.** The
`convex/` directory holds a scaffolded backend that no app code calls yet. There is no
account system — "signing in" creates a local family record with an invite code. The
code is never displayed, and Join Family only finds families on the same device.

In-app version: `v0.5.213` (`src/lib/constants.ts`). 1005 tests across 63 suites.

## Requirements

- **Node.js 22+** — the real-SQL tests (`src/db/__tests__/`, and every suite built on
  `src/test-utils/sqlite-db.ts`) import the built-in `node:sqlite` module.
- **npm** (or Bun — `bun.lock` is committed, but npm is what recent work has used).
- For iOS/Android: Xcode / Android Studio. **Expo Go will not work** — Unistyles 3.1 requires
  NitroModules, so the native targets need a development build.

## Install

```bash
npm install
```

No flags needed. `node_modules/` and `package-lock.json` are gitignored.

`npm audit` reports 59 advisories (13 moderate, 46 high) from 5 root packages. None is
fixable, and all five are in build/test tooling rather than the app bundle — see "Known
Limitations" and the v0.5.204 changelog entry in `CLAUDE.md`. Do not run `npm audit fix
--force`; its "fix" for `esbuild` is a drizzle-kit downgrade.

## Configure

**Configuration is entirely optional.** The app runs with no `.env` at all. To enable
telemetry, copy `.env.example` to `.env` and uncomment the variables you have real values
for. Every line in it is commented out on purpose: a placeholder value is not "unset" — a
fake PostHog key, for example, would initialise PostHog.

| Variable | Read by | If unset |
|----------|---------|----------|
| `EXPO_PUBLIC_SENTRY_DSN` | `src/lib/sentry.ts` | Sentry init is skipped |
| `EXPO_PUBLIC_POSTHOG_API_KEY` | `src/lib/posthog.ts` | PostHog init is skipped |
| `EXPO_PUBLIC_POSTHOG_HOST` | `src/lib/posthog.ts` | Defaults to `https://us.i.posthog.com` |
| `EXPO_PUBLIC_CONVEX_URL` | `src/providers/ConvexProvider.tsx` | Falls back to a placeholder URL — harmless, nothing queries Convex |

## Run

```bash
npm run web        # expo start --web — the only target with no native toolchain requirement
npm run ios        # expo start --ios      (needs a dev build, not Expo Go)
npm run android    # expo start --android  (needs a dev build, not Expo Go)
npm start          # expo start
```

**Web caveat.** expo-sqlite on web needs a cross-origin-isolated page, which takes the
headers `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy:
credentialless` **on the HTML document**. `metro.config.js` sets them, but under `npm run
web` they reach only Metro's bundle responses: the HTML at `/` is served without them
(checked with `curl`, 2026-10-15). So the database may not open in the browser. A static build
from `npx expo export --platform web` needs its host to send both headers.

On first launch you land in onboarding: create a family, then add a child. From there the
five tabs are Dashboard, Log, Foods, Progress and Settings.

## Test

```bash
npm run test           # 1005 tests, 63 suites
npm run test:watch
npm run test:coverage
npx tsc --noEmit       # type check — run this too; it catches things the tests do not
```

Run one area with Jest 30's **plural** filter flag:

```bash
npx jest --testPathPatterns=src/components
```

> **Never run bare `bun test`.** That invokes Bun's built-in test runner, which hangs on this
> jest-expo suite. Use `bun run test` so the `package.json` script runs.

The suite runs under the `jest-expo/web` preset in jsdom, not on a device. Tests are colocated
in `__tests__/` directories next to the code they cover.

## Layout

```
app/        Expo Router pages — (tabs)/, food/, child/, onboarding/
src/
  components/   Shared UI
  db/           Drizzle schema + numbered migration steps, run on boot (migrate.ts)
  lib/          Pure helpers — most of the test suite targets these
  providers/    Convex, React Query, Database
  stores/       zustand + MMKV (auth, selected child, settings)
  styles/       Unistyles theme
  test-utils/   Mock db, real in-memory SQLite db, screen-test helpers
convex/     Scaffolded backend — not called by the app
```

## Contributing

- `CLAUDE.md` is the working guide: conventions, test harness seams, and a detailed changelog
  recording *why* each decision was made.
- `NEXT_STEPS.md` holds the current gap list. Check `git log` against any claim there before
  acting on it.
- The project uses semantic versioning via the `APP_VERSION` constant in
  `src/lib/constants.ts`, which is rendered in the UI. Bump it with each change and add a
  changelog entry to `CLAUDE.md`.
- New tests should be mutation-checked: delete the code the test claims to cover and confirm
  the test actually fails. A green-but-vacuous test is worse than no test.
