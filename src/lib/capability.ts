/**
 * Device capability probes, exposed as external stores.
 *
 * A capability is not React state. It is a fact about the machine that the
 * server cannot know and that never changes once measured, so the correct
 * shape is a store with a permanent snapshot and a subscription that never
 * fires — not a `useState` that an effect fills in after mount.
 *
 * This is also where the quality-tier contract lives. Phase 2 defines the
 * contract only; Phase 5 is where the environment layer consumes it. Building
 * the detection heuristics now would be guessing ahead of the thing that needs
 * them.
 */

/** Subscriptions that can never change. Kept for the store signature. */
const noopSubscribe = (): (() => void) => () => {};

/* ------------------------------------------------------------------ WebGL --- */

let webglCache: boolean | null = null;

function probeWebgl(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext("webgl2") || c.getContext("webgl"))
    );
  } catch {
    return false;
  }
}

export const webglStore = {
  subscribe: noopSubscribe,
  getSnapshot(): boolean {
    webglCache ??= probeWebgl();
    return webglCache;
  },
  /**
   * False on the server. The WebGL scene is `ssr: false` anyway, so the first
   * client render matching the server render costs nothing and avoids a
   * hydration mismatch.
   */
  getServerSnapshot(): boolean {
    return false;
  },
};

/* --------------------------------------------------------------- Canvas --- */

let canvas2dCache: boolean | null = null;

function probeCanvas2d(): boolean {
  try {
    return !!document.createElement("canvas").getContext("2d");
  } catch {
    return false;
  }
}

/**
 * A 2D context, which the environment falls back to when WebGL is unavailable.
 *
 * Almost always true, and probed anyway rather than assumed: it is false under
 * some hardened browser configurations and canvas-blocking extensions, and the
 * whole point of a fallback chain is that each link is verified rather than
 * hoped for. The CSS layer below it needs no probe at all.
 */
export const canvas2dStore = {
  subscribe: noopSubscribe,
  getSnapshot(): boolean {
    canvas2dCache ??= probeCanvas2d();
    return canvas2dCache;
  },
  getServerSnapshot(): boolean {
    return false;
  },
};

/* ---------------------------------------------------------- Quality tiers --- */

/**
 * What each tier is allowed to spend, as a contract rather than a suggestion.
 *
 *   HIGH      the full WebGL environment, atmospheric depth, controlled glow
 *   BALANCED  WebGL at reduced complexity, fewer effects, capped DPR
 *   LOW       CSS and Canvas atmosphere only; no WebGL dependency is loaded
 *
 * Reduced motion is orthogonal, not a fourth tier: it removes decorative
 * movement at any tier, and is resolved through `data-motion`.
 */
export type QualityTier = "high" | "balanced" | "low";

export interface QualityBudget {
  /** May the persistent WebGL environment mount at all? */
  webgl: boolean;
  /** Ceiling for the renderer's device pixel ratio. */
  maxDpr: number;
  /** Atmospheric layers: scanline, vignette, grain. */
  atmosphere: boolean;
  /** Per-element glow. Cheap in CSS, expensive when stacked. */
  glow: boolean;
}

export const QUALITY: Record<QualityTier, QualityBudget> = {
  high: { webgl: true, maxDpr: 1.5, atmosphere: true, glow: true },
  balanced: { webgl: true, maxDpr: 1, atmosphere: true, glow: false },
  low: { webgl: false, maxDpr: 1, atmosphere: false, glow: false },
};

/**
 * The default tier for a device, from signals that are cheap and honest.
 *
 * Deliberately conservative and deliberately simple. Phase 5 can refine this
 * against measured frame times on real hardware; inventing a more elaborate
 * heuristic now, before anything consumes it, would be building on a guess.
 */
export function detectQualityTier(): QualityTier {
  if (typeof window === "undefined") return "low";

  // A coarse pointer is a phone or a tablet. Mobile defaults away from WebGL
  // until Phase 11 has measured the thermal cost on real mid-range hardware.
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (coarse) return "low";

  const cores = navigator.hardwareConcurrency ?? 2;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;

  // The site's performance shape was set on a 2015 dual-core with integrated
  // graphics. That machine should get a working page, not the full environment.
  if (cores <= 2 || memory <= 2) return "low";
  if (cores <= 4 || memory <= 4) return "balanced";
  return "high";
}

let tierCache: QualityTier | null = null;

/**
 * The resolved tier, as a store.
 *
 * The same shape as the WebGL and canvas probes, and for the same reason: this
 * is a fact about the machine, measured once, that React cannot know while
 * rendering on the server. A store with a server snapshot is how that is
 * expressed — `useState` filled in by an effect would be a second render
 * triggered by a value that was never going to change.
 *
 * The server snapshot is `low` deliberately. It is the cheapest tier, so the
 * hydrating markup is the one that asks least of the device, and anything
 * richer is an upgrade applied after hydration rather than a downgrade
 * retracted during it.
 */
export const qualityTierStore = {
  subscribe: noopSubscribe,
  getSnapshot(): QualityTier {
    tierCache ??= detectQualityTier();
    return tierCache;
  },
  getServerSnapshot(): QualityTier {
    return "low";
  },
};
