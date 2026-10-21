# Hardening pass — 2026-10-21

Baseline: 1031 tests / 65 suites, `tsc --noEmit` clean (after `npm install`; the
worktree had no `node_modules`).
After: 1032 tests / 65 suites, `tsc --noEmit` clean.

Prior pass: `hardening-2026-09-30.md`. Its "checked and fine" items were not redone.

## Fixed

1. **v0.5.222 — Export failure alert showed the raw query error**
   (`app/(tabs)/settings.tsx` `handleExport`). It alerted `err.message`. For a failed
   drizzle query that is `Failed query: <sql>\nparams: <values>`: SQL a parent cannot
   act on, plus the child's ids and data in any screenshot sent for help. Now fixed copy.
   The `console.error` keeps the detail, and Sentry gets it with params redacted
   (v0.5.181). +1 test, red before the change (it received the SQL string).
   This was the only `err.message`-to-UI path among the screen catches. The
   DatabaseProvider error screen also renders `err.message`, but migration SQL binds no
   user values, and the message helps support, so it was left alone.

## Found, not fixed (reported only)

- **Large export on Android.** `exportChildData` passes the whole CSV as the share
  `message`, which becomes an Intent `EXTRA_TEXT`. Past Android's ~1 MB binder limit
  (roughly 8–10k exposures at ~100 bytes each, in range for the two-year user that
  v0.5.170 modelled), `startActivity` throws `TransactionTooLargeException`. RN's
  `ShareModule.kt` catches `Exception` and rejects with "Failed to open share dialog".
  So it fails loudly, not with a crash, but the parent has no way around it. The real
  fix is writing a file (expo-file-system) and sharing a URI. That is a new dependency
  and needs a device to verify, so it is out of scope here.
- **`DatabaseProvider.initDb` has no single-flight guard.** Two concurrent runs would
  both read `user_version`, and the second would re-apply steps the first just applied.
  Steps 1–2 are idempotent, so nothing breaks today. A future `ALTER TABLE … ADD COLUMN`
  step is not idempotent: the loser would fail "duplicate column" and `setError`, and
  the error screen would cover the winner's success (Try Again would then recover).
  It is not reachable today. Expo Router does not use StrictMode (grep of
  `node_modules/expo-router/build`), and the Try Again button unmounts after the first
  press, so a DOM test cannot produce a second call. Per the task rules (no blind
  concurrency fixes), this is reported, not fixed. Worth a latch when the first ALTER step lands.
- `SplashScreen.preventAutoHideAsync()` / `hideAsync()` in `app/_layout.tsx` have no
  `.catch`. A rejection would surface only as an unhandled-rejection warning. This is
  the pattern Expo documents, so it was left as is.

## Checked and fine

- `initSentry` / `initPostHog`: both no-op without env vars. Sentry's `init` logs on an
  invalid DSN rather than throwing, so the module-scope call cannot take down the root layout.
- Every screen `catch` logs and then shows fixed-copy Alerts, except the one fixed above.
- `runMigrations`: ROLLBACK on failure, version is bumped in the same transaction, and a
  downgrade is left alone.
