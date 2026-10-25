# CLAUDE.md

Guidance for Claude Code when working on TongueTutor (FoodExposure).

## Project Overview

**TongueTutor** is an offline-first mobile app (Expo + React Native) built on evidence-based
pediatric feeding therapy. Parents log *exposures* — a food presented to a child at one of six
SOS hierarchy stages (tolerate → interact → smell → touch → taste → eat) — and the app tracks
exposure counts against an acceptance threshold that varies by feeding profile (15/20/30).

All data lives in on-device SQLite. There is **no cloud sync today**: `convex/` holds a
scaffolded backend that nothing in `app/` calls yet.

**Current state:** `APP_VERSION` is `v0.5.231` (`src/lib/constants.ts`). 1059 tests pass across
70 suites; `npx tsc --noEmit` is clean. See `CHANGELOG.md` for the
per-version history and the rationale behind non-obvious decisions.

## Tech Stack

| Layer | Tech | Details |
|-------|------|---------|
| **App** | Expo 55, React Native 0.83, TypeScript 5.9, Expo Router | Typed routes; 5 bottom tabs (index/log/foods/progress/settings) |
| **Styling** | Unistyles 3.1 | Theme tokens in `src/styles/theme.ts` |
| **Local storage** | expo-sqlite via Drizzle ORM; react-native-mmkv | 6 tables; MMKV backs the three zustand stores |
| **State** | zustand (+ persist/MMKV), react-hook-form + zod | `src/stores/`, `src/lib/validation.ts` |
| **Backend** | Convex (scaffolded, **not wired**) | `convex/` — no `app/` code calls it |
| **Testing** | Jest 30 on the `jest-expo/web` preset, @testing-library/react | 1059 tests, 70 suites |
| **Telemetry** | Sentry, PostHog | Both no-op when their env var is absent |

## Key Features

- **Onboarding:** create a family (first launch) or join one with a 6-character invite code.
- **Log Exposure:** pick child + food + stage, plus optional rating, meal, temperature,
  texture, setting, notes and a backdated date.
- **Foods:** searchable/filterable list with per-food exposure counts; "⭐ Safe Foods" pinned row.
- **Food detail:** rename, change category/preparation, toggle safe-food, one-tap stage bump,
  per-exposure edit (stage/rating/notes/date) and delete, plus delete-food cascade.
- **Progress:** exposures-toward-threshold bars, stage distribution, category tiles, avg rating.
- **Settings:** theme, feeding profile, CSV export via the system share sheet, rename/edit/delete child, sign out.

There is **no allergen tracking** and **no photo capture** — both were early ideas that were
never built. Multi-child *is* supported (`ChildSelector` on the dashboard).

## Directory Structure

```
app/                       # Expo Router pages (tests colocated in __tests__/)
├── (tabs)/
│   ├── index.tsx          Dashboard (today's count, stage distribution, recent activity)
│   ├── foods.tsx          Food library
│   ├── progress.tsx       Charts + per-food threshold progress
│   ├── log.tsx            Log Exposure form (the app's primary write path)
│   └── settings.tsx       Theme, feeding profile, CSV export, family management
├── food/{add,[id]}.tsx    Add food / food detail
├── child/{add,[id]}.tsx   Add child / edit child (both host the shared ChildForm)
├── onboarding/{index,add-child,join}.tsx
└── _layout.tsx            Root layout (providers + theme registration)

src/
├── components/            Button, FoodCard, ExposureCard, StageIndicator, ProgressBar, …
├── db/                    client.ts, schema.ts (Drizzle), migration.ts (SQL), migrate.ts (runner)
├── lib/                   Pure helpers — the bulk of the test suite lives against these
├── providers/             Convex, React Query, Database (runs runMigrations, then FKs on)
├── stores/                zustand + MMKV: auth-store, child-store, settings-store
├── styles/                Unistyles theme + contrast tests
└── test-utils/            mock-db.ts, sqlite-db.ts, screen-helpers.tsx (excluded from coverage)

convex/                    Scaffolded backend — not called by the app
```

