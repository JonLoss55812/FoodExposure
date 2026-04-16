## Current State

TongueTutor v1.0.0 is feature-complete with 130+ tests passing and working tree clean. Recent commits added performance fixes (N+1 query elimination, typed selectors), hardening (input validation, SafeAreaView, loading states, error handling), and removed GitHub Actions workflows. Backend integration (Convex + Drizzle) is scaffolded but not yet wired to the UI.

## Next Step

Verify the test suite passes without errors, run the app on iOS simulator to confirm it boots cleanly, then wire the Convex backend to replace the local-only storage — starting with the simplest endpoint (fetchChildren or addFood).

## Instructions

1. **Verify the test suite:**
   ```bash
   cd /sessions/affectionate-busy-darwin/mnt/Git/FoodExposure
   bun test 2>&1 | tee test-results.txt
   # Should show: 130+ passing, 6 suites, no failures
   ```
   If any tests fail, read the output and identify the issue (likely import/type error from recent refactoring).

2. **Run the app on iOS simulator:**
   ```bash
   bun ios
   # App should launch in simulator, Expo Go loads, shows bottom tab navigation
   # Try navigating: Foods tab → Progress tab → Log tab → Settings tab
   # Try adding a child in onboarding if first launch
   # Verify no console errors in the terminal
   ```

3. **Inspect Convex setup:**
   - Read `convex/schema.ts` to see ORM model definitions
   - Check if any functions are already implemented in `convex/` directory
   - Verify `NEXT_PUBLIC_CONVEX_URL` is set in `.env` (should be populated from app.json)

4. **Pick one small endpoint to wire:**
   - Option A: `fetchChildren` — Read list of children from Convex
   - Option B: `addFood` — Save new food to Convex
   - Option C: `logFood` — Save a food log entry to Convex
   Pick whichever seems simplest (likely `fetchChildren`).

5. **Implement the Convex function:**
   ```bash
   # Edit convex/functions.ts to add (example):
   export async function fetchChildren(args: { userId: string }) {
     // Query children table, return typed response
   }
   ```

6. **Update the hook to use Convex instead of local storage:**
   - Locate `src/hooks/useChild.ts` or similar
   - Replace SQLite query with Convex call using React Query
   - Test in the app to verify data flows correctly

7. **Commit the Convex wire-up:**
   ```bash
   git add convex/ src/hooks/
   git commit -m "feat: wire $ENDPOINT endpoint to Convex backend — replace local-only storage"
   git push origin main
   ```

8. **Update NEXT_STEPS.md** to point to the next endpoint.

## Done When

- All tests pass (130+)
- App boots cleanly on iOS simulator with no console errors
- One Convex endpoint is wired and working (e.g., fetchChildren returns live data)
- Changes are committed and pushed
- NEXT_STEPS.md is updated with the next endpoint to wire

## Do Not

- Break existing tests when wiring Convex
- Remove local SQLite storage yet (keep both as a fallback during transition)
- Deploy to App Store / Play Store until all endpoints are wired
- Change the app.json or eas.json without understanding the EAS build pipeline

## Testing Notes

If a test fails:
1. Run it individually: `bun test -- tests/hooks/useChild.test.ts`
2. Read the error message carefully (likely a mock or type mismatch)
3. Check if it's a regression from recent changes or a new failure
4. Fix and re-run the suite
