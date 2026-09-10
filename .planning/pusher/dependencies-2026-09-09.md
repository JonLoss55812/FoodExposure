# Dependency & Supply-Chain Audit — TongueTutor (FoodExposure)

**Date:** 2026-09-09
**Branch:** `pusher/work-1789002003`
**Baseline:** 750 tests / 41 suites passing, `tsc --noEmit` clean
**After changes:** 750 tests / 41 suites passing, `tsc --noEmit` clean (no regression)

---

## Summary

| | Before | After |
|---|---|---|
| Total packages installed | 1404 | 1384 |
| **Production** packages | **983** | **926** |
| `npm audit` total | 30 (25 mod / 5 high) | 30 (25 mod / 5 high) |
| `npm audit --omit=dev` | 25 (20 mod / 5 high) | **20 (15 mod / 5 high)** |

One commit shipped (`chore(deps)`, v0.5.165). **No dependency version was upgraded**,
and that is the correct outcome here rather than a failure to act: every one of the 30
advisories either has no patched version published, or its only "fix" is a major
*downgrade* of a framework package. Details in §3.

---

## 1. What changed (shipped, verified)

Moved out of `dependencies` → `devDependencies`:

| Package | Why it is test-only |
|---|---|
| `@jest/globals` | Imported nowhere. The suite uses jest's injected globals. |
| `@testing-library/dom` | Peer dependency of `@testing-library/react`. Never imported directly. |
| `jest-environment-jsdom` | The separate-package jsdom environment jest 28+ requires; resolved by the `jest-expo/web` preset in `jest.config.js`. |

Removed outright:

| Package | Why |
|---|---|
| `@types/uuid@^11.0.0` | npm deprecates it on every install: *"This is a stub types definition. uuid provides its own type definitions."* `uuid@13` ships `.d.ts`. The clean `tsc --noEmit` after removal is the proof. |
| `ts-jest@^29.4.6` | Referenced by no config. `jest.config.js` uses `preset: 'jest-expo/web'`, which transforms via babel-jest / `babel-preset-expo`. |

**Impact:** `npm install --omit=dev` (CI, any downstream consumer, any container image
built with `--production`) was pulling the whole jsdom + testing-library tree into the
shipped graph. That is 57 packages of attack surface that no runtime code path can reach.

**Verification:** wiped `node_modules` + `package-lock.json`, `npm install` → exit 0,
`npm run test` → 750/41 pass, `npx tsc --noEmit` → clean.

---

## 2. Structural finding: the lockfile is not committed

`.gitignore` excludes `package-lock.json`; only `bun.lock` is tracked.

**Consequence:** npm dependency resolution *floats on every install*. Two developers, or
CI and a developer, can resolve different transitive trees from the same commit. It also
means `npm audit fix` is a no-op as a durable remediation — it writes to a file that is
never committed, so any pin it produces evaporates on the next fresh checkout.

The only durable, tracked remediation lever for npm consumers of this repo is an
`overrides` block in `package.json`. That matters for §3: it is why I evaluated overrides
rather than `npm audit fix`.

> **Recommendation (not actioned — needs a human call on the bun-vs-npm story):** either
> commit `package-lock.json`, or accept that npm installs are unpinned and treat `bun.lock`
> as the single source of truth. Right now the repo is half-way between the two, and
> `CLAUDE.md` already documents npm as a supported fallback path.

Note also that `bun.lock` is now stale by five lines relative to `package.json`. This
matches the deliberate v0.5.143 precedent (Bun is not installed in this environment to
regenerate it faithfully); `bun install` re-resolves the delta.

---

## 3. Vulnerabilities: why none were patched

`npm audit fix` (non-`--force`) was run as a dry-run and fixes **zero** of the 30 — it
adds packages but the count stays at 30. `npm audit fix --force` proposes downgrading
`expo` 55 → 46, `expo-router` → 5.1.11, `jest-expo` → 57, and `drizzle-kit` 0.31 → 0.18.
Those are catastrophic downgrades dressed up as fixes; they were rejected.

