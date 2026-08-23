"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type MotionMode = "full" | "reduced";

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
 * The OS preference is the default and is always honoured on first visit — a
 * visitor who asked their system for reduced motion gets a still page without
 * doing anything. But it is a *default*, not a verdict: plenty of machines
 * report `prefers-reduced-motion: reduce` because the whole desktop was tuned
 * for performance, not because the person is motion-sensitive. Windows'
 * "Adjust for best performance" does exactly that, and Chrome reports it as a
 * reduced-motion request.
 *
 * So the visitor can override it either way, and the choice is remembered.
 * `data-motion` on the document element is the single source of truth — CSS
 * keys off the attribute rather than the media query, so both layers can never
 * disagree.
 *
 * Scope note: this governs entrance reveals, the scrubbed sequences and the
 * hero simulation. Scrolling itself is always native — the site does not
 * intercept it.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<MotionMode>("reduced");
  const [systemReduced, setSystemReduced] = useState(false);
  const [overridden, setOverridden] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stored = window.localStorage.getItem("motion");
    const hasOverride = stored === "full" || stored === "reduced";

    setSystemReduced(mq.matches);
    setOverridden(hasOverride);

    const resolved: MotionMode = hasOverride
      ? (stored as MotionMode)
      : mq.matches
        ? "reduced"
        : "full";

    setMode(resolved);
    document.documentElement.dataset.motion = resolved;

    // Follow the OS if the visitor has not made a choice of their own.
    const onChange = (e: MediaQueryListEvent) => {
      setSystemReduced(e.matches);
      if (window.localStorage.getItem("motion")) return;
      const next: MotionMode = e.matches ? "reduced" : "full";
      setMode(next);
      document.documentElement.dataset.motion = next;
    };

    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const toggle = useCallback(() => {
    setMode((current) => {
      const next: MotionMode = current === "full" ? "reduced" : "full";
      document.documentElement.dataset.motion = next;
      window.localStorage.setItem("motion", next);
      setOverridden(true);
      return next;
    });
  }, []);

  return (
    <MotionContext.Provider value={{ mode, systemReduced, overridden, toggle }}>
      {children}
    </MotionContext.Provider>
  );
}
