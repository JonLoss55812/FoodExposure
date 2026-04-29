# CLAUDE.md

Guidance for Claude Code when working on TongueTutor (FoodExposure).

## Project Overview

**TongueTutor** is a mobile app (Expo + React Native) for tracking children's food exposure and literacy. Parents log foods their child has tried, mark allergies/aversions, and track nutrition/behavior over time. The app uses local SQLite storage with Convex backend support (future). Built for iOS and Android.

**Current state:** Core app stable (1.0.0) with 130+ tests passing, good coverage. Backend uses Convex + Drizzle ORM. Recently refactored with input validation, error handling, N+1 query fixes, and SafeAreaView. Ready for feature expansion or deployment.

## Tech Stack

| Layer | Tech | Details |
|-------|------|---------|
| **Mobile App** | Expo 55, React Native 0.83, TypeScript, Unistyles 3.1, React Query 5 | Typed routes, bottom tabs (settings/foods/progress/log) |
| **Local Storage** | SQLite (expo-sqlite), react-native-mmkv | Per-child food log, allergen tracking |
| **Backend** | Convex + Drizzle ORM | Real-time sync (future) |
| **Testing** | Jest 30, React Native Testing Library, Jest-Expo | 130+ tests, 6 suites |
| **Runtime** | Bun (package manager + scripts, not npm) | `bun.lock` included |
| **Sentry** | Error tracking + session tracking | Configured in app.json plugins |

## Key Features

- **Onboarding:** Add child (name, age, photo)
- **Food Log:** Log foods tried, date, reaction notes
- **Allergen Tracking:** Mark known allergies and aversions
- **Progress Charts:** Visualize exposure over time (with trends)
- **Settings:** App config, data export, privacy
- **Multi-child:** Support multiple children (future roadmap)

## Directory Structure

```
app/
├── (tabs)/              # Main tabbed navigation
│   ├── index.tsx       (Foods — main list)
│   ├── foods.tsx       (Foods tab)
│   ├── progress.tsx    (Charts + trends)
│   ├── log.tsx         (Activity log)
│   └── settings.tsx    (App settings)
├── food/               # Food detail pages
│   ├── add.tsx         (Add new food)
│   ├── [id].tsx        (View/edit food)
│   └── _layout.tsx
├── child/              # Child management
│   ├── add.tsx         (Add child)
│   ├── [id].tsx        (Edit child)
│   └── _layout.tsx
├── onboarding/         # First-time user flow
│   ├── index.tsx       (Start)
│   ├── add-child.tsx
│   └── join.tsx
└── _layout.tsx         # Root layout

src/
├── hooks/              # Custom hooks (useFood, useChild, etc.)
├── components/         # Reusable UI components
├── utils/              # Helpers (date, calculation)
├── db/                 # SQLite setup + queries
├── theme/              # Unistyles theme tokens
└── types/              # TypeScript types

convex/                # Backend functions (future)
├── schema.ts          (Drizzle ORM)
└── functions.ts       (API routes)

tests/                 # Jest test suites
├── components/
├── db/
├── hooks/
└── utils/
```

## How to Run

**Mobile (iOS Simulator):**
```bash
bun install
bun ios
# Opens Expo Go on iOS simulator
```

**Android:**
```bash
bun android
```

**Web:**
```bash
bun web
```

**Tests:**
```bash
bun test                # Run all tests
bun test:watch         # Watch mode
bun test:coverage      # Coverage report
```

## Important Notes

- **Bun, not npm:** This project uses Bun as the package manager. All scripts use `bun run`.
- **SQLite on device:** Data is stored locally in SQLite. Sync to Convex is planned.
- **Expo Router:** Typed routes enabled (`experiments.typedRoutes: true`). Routes must match file structure.
- **Unistyles 3.1:** NitroModules required. Cannot use Expo Go — must use `bun ios` / `bun android`.
- **Multi-child support:** Schema designed for multiple children, but UI currently assumes single child (refactor in progress).

## Database Schema (SQLite)

```sql
children (id, name, birth_date, photo_url)
foods (id, name, category, allergen_flags)
logs (id, child_id, food_id, date, reaction, notes)
```