All 30 advisories collapse into **six root causes**:

### 3.1 `image-size` — HIGH — no fix exists
- Advisories [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr), [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq) (DoS via infinite loop in ICNS / JXL / HEIF parsers)
- Vulnerable range `<=2.0.2`. **Latest published version is 2.0.2** (2025-04-02). There is
  no patched release. An override is impossible.
- Accounts for **all 5 HIGH** findings, which cascade as
  `image-size → metro → metro-config / metro-transform-worker → @react-native/metro-config`.
- **Reachability: none at runtime.** Path is
  `react-native-worklets → @react-native/metro-config → metro-config → metro → image-size`.
  This is the *bundler*, and it is a second, duplicate metro tree (0.87.0) alongside the
  app's actual metro (55.1.2, from expo). A malicious image would have to be fed to the
  dev bundler at build time. It never touches a user's device.

### 3.2 `@react-navigation/native` — MODERATE — no fix exists
- Vulnerable range `<=7.3.18`. **Installed 7.3.18 is the latest published version.**
- `npm audit` reports `fixAvailable: true` here, which is misleading — there is no higher
  version to move to. Accounts for 5 findings (`native`, `core`, `elements`,
  `bottom-tabs`, `native-stack`), pulled in by both `expo-router` and `posthog-react-native`.
- Upstream-controlled. Track and re-audit.

### 3.3 `decode-uri-component` — MODERATE — fix exists but is not applicable
- [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) — DoS via exponential decoding of malformed percent-encoded input.
- Vulnerable `<=0.4.2`; installed 0.2.2; **fixed in 0.5.0** (2026-06-29).
- **This is the one advisory genuinely reachable from user-controlled input** — the path is
  `@react-navigation/core → query-string@7.1.3 → decode-uri-component`, i.e. deep-link /
  URL query parsing.
- **Why an override was rejected:** `decode-uri-component@0.5.0` is **ESM-only**
  (`"type": "module"`, `exports` with no CJS entry). Its only consumer here,
  `query-string@7.1.3`, is CommonJS and `require()`s it. Forcing the override trades a
  moderate DoS for a hard module-resolution failure at runtime — and the test suite mocks
  `expo-router`, so it would *not* have caught the break. Shipping an unverifiable
  override would have violated the "never commit a change you have not run" rule.
- **Real-world exposure is low:** this is an offline-first app with no deep-link handler
  wired up (`expo-linking` is not imported anywhere in `app/` or `src/`). The attacker
  would need to get the user to open a crafted deep link, and the payoff is a hang.
- **Correct fix is upstream:** `query-string@9.5.1` (2026-09-01) has moved on. It lands
  when `@react-navigation/core` bumps its `query-string` dependency.

### 3.4 `esbuild` in `@esbuild-kit/*` — MODERATE — dev-only, abandoned intermediary
- [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) — dev server accepts cross-origin requests.
- Path: `drizzle-kit → @esbuild-kit/esm-loader → @esbuild-kit/core-utils → esbuild@0.18.20`.
- `drizzle-kit@0.31.10` **is already the latest**, and it still ships these two packages,
  both of which are **DEPRECATED and last published 2023-09-17** ("Merged into tsx").
- **Reachability: none.** `drizzle-kit` is dev tooling for generating migrations, is
  invoked by no npm script in this repo, and the vulnerable esbuild dev-server is never
  started. An override to `esbuild@^0.25` was considered and rejected: it crosses seven
  minor versions of a Go-binary-backed tool against a pinned `~0.18` consumer, with no way
  to verify it here (nothing in the test suite exercises `drizzle-kit`).

### 3.5 `uuid@7.0.3` via `xcode` — MODERATE
- [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) — missing buffer bounds check in v3/v5/v6 when `buf` is supplied.
- Path: `expo → @expo/config-plugins → xcode → uuid@7.0.3`. Fixed in `uuid >= 11.1.1`.
- **Build-time only** — `xcode` is used by Expo prebuild to write the native project. `/ios`
  and `/android` are gitignored and builds run through EAS.
