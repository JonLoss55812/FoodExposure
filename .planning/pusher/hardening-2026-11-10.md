# Hardening pass — 2026-11-10

Baseline: 1178 tests / 74 suites, all passing (v0.5.259).
After: unchanged. **No code changes.** Nothing new was found that met the bar.

Prior passes: `hardening-2026-09-30.md`, `hardening-2026-10-21.md`. Their findings were
not redone. The one open concurrency item from 10-21 (`initDb` had no single-flight guard)
has since been fixed: `DatabaseProvider` now holds an in-flight latch.

## Checked and fine (new this pass)

- **Deep-link route params** (`tonguetutor://food/<id>`, `child/<id>`). Both screens
  return early on a blank `id`. Both scope the read by `familyId`, so another family's id
  reads as not-found. A malformed param, such as an array from a repeated query key, either
  fails the bind or matches nothing. A failed bind is caught: it logs and shows a fixed-copy
  Alert. Writes only run once a family-scoped row has loaded. This fails closed.
- **Persisted MMKV state.** All three stores wrap MMKV get/set/remove in try/catch, and
  each one's `merge` type-checks every field. The auth store also refuses
  `isAuthenticated: true` unless the full auth tuple is present. A corrupt or old blob
  falls back to the defaults.
- **Unknown enum values read from SQLite.** The CHECK constraints apply to fresh installs
  only, so an old install could hold a stage or category the app doesn't know.
  `getStageConfig`/`getCategoryConfig` fall back to a default, `getHighestStage` skips
  unknown stages, and the direct `STAGE_CONFIG[x]` lookups only iterate `STAGE_ORDER`. They
  also use a `?.label ?? exp.stage` fallback. No render crash.
- **User text inputs.** The per-row notes, date, food rename and child rename editors are
  all validated through the same zod `shape` fields as the main forms. Join checks the
  invite-code format before querying. Its display name is trimmed and capped at 50
  characters by `maxLength`.
- **CSV export.** Formula-injection prefixing is in place (OWASP CSV injection).
- **Pull-to-refresh.** `onRefresh` in foods, progress and dashboard calls
  `setRefreshing(false)` outside a `finally`. Each loader catches internally and never
  rethrows, so the spinner cannot get stuck. Adding a `finally` would be noise.
- **Sentry scrubbing.** `beforeSend` redacts every `exception.values[].value`, and
  linked `cause` errors are covered too. `beforeBreadcrumb` redacts console arguments. If
  a scrub hook throws, Sentry drops the event rather than sending it unscrubbed, so this
  fails closed.
- **Unhandled rejections.** Every `async` handler and loader in `app/` has a
  try/catch. The tab layout's selection repair logs on failure.

## Noted, not changed

- **App downgrade.** `runMigrations` silently leaves alone a database that is ahead of
  the app's step list. Once a future step adds a NOT NULL column, an older sideloaded
  build's inserts would fail with only the generic "Failed to save" Alert. This can't
  happen until such a step exists. When it does, consider a `console.warn` (and so a
  Sentry breadcrumb) on `version > migrations.length`.
- The large-CSV Android share failure is still open (NEXT_STEPS B3). It needs
  expo-file-system and a device.
