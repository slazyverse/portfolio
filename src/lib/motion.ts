/**
 * SUBSTRATE — motion primitives.
 *
 * One source of truth for easing and duration, so the CSS layer and the
 * JavaScript layer cannot drift apart. The CSS custom properties in
 * `tokens.css` are generated from the same numbers documented here.
 *
 * Principle: instrument easing, not toy easing. No overshoot, no bounce, no
 * elastic. These curves decelerate and stop.
 *
 * Architecture: roughly 85% of motion on this site is CSS. JavaScript is used
 * only where a sequence has to be orchestrated against a discrete event, and
 * then through the native Web Animations API rather than a library.
 */

export const EASE = {
  /** Entrances. Fast start, long settle. */
  out: [0.16, 1, 0.3, 1] as const,
  /** Transforms that begin and end at rest. */
  inOut: [0.65, 0, 0.35, 1] as const,
  /** UI state changes. */
  precise: [0.4, 0, 0.2, 1] as const,
} as const;

/** The same curves as CSS `cubic-bezier()` strings, for the WAAPI helpers. */
export const EASE_CSS = {
  out: `cubic-bezier(${EASE.out.join(",")})`,
  inOut: `cubic-bezier(${EASE.inOut.join(",")})`,
  precise: `cubic-bezier(${EASE.precise.join(",")})`,
} as const;

export const DURATION = {
  /** Hover, focus, a chip changing state. */
  fast: 160,
  /** The default for a discrete UI transition. */
  base: 320,
  /** Panels arriving, sequences settling. */
  slow: 640,
  /** Reserved for level transitions. Rare by design. */
  cinematic: 1200,
} as const;

/** Reveals stagger at this interval. */
export const STAGGER_MS = 40;

/**
 * Replaces the one anime.js call site this project had.
 *
 * That import cost 21.5 KB gzipped in the initial bundle to orchestrate a
 * two-element fade-and-rise. The Web Animations API is native, already
 * hardware-accelerated for opacity and transform, and costs nothing. Its
 * `easing` string takes the same curve the rest of the system uses, so the
 * readout now settles on exactly the same cubic-bezier as every CSS reveal —
 * which the library version only approximated with its own `outExpo`.
 *
 * Callers are responsible for the motion gate; this helper does not consult it,
 * because the components that use it already hold the resolved preference.
 */
export function staggerIn(
  elements: Iterable<Element>,
  options: { duration?: number; stagger?: number; distance?: number } = {},
): Animation[] {
  const {
    duration = 460,
    stagger = 70,
    distance = 8,
  } = options;

  const list = Array.from(elements);
  if (!list.length) return [];

  // `Element.animate` is unavailable in jsdom and in very old engines. Failing
  // silently is correct here: the element is already in its final state in the
  // markup, so skipping the animation loses nothing but the entrance.
  if (typeof list[0]!.animate !== "function") return [];

  return list.map((el, i) =>
    el.animate(
      [
        { opacity: 0, transform: `translate3d(0, ${distance}px, 0)` },
        { opacity: 1, transform: "translate3d(0, 0, 0)" },
      ],
      {
        duration,
        delay: i * stagger,
        easing: EASE_CSS.out,
        fill: "both",
      },
    ),
  );
}

/** Cancels animations started by `staggerIn`, for effect cleanup. */
export function cancelAll(animations: Animation[]): void {
  for (const a of animations) {
    try {
      a.cancel();
    } catch {
      // An already-finished animation throws on some engines; nothing to do.
    }
  }
}

/**
 * Single source of truth for the reduced-motion question.
 *
 * Read at call time rather than cached: a visitor can change the OS setting
 * while the page is open, and the site should honour it without a reload.
 *
 * Prefer `useMotionAllowed()` inside components — it reads `data-motion`, which
 * also carries the visitor's explicit override. This is the lower-level probe.
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
