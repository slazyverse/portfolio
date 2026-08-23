/**
 * Motion constants, shared so easing and duration cannot drift between the
 * CSS layer and the JavaScript layer.
 *
 * Principle from Phase 2: instrument easing, not toy easing. No overshoot, no
 * bounce, no elastic — these curves decelerate and stop.
 */

export const EASE = {
  /** Entrances. Fast start, long settle. */
  out: [0.16, 1, 0.3, 1] as const,
  /** Transforms that begin and end at rest. */
  inOut: [0.65, 0, 0.35, 1] as const,
  /** UI state changes. */
  precise: [0.4, 0, 0.2, 1] as const,
};

export const DURATION = {
  fast: 160,
  base: 320,
  slow: 640,
  cinematic: 1200,
} as const;

/** Reveals stagger at this interval. */
export const STAGGER_MS = 40;

/**
 * Single source of truth for the reduced-motion question.
 *
 * Read at call time rather than cached: a visitor can change the OS setting
 * while the page is open, and the site should honour it without a reload.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Subscribe to changes in the reduced-motion preference. */
export function onReducedMotionChange(cb: (reduced: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  const handler = (e: MediaQueryListEvent) => cb(e.matches);
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}

/** Clamp helper used by the scrubbed sequences. */
export function clamp(v: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, v));
}
