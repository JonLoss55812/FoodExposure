/**
 * A synchronous single-entry latch for guarding async handlers against
 * re-entry (double-tap, double-fire).
 *
 * Why this exists rather than a `useState` boolean: the established guard in
 * this codebase is `const [saving, setSaving] = useState(false)` plus an
 * `if (saving) return;` at the top of the handler. That check reads the value
 * captured in the *current render's* closure. `setSaving(true)` does not
 * mutate that closure — it schedules a re-render. Two taps dispatched in the
 * same event batch (a fast double-tap, or React Native's known double-fire on
 * a slow frame) therefore both observe `saving === false` and both proceed.
 * The `disabled` prop on the button has the same lag: the Pressable only
 * becomes disabled once the re-render commits.
 *
 * A latch held in a `useRef` is mutated synchronously, so the second caller in
 * the same tick sees the held state and bails. Hold it as:
 *
 *   const submitLatch = useRef(createInFlightLatch()).current;
 *   ...
 *   if (!submitLatch.tryAcquire()) return;
 *   try { ...writes... } finally { submitLatch.release(); }
 */
export interface InFlightLatch {
  /** True while the latch is held. */
  readonly busy: boolean;
  /** Takes the latch and returns true, or returns false if already held. */
  tryAcquire(): boolean;
  /** Releases the latch. Safe to call when not held. */
  release(): void;
}

export function createInFlightLatch(): InFlightLatch {
  let held = false;
  return {
    get busy() {
      return held;
    },
    tryAcquire() {
      if (held) return false;
      held = true;
      return true;
    },
    release() {
      held = false;
    },
  };
}