There is no `src/hooks/`, `src/utils/`, `src/theme/`, `src/types/` or top-level `tests/`
directory. Tests are colocated in `__tests__/` next to the code they cover.

## How to Run

Bun is the project's declared package manager (`bun.lock` is committed), but **npm works and
is what recent sessions have used** — `node_modules/` and `package-lock.json` are gitignored.

```bash
npm install          # or: bun install
npm run test         # 1059 tests, 70 suites
npx tsc --noEmit     # type check — run this, it catches things tests do not
```

Running the app:

```bash
npm run ios          # expo start --ios
npm run android      # expo start --android
npm run web          # expo start --web
npm start            # expo start
```

Unistyles 3.1 needs NitroModules, so **Expo Go will not work** — `npm run ios` / `npm run
android` build a dev client. Only `npm run web` runs without native tooling.

Configuration is optional. To enable telemetry, copy `.env.example` to `.env` and uncomment the
variables you have real values for. Every line ships commented out, because a placeholder
value is not "unset" (a fake PostHog key would initialise PostHog). All are safe to leave unset:

| Variable | Read by | If unset |
|----------|---------|----------|
| `EXPO_PUBLIC_SENTRY_DSN` | `src/lib/sentry.ts` | Sentry init is skipped |
| `EXPO_PUBLIC_POSTHOG_API_KEY` | `src/lib/posthog.ts` | PostHog init is skipped |
| `EXPO_PUBLIC_POSTHOG_HOST` | `src/lib/posthog.ts` | Defaults to `https://us.i.posthog.com` |
| `EXPO_PUBLIC_CONVEX_URL` | `src/providers/ConvexProvider.tsx` | Falls back to a placeholder URL (harmless — nothing queries Convex) |

## Important Notes

- **Never bare `bun test`:** it invokes Bun's *built-in* test runner, which hangs on this
  jest-expo suite. Use `bun run test` / `npm run test` / `npx jest`.
- **Jest 30 flag:** the filter flag is `--testPathPatterns` (plural). To run one area:
  `npx jest --testPathPatterns=src/components`.
- **Web preset:** the suite runs under `jest-expo/web` + jsdom, not on a device. Two known
  limits are load-bearing when writing tests: react-native-web does not serialize
  `accessibilityState.selected`/`.disabled` to the DOM, and computed layout is unavailable —
  so chip highlights are not assertable from a test. A declared `minHeight` *is*: react-native-web
  emits it as a CSS rule that jsdom's `getComputedStyle(el).minHeight` resolves (v0.5.194).
- **Expo Router:** typed routes are enabled (`app.json` → `experiments.typedRoutes`). Some
  route strings still need an `as any` cast (e.g. the `/(tabs)` group root).
- **Schema changes are numbered steps** (v0.5.190): `runMigrations` in `src/db/migrate.ts`
  applies each entry of `MIGRATIONS` above the database's `PRAGMA user_version`, once, in
  its own transaction. Step 1 is the frozen baseline `MIGRATION_SQL` — **never edit it**;
  append a step (`ALTER TABLE … ADD COLUMN …`). The `CHECK` constraints from
  v0.5.123–v0.5.131 predate this and remain fresh-install-only.
- **`src/db/migrations/0000_init.sql` is not executed.** It is drizzle-kit output from the
  initial commit (`drizzle.config.ts` points `out` there) and has none of the later CHECKs or
  indexes. The boot schema is `MIGRATIONS` in `src/db/migration.ts`. Do not edit the `.sql`
  file expecting an effect.
- **`.planning/` is gitignored.** Pusher reports there must be committed with `git add -f`,
  or they never leave the worktree. Earlier sessions cited `dependencies-2026-10-10.md` and
  `performance-2026-10-13.md` without committing them, so those files do not exist.
- **Foreign keys are enforced** (v0.5.193): `DatabaseProvider` runs
  `PRAGMA foreign_keys = ON` after the migrations. Deletes must go dependents-first
  (use `src/lib/cascade-delete.ts`); a parent-first delete now throws. For a test that
  needs real SQL, `createSqliteDb()` in `src/test-utils/sqlite-db.ts` is a drizzle
  instance over `node:sqlite` with FKs on.

