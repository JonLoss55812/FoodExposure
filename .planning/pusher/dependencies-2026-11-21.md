# Dependencies audit — 2026-11-21 (v0.5.278)

Baseline (fresh `npm install`): 1255/1255 tests across 77 suites, `tsc --noEmit` clean.
After the change below: the same 1255/77, tsc clean, `expo export --platform web` exit 0,
and `bun install --frozen-lockfile` in a scratch dir exit 0.

## Changed (f8e9f9d)
| Change | Why |
|---|---|
| Declare `@babel/core ^7.29.0` and `semver ^6.3.1` as devDependencies | `src/db/__tests__/babel-config.test.ts` imports `@babel/core`, and `peer-dependencies.test.ts` requires `semver`. Neither was declared, so both resolved only through hoisting: bun hoisted semver 7.6.3 and npm hoisted 6.3.2. The floors match what is already installed. Note that `npm install -D` writes the installed version as the floor (`^7.29.13`). That made bun keep 7.29.0 for existing consumers and add a second babel subtree of about 750 entries, so I lowered the floors by hand. |
| Regenerate `bun.lock` (bun 1.3.14 `--lockfile-only`) | Its workspace entry still read unistyles `^3.1.1` after e856dfa narrowed the range to `>=3.1.1 <3.8.0`. Frozen installs still passed, because 3.1.1 satisfies both ranges, but the lockfile no longer described `package.json`. Net diff: 8+/16- lines. |

No version bump. This follows the 88ae22f precedent for `chore(deps)` changes to the manifest and lockfile only.

## `npm audit`: 36 advisories (31 moderate, 5 high), 5 roots
Down from 39 (2026-11-05) and 48 (2026-10-31). The `deepmerge` root no longer appears. Every
remaining root is the same one documented in `dependencies-2026-10-31.md`, with the same
reasoning:

| Root | Via | Fix | Reachable from user input? |
|---|---|---|---|
| decode-uri-component ≤0.5.0 (high) | expo-router → query-string | ESM-only patch (v0.5.165), or expo-router 58 | Only through a crafted deep link; the cost is CPU on one device |
| zod <4.6.6 (high) | `@expo/cli`'s private zod 3.25.76 | none in 3.x | No. It is the dev CLI; the app's own zod is 4.6.7 |
| esbuild ≤0.24.2 | drizzle-kit | a drizzle-kit downgrade | No (dev tool) |
| glob 9–14.0.1, minimatch <11.0.1 | jest 29 (via jest-expo), RN codegen, @expo/cli | Expo SDK 58 | No (build/test) |

## Outdated
`npm outdated` shows **Current == Wanted for every package**, so no patch or minor update
is available within the declared ranges. Every gap is a major version or is pinned to the SDK.
- An Expo SDK 55 → 58 upgrade (every `expo-*`, jest-expo, babel-preset-expo, RN 0.83 → 0.88,
  reanimated/worklets/screens/gesture-handler, react 19.3) would clear most of the audit.
  It needs native rebuilds and is out of scope for a 30-minute session. Report only.
- Other majors not attempted: `@hookform/resolvers` 7, `@sentry/react-native` 8,
  `@testing-library/react-native` 14, `typescript` 7.
- `react-native-unistyles` 3.8.x stays blocked by the `<3.8.0` cap (it peers on RN ≥0.85, see e856dfa).

### `expo install --check` mismatches (report only)
- `react-native-worklets` is at 0.8.3, but SDK 55 expects 0.7.4. reanimated 4.2.1 accepts `>=0.7.0`.
  A downgrade changes a native module, and that can only be verified with a dev-client
  build on a device, which this session cannot do. Worth checking during the SDK upgrade, or in a
  session that can run `npm run ios`/`android`.
- `jest` 30 / `@types/jest` 30, where SDK 55 expects 29. This is deliberate (CLAUDE.md: Jest 30, `--testPathPatterns`).

## Unused (depcheck)
These are the same false positives as on 10-31: `expo-font`, `expo-web-browser` (app.json plugins),
`react-native-worklets` (reanimated peer), `expo-system-ui` (Android `userInterfaceStyle`),
and dev `@types/jest`, `jest-environment-jsdom`, `react-test-renderer`, `typescript`.
depcheck's "missing" `@babel/core` and `semver` are fixed by f8e9f9d.

## Abandoned
None. The direct dependency with the oldest last publish is `react-native-mmkv`, on 2026-06-22.
