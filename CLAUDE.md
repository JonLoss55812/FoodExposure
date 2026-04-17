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
v0.2.0

## Changelog
- v0.2.0 — Exposure hierarchy UX: "Bump to {next stage}" one-tap primary action on food detail page; writes new `exposures` row (no mutation). Confirmed log form already surfaces all 6 stages at lg size with `tolerate` default. Added `src/lib/stage.ts` helpers (`getNextStage`, `canBumpStage`).
- v0.1.1 — Null-child safety pass: `ensureSelection` on child-store, auto-repair of stale/null child id in tab layout, onboarding redirect when no children, progress-screen loading-forever fix.
- v0.1.0 — Initial versioning rules added to CLAUDE.md