## Database Schema (SQLite)

Six tables, defined in `src/db/schema.ts` (Drizzle) and created by `MIGRATION_SQL` in
`src/db/migration.ts`. Every table carries `created_at` and a nullable `synced_at` reserved
for the future Convex sync.

```
families     (id, name, invite_code, …)
users        (id, family_id, email, display_name, avatar_url, …)
children     (id, family_id, name, date_of_birth, avatar_emoji, notes, …)
foods        (id, family_id, name, category, default_preparation, image_url, is_safe_food, …)
exposures    (id, child_id, food_id, stage, rating, preparation, temperature, texture,
              meal_type, setting, notes, logged_by, occurred_at, …)
food_chains  (id, child_id, source_food_id, target_food_id, similarity_note, …)
```

`exposures` is the only unbounded table and carries the three indexes added in v0.5.170.
`src/db/__tests__/migration.test.ts` executes `MIGRATION_SQL` against an in-memory
`node:sqlite` database, so the constraints and indexes are covered by tests, not inspection.

## Testing

- **1059 tests across 70 suites.** Unit tests for `src/lib/**` + `src/stores/**`, component
  tests for `src/components/**`, and screen tests for every `app/` screen with real logic.
- Screen tests are built on `src/test-utils/`: `createMockDb()` (a structural fake of the
  drizzle builder with a FIFO queue of canned reads and recorded writes) and
  `screen-helpers.tsx` (`SafeArea`, `click`, `confirmAlert`, `pressAlertButton`).
- The established seams a new screen test needs: mock `expo-router` to a `mock`-prefixed
  router spy, mock `@/src/db/client` **with a getter** so each test's fresh db is picked up,
  spy on `Alert.alert` so copy is assertable, and reset the zustand stores via `logout()`.
- **Mutation-check new tests.** The changelog records, repeatedly, that a test which passes
  with the code it claims to cover deleted is worse than no test. Several were removed rather
  than shipped green-but-vacuous.

## Conventions

- **Pure helpers over inline logic.** Screen logic worth testing gets extracted to `src/lib/`
  as a pure function — that is what makes it verifiable without a render harness.
- **Optional fields round-trip as absent.** Forms write `?? null`; the zod schemas map blank
  or whitespace-only optional text to `undefined`. Never persist `''` for "not recorded".
- **Dates:** ISO 8601 in the CSV export with an explicit local offset; `occurred_at` (and every
  `mode: 'timestamp'` column) is stored by drizzle as **whole seconds**, not milliseconds —
  compare through drizzle (`gte(col, date)`), never raw SQL on `getTime()` (v0.5.199). Every date-bucketed surface uses the **local** calendar day.
- **Navigation:** `useRouter()` + `router.push`/`replace`. The codebase does not use `<Link>`.
- **Styles:** Unistyles tokens from `src/styles/theme.ts`. No inline colours — v0.5.153–v0.5.156
  removed the last hardcoded hex literals and `src/styles/__tests__/contrast.test.ts` asserts
  every text/surface pairing clears WCAG AA.
- **Writes are latch-guarded.** Every async write handler holds a synchronous
  `createInFlightLatch()` (`src/lib/in-flight.ts`), released in `finally`. For confirm dialogs
  the latch is acquired *inside* the callback, never in the function that opens the Alert.

## Build & Deployment

EAS profiles are defined in `eas.json` (development / preview / production). There are **no
`eas:*` npm scripts** — invoke the CLI directly:

```bash
npx eas build --platform ios --profile production
npx eas build --platform android --profile production
```

Both `app.json` (`extra.eas.projectId`) and `eas.json`'s submit block still carry
`YOUR_*` placeholders, so nothing can actually be built or submitted until an EAS account is
configured.

## Known Limitations

- **No cloud sync.** `convex/` is scaffolded and unreferenced; `synced_at` is never written.
- **No auth.** "Sign in" is a local display name; emails are synthesized offline
  (`deriveLocalEmailPart`) and `users.email` has no UNIQUE constraint.