See `src/db/` for detailed setup.

## Testing

- **130+ tests** across 6 suites (components, db, hooks, utils)
- **43.8% line coverage** (good for MVP)
- Use `jest --testPathPattern=src/components` to run component tests only
- All tests use React Native Testing Library conventions

## Conventions

- **Allergen flags:** Store as comma-separated in schema, parse as array in app
- **Child reference:** All logs include child_id (future multi-child support)
- **Date format:** ISO 8601 in database, formatted on display
- **Navigation:** Use Expo Router's `Link` component, not React Navigation directly
- **Styles:** Unistyles tokens in `src/theme/themes.ts` (not inline or Tailwind)

## Key Hooks

- `useChild()` — Get current child from context
- `useFood(id)` — Fetch food by ID
- `useFoods()` — List all foods
- `useLog()` — Activity log
- `useProgress()` — Calculate exposure trends

## Build & Deployment

```bash
# EAS build (Expo's CI/CD)
bun run eas:build:ios
bun run eas:build:android

# Publish to App Store / Play Store
# (Set up with EAS Account)
```

See `eas.json` for build profiles.

## Known Limitations

- Single child assumption in UI (refactor planned)
- No cloud sync yet (Convex wiring in progress)
- Charts are basic (could add more detail)
- No multi-user / parental consent flows

## Next Priority

v1.0.0 is stable with 130+ tests passing. Next: wire Convex backend to replace local-only SQLite storage.

1. Verify tests pass: `bun test` — expect 130+, 6 suites, no failures
2. Inspect `convex/schema.ts` and `convex/functions.ts` — see what's scaffolded
3. Pick first endpoint to wire: `fetchChildren` (simplest) → `addFood` → `logFood`
4. Update `src/hooks/useChild.ts` (or similar) to call Convex instead of SQLite
5. Keep SQLite as fallback during transition — do not remove local storage yet
6. Commit: `feat: wire $ENDPOINT endpoint to Convex backend`
7. Update this file with next endpoint

**Do not:** break existing tests, change `app.json`/`eas.json` without understanding EAS pipeline, deploy to App Store until all endpoints are wired.

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
- Update this CLAUDE.md file after every commit with:
  - Current version number
  - Brief note on what changed

## Current Version
v0.5.14

