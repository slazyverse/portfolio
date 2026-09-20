"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  getServerSnapshot,
  getSnapshot,
  setMotionMode,
  subscribe,
  type MotionMode,
} from "@/lib/motion-store";

export type { MotionMode };

interface MotionContextValue {
  mode: MotionMode;
  /** True when the OS asked for reduced motion, regardless of the override. */
  systemReduced: boolean;
  /** True when the visitor has explicitly chosen, overriding the OS. */
  overridden: boolean;
  toggle: () => void;
}

const MotionContext = createContext<MotionContextValue>({
  mode: "reduced",
  systemReduced: false,
  overridden: false,
  toggle: () => {},
});

export const useMotion = () => useContext(MotionContext);

/** Convenience: the boolean most effects actually want. */
export const useMotionAllowed = () => useContext(MotionContext).mode === "full";

/**
 * Motion preference, as a first-class setting rather than a hard gate.
 *
 * The preference itself lives in `@/lib/motion-store`, because it is genuinely
 * external state: the OS media query and localStorage both change outside
 * React, and another tab can change the second one. Phase 2 moved this from a
 * `useState` filled in by an effect to `useSyncExternalStore`, which removes
 * the cascading render and makes the server/client boundary explicit rather
 * than implicit. The context API is unchanged.
 *
 * `data-motion` on the document element remains the single source of truth for
 * the CSS layer — CSS keys off the attribute rather than the media query, so
 * the two layers can never disagree about what the visitor asked for.
 *
 * Scope note: this governs entrance reveals, the scrubbed sequences and the
 * hero simulation. Scrolling itself is always native — the site does not
 * intercept it.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Mirror the resolved preference onto the document so CSS reads the same
  // value. A DOM write, not React state, so it cannot cascade.
  useEffect(() => {
    document.documentElement.dataset.motion = state.mode;
  }, [state.mode]);

  const toggle = useCallback(() => {
    setMotionMode(getSnapshot().mode === "full" ? "reduced" : "full");
  }, []);

  const value = useMemo<MotionContextValue>(
    () => ({
      mode: state.mode,
      systemReduced: state.systemReduced,
      overridden: state.overridden,
      toggle,
    }),
    [state.mode, state.systemReduced, state.overridden, toggle],
  );

  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}