- **Charts are simple** — bars and tiles, no time-series plots.
- **Date entry is free text** (`YYYY-MM-DD`), not a picker; no date-picker package is installed.
- **`npm audit` reports 59 advisories from 5 roots, none fixable** (v0.5.204; reasoning in that
  changelog entry). `braces`, `node-forge` and `sprintf-js`
  have no patched release; `decode-uri-component`'s fix is ESM-only (v0.5.165); `esbuild`'s
  "fix" is a drizzle-kit downgrade. All five are in build/test tooling, not the app bundle.
- **Web is probably not cross-origin isolated, so expo-sqlite may not open in a browser.**
  Since v0.5.205 `expo export --platform web` builds, and `metro.config.js`'s
  `enhanceMiddleware` sets COOP/COEP. But under `npm run web` those headers reach only
  Metro's bundle responses. The HTML document at `/` is served without them (checked with
  `curl` on 2026-10-15), and a browser decides isolation from the document's headers.
  `metro-config.test.ts` pins that the middleware sets them, not that the page gets them.
  A static host must send `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: credentialless` itself. Never browser-verified.

## Next Priority

See `NEXT_STEPS.md`, which is kept current and lists the concrete gap list. The standing
larger item is wiring the Convex backend to replace local-only SQLite storage:

1. Verify the baseline first: `npm run test` — expect 1059 tests, 70 suites, no failures.
2. Inspect `convex/schema.ts` and the per-entity files (`children.ts`, `foods.ts`, …).
3. Pick the first endpoint to wire: `fetchChildren` (simplest) → `addFood` → `logFood`.
4. Keep SQLite as fallback during the transition — do not remove local storage.
5. Commit as `feat: wire $ENDPOINT endpoint to Convex backend` and update this file.

**Do not:** break existing tests, change `app.json` / `eas.json` without understanding the EAS
pipeline, or ship a test that still passes when the code it covers is deleted.

## Research Background (Food Exposure Methods)

The app is grounded in evidence-based pediatric feeding therapy. Key findings:

**Why 8–15+ exposures matter:** Most parents give up after 3–5 attempts. Research shows typical children need 8–15 exposures for acceptance; picky eaters need 15–20+; ARFID/problem feeders need 20–30+.

**An "exposure" is not just tasting** — it includes seeing, smelling, touching, and being near the food.

**Core principles (common across SOS, Food Chaining, Three E's):**
- No pressure — never force, coerce, or bribe
- Repeated neutral exposure at a child-led pace
- Multisensory progression (sight → smell → touch → taste → eat)
- Preferred/safe foods always available alongside new foods
- Consistency over intensity

**Exposure hierarchy (SOS 6 categories):** Tolerate → Interact → Smell → Touch → Taste → Eat

**Key data to track per food:** name/category, preparation method, texture, temperature, current stage in hierarchy, exposure count (goal: 15+), acceptance rating (1–5), reaction notes.

**Key data to track per session:** date/time, meal type, setting, foods presented, child mood, pressure level, who was present.

**Progress metrics:** food repertoire size, exposures per food vs. threshold, stage movement, food chains (accepted → target), regression tracking, consistency streaks.

Sources: SOS Approach (Dr. Kay Toomey), Food Chaining (Fraker et al.), The Three E's (Melanie Potock), Kids Feeding Wellness 5 Levels.

## Structure
src/ — source code
app/ — Expo Router pages


## Versioning Rules
- Include a version number in the bottom-right corner of the UI (e.g., `v1.0.0`)
- Follow semantic versioning: `MAJOR.MINOR.PATCH`
- Increment the version after every feature:
  - PATCH for bug fixes and minor tweaks
  - MINOR for new features
  - MAJOR for breaking changes or major redesigns
- After every versioned commit:
  - Update the version in this file (Current state + Current Version) and in
    `APP_VERSION` (`src/lib/constants.ts`)
  - Add an entry at the top of `CHANGELOG.md` saying what changed and why
    (do **not** add changelog entries here — this file is loaded into every
    session, and the changelog grew it to ~470 KB before v0.5.231)

## Current Version
v0.5.231

## Changelog
See `CHANGELOG.md` (newest first).