- An override to `uuid@^11.1.1` is *technically* available but crosses four majors against
  a consumer pinned to `^7`, and cannot be verified without running a prebuild. Deliberately
  not taken for a moderate, non-runtime, bounds-check-only issue.
- **`xcode@3.0.1` was last published 2020-05-19 — over six years ago. This is an abandoned
  package** sitting in the Expo build chain. Nothing this project can do about it; noted
  for awareness.

### 3.6 `@expo/config-plugins` / `@expo/config` / `@expo/cli` cluster — MODERATE
- These are all "depends on a vulnerable version of…" propagation from 3.5 above, not
  independent defects. They resolve when `xcode`'s `uuid` resolves.

---

## 4. Abandoned / deprecated packages in the tree

| Package | Last publish | Status | Reachable at runtime? |
|---|---|---|---|
| `@esbuild-kit/core-utils` | 2023-09-17 | **Deprecated** (merged into tsx) | No — `drizzle-kit` dev tooling |
| `@esbuild-kit/esm-loader` | 2023-09-17 | **Deprecated** | No — same |
| `xcode` | **2020-05-19** | Unmaintained, 6+ years | No — Expo prebuild only |
| `@types/uuid` | — | Deprecated stub | **Removed this session** |
| `inflight` | — | Deprecated, leaks memory | No — transitive under old `glob` |
| `glob@7.2.3` (×5) | — | Deprecated | No — build tooling |
| `abab`, `domexception`, `whatwg-encoding` | — | Deprecated | No — jsdom, now dev-only |

None of the abandoned packages are on a runtime code path. All of them arrive transitively
via Expo / metro / drizzle-kit build tooling and are not directly removable by this project.

---

## 5. Unused dependencies still declared (report-only)

Searched `app/`, `src/`, `convex/`, `index.ts`, and all config files for each.

**Removed this session:** `@types/uuid`, `ts-jest`.

**Kept despite having no import — deliberate:**

| Package | Reason to keep |
|---|---|
| `@testing-library/react-native` | Documented decision in v0.5.143 — retained for the screen-render harness work. |
| `react-test-renderer` | Pinned to `19.2.0` in v0.5.143 specifically to resolve a peer-dep conflict. Removing it re-opens that. |
| `@testing-library/jest-dom` | Matcher package; low cost, plausibly wanted by the screen suites. |

**Unused-by-import but likely required implicitly — NOT removed, cannot verify here:**

`expo-linking`, `expo-constants`, `expo-crypto`, `expo-system-ui`, `@expo/metro-runtime`.

These are standard Expo Router / Expo template dependencies that the framework resolves at
runtime or build time without an explicit import (`expo-constants` and `expo-linking` in
particular are used internally by `expo-router`). Verifying their removal needs an actual
`expo start` / EAS build, which is not runnable in this environment. **Removing them on a
grep result alone would be exactly the speculative change this task warns against.**

> **Suggested follow-up for a session with a device/simulator:** try dropping
> `expo-crypto` and `expo-system-ui` (the two least likely to be framework-internal) and
> confirm with `bun ios` that the app still boots.

---

## 6. Bottom line

- The single actionable supply-chain win available here was the production/dev split, and
  it is shipped and verified: **57 packages out of the production graph, 5 advisories out
  of the production audit scope, zero test or typecheck regression.**
- **The 30 remaining advisories are not fixable at this project's layer.** Three of the six
  root causes have no patched version published anywhere; the other three are build-time
  tooling with no runtime reachability. This is a genuine ceiling, not unfinished work.
- The one advisory with real user-input reachability (`decode-uri-component`) has a patched
  release that is ESM-only and therefore incompatible with its CommonJS consumer. It is
  documented rather than force-fixed.
- The most valuable *non-vulnerability* finding is §2: **`package-lock.json` is gitignored**,
  so npm dependency resolution is unpinned across checkouts. That is a bigger long-term
  supply-chain risk than any single moderate advisory in this report, and it needs a human
  decision rather than a unilateral change.