## Changelog
- v0.5.14 — Fix: surface DB-load failures on Dashboard and Progress tabs. `app/(tabs)/index.tsx:81` and `app/(tabs)/progress.tsx:51` previously swallowed errors with `console.error` only, leaving the user staring at zeroed cards or stale data with no signal that something went wrong — indistinguishable from "I haven't logged anything yet". `app/(tabs)/foods.tsx:48-50` already showed `Alert.alert('Error', '...')` on the same failure mode; this commit harmonizes the two outliers to that pattern. Wording matches the existing copy ("Failed to load <thing>. Please try again."). No new tests — these are screen-level integration paths that would need a render harness; the change is a one-line behavior addition, not a logic refactor. Bumped to v0.5.14. 262 tests pass across 23 suites.
- v0.5.13 — Fix: single-source the displayed app version. The Settings tab's About card hardcoded `v0.5.6` at `app/(tabs)/settings.tsx:192` and was never bumped during the v0.5.7 → v0.5.12 refactor train, so users opening Settings saw a 6-patch-stale version — confusing for "what's installed" and useless for bug reports. Added `APP_VERSION` constant to `src/lib/constants.ts` and read it in Settings via the `@/src/lib/constants` import. New unit test pins the format (`/^v\d+\.\d+\.\d+$/`) so any future contributor who removes the `v` prefix or breaks semver gets a failing test, not a silent UI regression. Bumped to v0.5.13. 262 tests pass across 23 suites.
- v0.5.12 — Refactor: drop the parallel `selectedFoodId` / `selectedStage` `useState` from the Log Exposure form (`app/(tabs)/log.tsx`) and derive both from the form's own state via `watch('foodId')` / `watch('stage')`. The screen previously held two `useState` slots that mirrored the form's `foodId` and `stage` fields; every chip tap and stage tap had to write to *both* (`setSelectedFoodId(food.id); setValue('foodId', food.id)`), which created a drift-by-construction bug surface — any future contributor adding a new code path that wrote to the form (`setValue`, `reset`) without touching the React state would leave the chip highlight pointing at one selection while the form (and validation/submit) carried another. The post-submit cleanup at the end of `onSubmit` had to call all three reset paths in lockstep (`reset({...}); setSelectedFoodId(null); setSelectedStage('tolerate');`) for the same reason. Removed both `useState` slots; UI selection now reads from `watch()`, so `reset()` flows back to the highlight automatically. Cleaned up 1 unused type import (`ExposureStage`). The remaining v0.5.7 `useEffect` that mirrors `selectedChildId` from the child store into the form is untouched — that one is genuinely cross-store sync, not duplicate state. No behavior change on the happy path; the eliminated drift is structural. 235 tests still pass across 21 suites; TypeScript clean.
- v0.5.11 — Refactor: route `calcProgressStats` (`src/lib/progress-stats.ts`) through canonical `getHighestStage` instead of an inline `STAGE_ORDER.indexOf` comparison. The previous loop set `highestStagePerFood[foodId] = stage` even when `stage` was a legacy/unknown string, then bucketed it into `stageCounts` — phantom keys like `stageCounts.mystery` would persist and never render under the JSX (which iterates `STAGE_ORDER`), silently dropping foods from the Stage Distribution widget on the Progress tab. Same drift v0.5.8 fixed for the Foods tab and v0.5.10 fixed for the dashboard, here for the progress screen. Restructured: a single pass buckets exposures by `foodId` into a `Map`, then a second pass calls `getHighestStage` on each bucket (skipping unknown stages) and feeds both `highestStagePerFood` and `stageCounts`. `totalFoods` switched from `Object.keys(highestStagePerFood).length` to `Object.keys(exposureCountPerFood).length` — semantic shift that matches the UI label "Foods Tried": a food with only unknown-stage rows is still a tried food, even if its highest stage can't be classified. +1 unit test asserts this exact split (food a with two unknown stages, food b with one valid stage → totalFoods=2, totalExposures=3, stageCounts={eat:1}). 235 tests pass across 21 suites.
- v0.5.10 — Refactor: extract `computeStageCounts(exposures)` into `src/lib/food-partition.ts` and route the dashboard's stage-distribution computation through it. The dashboard at `app/(tabs)/index.tsx:76-87` previously held a 12-line inline pass that grouped exposures by `foodId`, picked the highest stage per food using `STAGE_ORDER.indexOf` directly (without the unknown-stage skip from canonical `getHighestStage`), then re-iterated to bucket counts — the same drift v0.5.8 fixed for the Foods tab, but here for the home screen's "Stage Distribution" widget. The helper delegates per-food highest-stage selection to `getHighestStage`, so a legacy/unknown stage string in `exposures` no longer corrupts the count map (previously, `counts['mystery']` could appear and never render in the STAGE_ORDER-driven JSX, silently dropping foods from the distribution). Dashboard `loadData` is now a 1-liner over the helper. +5 unit tests cover empty input, single-food/highest-stage selection, multi-food aggregation at the same stage, all-unknown skip, and mixed-known/unknown selection. 234 tests pass across 21 suites.
- v0.5.9 — Refactor: extract `filterFoods(foods, search, category)` from `app/(tabs)/foods.tsx` into `src/lib/food-partition.ts`. The Foods tab held a 5-line inline filter that combined a substring search (lowercased on every keystroke) with a category equality check; now a 1-liner over the helper. Two small correctness improvements come along: whitespace-only search input no longer narrows results (was previously calling `.includes(' ')` which still matched everything but lowercased pointlessly), and the no-op fast path (empty search + "all" category) returns a fresh array slice rather than re-running `.filter` over every render. +9 unit tests cover the no-op path returning a distinct copy, case-insensitive matching, substring matching, category-only filtering, search+category AND, no-match emptiness, whitespace-only no-op, empty-list passthrough. 229 tests across 21 suites.
- v0.5.8 — Refactor: extract `buildFoodsWithStats(foods, exposures)` from `app/(tabs)/foods.tsx` into `src/lib/food-partition.ts`. The screen previously embedded a 25-line block that grouped exposures by `foodId` into a `Map`, then ran an inline loop to compute `highestStage` per food using `STAGE_ORDER.indexOf` with a comparison that did not skip unknown stage strings — inconsistent with the canonical `getHighestStage` helper used by `app/food/[id].tsx` (extracted in v0.5.4), so the two screens could disagree on a food's highest reached stage if any exposure row carried a legacy/unknown stage value. The new helper delegates to `getHighestStage`, harmonizing the two read paths. Foods screen `loadFoods` is now a 1-liner over the helper. +7 unit tests covering empty inputs, foods with no exposures, exposure counting, highest-stage selection, unknown-stage skip behavior, all-unknown returning `undefined`, input order preservation, and orphan-foodId tolerance. 220 tests pass across 21 suites.
- v0.5.7 — Fix: Log Exposure form's `childId` value now stays in sync with `useChildStore`. Two related defects: (1) `defaultValues.childId` snapshots `selectedChildId` once at form mount; if `ensureSelection` resolved the child *after* the form mounted (or the user switched child from another tab), the form held `childId=''` while the on-screen ChildSelector showed a child as selected — tapping Save then failed silently with the inline "Select a child" error from v0.5.1, even though the child appeared chosen. (2) After a successful submit, `reset()` restored that mount-time empty default, forcing the parent to re-tap the child for every subsequent exposure in a session — annoying since the SOS pattern is multiple short exposures per meal. Now: a `useEffect` mirrors `selectedChildId` into the form via `setValue('childId', ...)` whenever it changes, and the post-submit `reset({ childId: data.childId, foodId: '', stage: 'tolerate' })` preserves the just-used child so back-to-back logging works. No new tests (the bug only manifests through `useForm` + react-hook-form's lifecycle, which is not unit-testable without a render harness; behavior verified by re-running the existing 213 tests across 21 suites).
- v0.5.6 — Fix: distinguish loading vs not-found on the food detail page. `app/food/[id].tsx` previously rendered `null` whenever `food` was falsy, so the user saw a blank white screen during the initial DB query AND forever if the `id` route param pointed at a deleted/invalid row. Now: tracks a `loading` flag (default true, cleared in a finally), shows an `ActivityIndicator` while loading, and renders an `EmptyState` ("🤔 Food Not Found") with a "Go to Foods" action that `router.replace`s to the foods list when the row genuinely doesn't exist. The query no longer silently keeps stale food state when the new id misses (was `if (foodResult[0]) setFood(...)`, now `setFood(foodResult[0] ?? null)`).
- v0.5.5 — Refactor: extract `getEncouragementMessage(stats)` from `app/(tabs)/progress.tsx` into `src/lib/progress-stats.ts`. The encouragement copy under the progress tab was a 9-line nested ternary embedded in JSX — untestable and easy to reword incorrectly. Now a pure function with 4 named branches: zero exposures, early (<10), near-target (uses `foodProgress[0].threshold` with a 15 fallback), and established. +6 unit tests cover the empty/early/near/established branches plus the 10-exposure boundary and the threshold fallback. No copy or behavior change.
- v0.5.4 — Refactor: extract `getHighestStage(exposures)` helper from `app/food/[id].tsx` into `src/lib/stage.ts`, alongside the existing `getNextStage` / `canBumpStage`. The detail screen previously embedded an 8-line manual loop computing the highest reached stage from the in-memory exposures list — now a 1-line helper call. The helper iterates once, ignores unknown stage strings, and returns `null` for the empty case (mirroring how `STAGE_ORDER.indexOf` would behave for missing values). +6 unit tests covering empty list, single exposure, highest-among-many, terminal-stage-wins, unknown-stage skip, and all-unknown null. No behavior change.
- v0.5.3 — Refactor: extract `calcProgressStats(foods, exposures, profile, now?)` pure helper from `app/(tabs)/progress.tsx` into `src/lib/progress-stats.ts`. The previous `loadStats` callback mixed 80+ lines of data crunching (highest stage per food, stage/category counts, weekly window, per-food progress sort, foodsNearTarget) with React state and was untestable. The screen now does a 1-line call and only owns the React effect. The helper accepts an injectable `now` parameter so the trailing-7-day weekly window is deterministic. +9 unit tests covering empty inputs, safe-food count independence, highest-stage tracking, weekly boundary (Date and number), avgRating with/without ratings, sort order with ties, foodsNearTarget threshold semantics, and the picky profile (threshold 20). No behavior change.
- v0.5.2 — Foods tab now distinguishes "no foods at all" from "no matches for current filter". Previously the screen showed "No Foods Yet → Add Food" any time `filteredFoods.length === 0`, even if the user had foods and just typed a search that matched none — a misleading CTA that nudged duplicates. Added `getEmptyStateKind(totalCount, filteredCount)` to `src/lib/food-partition.ts` returning `'none' | 'filtered' | 'has-results'`. The "filtered" state shows a "🔎 No Matches" EmptyState with a "Clear Filters" action that resets `searchQuery` and `selectedCategory`. +4 unit tests for the helper.
- v0.5.1 — Log Exposure form now surfaces inline validation errors. `app/(tabs)/log.tsx` previously destructured `errors` from `useForm` but never rendered them, so tapping "Save Exposure" without picking a child or food failed silently. Added `errors.childId` / `errors.foodId` text below their respective sections (matches the pattern already used in `app/food/add.tsx`) and added `foodId: ''` to `defaultValues` so zod surfaces the error reliably. New `error` style mirrors `theme.colors.error`.
- tests: raise `src/lib/export.ts` coverage from 70.83% → 95.83% lines (overall 85.5% → 88.5%). New `src/lib/__tests__/export.integration.test.ts` covers `fetchExportRows` (empty, Date passthrough, numeric-timestamp coercion, query-builder call order) and `exportChildData` (share-sheet invocation with filename+CSV, header-only empty export, error propagation). +7 tests, no version bump per NEXT_STEPS.md P6 guidance.
- v0.5.0 — CSV data export (therapist-ready offline feature): new `src/lib/export.ts` provides pure `formatExposuresCsv`, `csvEscape`, `buildExportFilename` helpers (RFC 4180 quote-escape for commas, quotes, newlines) plus `fetchExportRows` (exposures JOIN foods, ordered by `occurredAt desc`) and `exportChildData` (uses React Native's built-in `Share` API — no new packages). Settings tab gains a "Data → Export Data (CSV)" row that opens the system share sheet with CSV content. 16 new tests cover the escape/format/filename logic.
- v0.4.0 — Per-food exposure progress vs profile-based threshold: new `src/lib/thresholds.ts` exposes `EXPOSURE_THRESHOLDS = { typical: 15, picky: 20, arfid: 30 }` and a `calcExposureProgress` helper. `feedingProfile` added to `settings-store` (default `typical`) with a chip selector on the Settings tab. Progress tab now lists each food with logged exposures alongside a `current/threshold` ProgressBar, sorted by proximity to threshold, with a check when reached.
- v0.3.0 — Safe-food availability surface: Foods tab pins a "⭐ Safe Foods" horizontal row above the main list when ≥1 safe food exists. FoodCard renders a star next to the name. Food detail page has a tap-to-toggle "Mark as Safe Food" control that persists to the `foods` table. Added pure `partitionSafeFoods` helper in `src/lib/food-partition.ts` with unit tests.
- v0.2.0 — Exposure hierarchy UX: "Bump to {next stage}" one-tap primary action on food detail page; writes new `exposures` row (no mutation). Confirmed log form already surfaces all 6 stages at lg size with `tolerate` default. Added `src/lib/stage.ts` helpers (`getNextStage`, `canBumpStage`).
- v0.1.1 — Null-child safety pass: `ensureSelection` on child-store, auto-repair of stale/null child id in tab layout, onboarding redirect when no children, progress-screen loading-forever fix.
- v0.1.0 — Initial versioning rules added to CLAUDE.md
