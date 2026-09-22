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

  /* --- fidelity ---------------------------------------------------------
     Tiers are defined by visual fidelity, not merely object count. These are
     the controls that decide what the world looks like rather than how much
     of it there is. */

  /**
   * Within this distance of the camera a building gets the full kit — fins,
   * pipes, signage, a populated roof.
   */
  nearRadius: number;
  /** Beyond `nearRadius` and within this, a mass and a roofline. */
  midRadius: number;
  /** Distant impostor silhouettes per level. Zero leaves an empty horizon. */
  skyline: number;
  /**
   * Edge length of each generated facade texture.
   *
   * The single largest GPU memory decision in the environment, and one that
   * is easy to get wrong by an order of magnitude: there are four facade
   * variants, each with an albedo and an emissive map, plus a road and a
   * grime map — ten textures, each costing size² × 4 bytes × 1.33 for
   * mipmaps. At 1024 that is 49 MB. At 512 it is 13 MB.
   *
   * Asserted in `tests/environment-detail.test.ts`, which is where the 49 MB
   * version was caught.
   */
  textureSize: number;
  /**
   * Light pooling on the wet road, and steam off it.
   *
   * What replaced the planar reflection. That was a second full render of the
   * scene every frame; this is one instanced draw call that paints the light
   * a wet street actually shows — colour bleeding down from every sign — and
   * it reads wetter than the blurred mirror did.
   */
  groundFx: boolean;
  /**
   * Vehicles in motion, as GPU-animated light streaks.
   *
   * The cheapest thing in the environment that makes it feel inhabited: two
   * triangles each, one draw call for all of them, and their positions are a
   * function of time rather than anything the CPU keeps.
   */
  traffic: number;
  /** Soft contact shading under every building. */
  contactShade: boolean;
}

export const ENVIRONMENT_BUDGET: Record<QualityTier, EnvironmentBudget> = {
  high: {
    structures: 170,
    /**
     * Accent lights, not windows.
     *
     * This number went up to 3200 when instanced quads *were* the window
     * system, and has come back down now that facades carry a generated
     * texture with its own emissive map. A texture gives a tower hundreds of
     * correlated, blind-drawn, service-floor-interrupted windows for one
     * material; quads gave it a scattering of identical squares for one
     * instance each.
     *
     * What is left for these to do is the work a texture cannot: rack
     * indicators on the substrate, where a 2-metre cabinet has no facade to
     * speak of, and bright accents close to the lens.
     */
    maxLights: 1200,
    rain: 2200,
    conduitsPerLevel: 7,
    lightsOnDistantLevels: true,
    antialias: false,
    // Sized against the world, not picked. The city's buildable band runs
    // from about 66 to 180 metres from the camera, so a near radius of 190
    // classified *every* building as near and the whole detail system did
    // nothing at the tier that can most afford it.
    nearRadius: 105,
    midRadius: 155,
    skyline: 64,
    /**
     * 512, not 1024.
     *
     * Four facade albedos and four emissive maps at 1024 is 43 MB of GPU
     * memory before the road and grime maps, which is not a budget — it is
     * what happens when nobody multiplies it out. At 512 the whole set is
     * about 13 MB, and because the facade *tiles* up a building rather than
     * stretching to fit, a forty-storey tower still shows five tiles of it.
     * The resolution you see is the tile's, multiplied by the repeat.
     */
    textureSize: 512,
    groundFx: true,
    traffic: 340,
    contactShade: true,
  },
  balanced: {
    structures: 110,
    maxLights: 520,
    rain: 900,
    conduitsPerLevel: 4,
    lightsOnDistantLevels: false,
    antialias: false,
    nearRadius: 70,
    midRadius: 120,
    skyline: 38,
    textureSize: 384,
    groundFx: false,
    traffic: 150,
    // Kept at BALANCED: it is one instanced draw call and it is most of what
    // makes a building look like it is standing on the ground.
    contactShade: true,
  },
  /**
   * LOW never reaches the WebGL renderer — `QUALITY.low.webgl` is false, so the
   * three.js chunk is not even fetched. These numbers exist because the
   * generator still runs for the `/system` laboratory and for the Canvas
   * fallback, both of which read the same model.
   */
  low: {
    structures: 54,
    maxLights: 0,
    rain: 0,
    conduitsPerLevel: 2,
    lightsOnDistantLevels: false,
    antialias: false,
    nearRadius: 0,
    midRadius: 90,
    skyline: 20,
    textureSize: 256,
    groundFx: false,
    traffic: 0,
    contactShade: false,
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
