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
