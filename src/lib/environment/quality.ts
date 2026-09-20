import { QUALITY, type QualityTier } from "@/lib/capability";

/**
 * What the environment is allowed to spend at each quality tier.
 *
 * This extends the Phase 2 tier contract rather than replacing it. `QUALITY`
 * still decides the questions that are not specific to the city — may WebGL
 * mount at all, what the DPR ceiling is, whether glow is affordable — and this
 * file answers only "how much city".
 *
 * Deliberately not a second quality system. There is one tier per device and
 * it is named in one place; a component that wanted its own idea of "high"
 * would be free to disagree with the renderer about what machine it is on.
 */
export interface EnvironmentBudget {
  /**
   * Structures across the whole city, distributed between levels by each
   * level's authored share.
   *
   * City-wide rather than per level, for the same reason the light budget is:
   * a flat per-level count spends the same on a server hall, where density is
   * the entire look, as on an industrial floor that is meant to be sparse.
   * The cap that matters for performance is the total, and the total is what
   * this names.
   */
  structures: number;
  /** Ceiling on lit cells across the whole city. */
  maxLights: number;
  /** Rain particles. Zero disables rain entirely rather than drawing nothing. */
  rain: number;
  /** Conduit runs per level. */
  conduitsPerLevel: number;
  /**
   * A renderer hint, not a generation setting: may lit cells on levels far
   * from the camera keep being drawn?
   *
   * Deliberately not applied during generation. Which levels are distant
   * depends on where the reader currently is, and baking it into the model
   * would permanently darken the deep levels on a mid-range machine — letting
   * the device's speed decide what the city *contains* rather than how much of
   * it is drawn at once.
   */
  lightsOnDistantLevels: boolean;
  /** Renderer antialiasing. Off everywhere: fill rate is the constraint. */
  antialias: boolean;
}

export const ENVIRONMENT_BUDGET: Record<QualityTier, EnvironmentBudget> = {
  high: {
    structures: 260,
    /**
     * Raised from 1600 after looking at the result on screen.
     *
     * Worth stating plainly, because "the budget was raised to fit the
     * feature" is usually the wrong move: this is not one of the committed
     * budgets. Initial JS, lazy WebGL and CSS are fixed contracts and none of
     * them move. This is an internal render parameter, and the cost of the
     * change is one number: lit cells are instanced quads sharing a single
     * draw call, so 3200 rather than 1600 adds about 3200 triangles and
     * roughly 200 KB of instance matrices, changes no draw call, and adds no
     * bytes to any bundle. At 1600 a facade held too few cells to read as a
     * facade at all.
     */
    maxLights: 3200,
    rain: 1400,
    conduitsPerLevel: 7,
    lightsOnDistantLevels: true,
    antialias: false,
  },
  balanced: {
    structures: 140,
    maxLights: 1100,
    rain: 0,
    conduitsPerLevel: 4,
    lightsOnDistantLevels: false,
    antialias: false,
  },
  /**
   * LOW never reaches the WebGL renderer — `QUALITY.low.webgl` is false, so the
   * three.js chunk is not even fetched. These numbers exist because the
   * generator still runs for the `/system` laboratory and for the Canvas
   * fallback, both of which read the same model.
   */
  low: {
    structures: 60,
    maxLights: 0,
    rain: 0,
    conduitsPerLevel: 2,
    lightsOnDistantLevels: false,
    antialias: false,
  },
};

/**
 * How the environment will actually be drawn, once device facts are known.
 *
 *   webgl   the procedural city
 *   canvas  a 2D atmospheric reduction of the same model
 *   css     gradients and haze; no per-frame JS at all
 *   none    nothing renders
 *
 * `none` is a real, reachable state and not a theoretical one. It is what a
 * WebGL context loss falls back to if even the 2D context is unavailable, and
 * what the environment is switched to when it must get out of the way. The
 * portfolio is required to be complete in that state, which is why no content
 * ever lives in here.
 */
export type EnvironmentMode = "webgl" | "canvas" | "css" | "none";

export interface EnvironmentConditions {
  tier: QualityTier;
  /** Does this device have a usable WebGL context? */
  webgl: boolean;
  /** Is a 2D canvas context available? */
  canvas2d: boolean;
  /** Has the environment been disabled — by context loss, or deliberately? */
  disabled?: boolean;
}

/**
 * Resolves device facts into a rendering strategy.
 *
 * A pure function on purpose. This is the single most important branch in the
 * environment and it is exactly the kind of logic that rots when it is spread
 * across three `useEffect`s — so it is one function, with one table of
 * outcomes, and it is tested directly.
 *
 * Reduced motion is deliberately *not* an input. It decides whether the city
 * moves, never whether it exists. Someone who asked for less motion asked for
 * less motion; answering by removing the environment entirely would be
 * substituting our preference for their instruction.
 */
export function resolveEnvironmentMode(c: EnvironmentConditions): EnvironmentMode {
  if (c.disabled) return "none";
  if (QUALITY[c.tier].webgl && c.webgl) return "webgl";
  // A desktop without WebGL still has the headroom for a 2D atmosphere. A LOW
  // device does not, and gets CSS — which costs no JavaScript per frame at all.
  if (c.canvas2d && c.tier !== "low") return "canvas";
  return "css";
}

/** The generation budget for a tier. */
export function environmentBudget(tier: QualityTier): EnvironmentBudget {
  return ENVIRONMENT_BUDGET[tier];
}
