# Dependencies audit — 2026-10-31 (v0.5.243)

Baseline: 1132/1134 tests. Two `settings.test.tsx` age tests failed because of a month-end
date rollover in the test helper. That bug is unrelated to dependencies and is fixed in
2089607. After all changes: 1134/1134 tests across 72 suites, `tsc --noEmit` clean,
`expo export --platform web` exit 0.

## Changed
| Change | Why | Verified |
|---|---|---|
| `zod` `^4.3.6` → `^4.6.6` | GHSA-mrhx-c7xc-m3w5 (high). `bun.lock` pinned 4.3.6. The app bundles zod, but `src/lib/validation.ts` and the forms use no `z.array`/`z.set`, so the advisory was not reachable. | full suite, tsc, web export |
| `bun.lock` regenerated (`npx bun@1.3.14 install --lockfile-only`) | It still listed deps removed since v0.5.204 (uuid, ts-jest, jest-native, @types/uuid, @testing-library/jest-dom) and react-native 0.83.2. `bun install --frozen-lockfile` **failed** on the old lockfile (reproduced). | frozen bun install in scratch dir succeeds and gives zod 4.6.7 |

## Remaining `npm audit`: 48 advisories (3 low, 40 moderate, 5 high), 6 roots
| Root | Pulled in by | Fix | Reachable from user input? |
|---|---|---|---|
| decode-uri-component ≤0.5.0 (high) | expo-router → query-string | patched version is ESM-only (v0.5.165); npm's suggestion is expo-router 58 (SDK major) | No. On native, URL params come from deep links; the attacker would need to craft a link and the cost is CPU on one device. Low priority. |
| zod <4.6.6 (high) | `@expo/cli` private zod 3.25.76 | no 3.x patch; forcing zod 4 into the CLI is unsafe | No (dev CLI only) |
| esbuild ≤0.24.2 | drizzle-kit | fix is a drizzle-kit downgrade | No (dev tool) |
| glob 9–14.0.1, minimatch <11.0.1 | jest 29 (via jest-expo), @react-native/codegen, rimraf, @expo/cli | Expo SDK 58 | No (build/test) |
| deepmerge ≥4.2.0 (low) | Expo build tooling | Expo SDK 58 | No |

The `braces`, `node-forge` and `sprintf-js` advisories listed at v0.5.204 no longer appear.

## Outdated (report-only: all are majors or SDK-pinned)
Every `expo-*` package, `jest-expo`, `babel-preset-expo`, `react-native` (0.83 → 0.88),
reanimated/worklets/screens/gesture-handler and react 19.3 move together in an
**Expo SDK 55 → 58 upgrade**. That is the one change that would clear most of the audit.
It is a multi-hour job with native rebuilds and is out of scope for a 30-minute session.
Other majors: `@hookform/resolvers` 7, `@sentry/react-native` 8, `@testing-library/react-native` 14,
`typescript` 7. None were attempted.

## Unused (depcheck)
- Runtime: `expo-font` and `expo-web-browser` are registered as plugins in `app.json`.
  `react-native-worklets` is a required peer of reanimated 4. `expo-system-ui` applies
  `userInterfaceStyle` on Android. All four are false positives, so I kept them.
  Removing a plugin means editing `app.json`, which CLAUDE.md says to avoid.
- Dev: `@types/jest`, `jest-environment-jsdom`, `react-test-renderer` and `typescript` are
  types, test env or peers. All false positives.

## Abandoned
None of the direct dependencies is abandoned. All have released within the last year.

## Notes for next time
- Bun is not installed, but `npx -y bun` works (1.3.14). Regenerate `bun.lock` with
  `npx -y bun install --lockfile-only` whenever `package.json` deps change. Earlier
  sessions skipped this (the v0.5.143/v0.5.204 precedent), and that is how the lockfile drifted.
- Bun warns that it does not support nested `overrides`, so `xcode → uuid ^11.1.1` applies
  under npm only. It is not reachable (`uuid.v4()` only).
