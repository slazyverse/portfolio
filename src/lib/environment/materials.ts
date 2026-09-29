import type { StratumId } from "@/data/types";

/* ---------------------------------------------------------------------------
 * What the ground is made of.
 *
 * Small, and deliberately here rather than in the component that draws it.
 * Every other decision about the world lives in a module that imports no
 * rendering library and can therefore be asserted in Node; the ground was the
 * exception, and the two mistakes this file exists to prevent were both made
 * in a renderer where nothing could see them:
 *
 *  - a level that is not a street being given a street's surface. The first
 *    pass painted highway markings across all four, so the substrate — a
 *    server hall two hundred metres underground — had a dashed centre line
 *    running through it.
 *  - a road smooth enough to mirror the key light. At 0.34 the specular lobe
 *    blew out a fifth of the frame, and the roughness map added in Phase 11
 *    put that value back within reach in every puddle.
 *
 * Both are one number in a material, both look like a lighting problem, and
 * neither is visible in a diff. So the numbers are named, exported, and
 * asserted.
 * ------------------------------------------------------------------------- */

/**
 * Is this level a street?
 *
 * Only one of the four is. The engine and substrate floors are a worked
 * concrete slab, and the interface level is a deck: lane markings on any of
 * them is the world contradicting itself.
 */
export function isPaved(level: StratumId): boolean {
  return level === "surface";
}

/**
 * The roughness the road material multiplies its map by.
 *
 * 0.62 against a 0.85 base map lands on the 0.52 an earlier pass arrived at
 * by hand, which is the value that has to be preserved: it is the one that
 * fixed the blow-out.
 */
export const ROAD_ROUGHNESS_SCALAR = 0.62;

/**
 * Below this effective roughness, a low directional light reflected off the
 * road produces a single specular lobe bright enough to lose the street in.
 *
 * Measured, twice. Once when the material itself was set to 0.34 and once
 * when the Phase 11 roughness map reached an effective 0.35 in standing
 * water and took blown-out pixels over the road from 0.018 percent of the
 * frame to 0.416.
 */
export const SPECULAR_FLOOR = 0.34;

/**
 * How rough each thing painted onto the road is, as a greyscale value.
 *
 * Read from the green channel, so these are written as the greys they are.
 * Higher is rougher: sealant and fresh patching are coarse, paint and cast
 * iron are smooth, and standing water is the smoothest thing on the surface
 * without being a mirror.
 */
export const ROAD_ROUGHNESS = {
  /** Dry asphalt, and the base the rest is drawn over. */
  asphalt: "#d9d9d9",
  /** Broad dried areas: a road dries from the crown of the camber outward. */
  dry: "#f0f0f0",
  /** Broad damp areas. */
  damp: "#c6c6c6",
  /** Polished by tyres, and the brightest thing on a wet road at night. */
  wheelTrack: "#bcbcbc",
  /** Standing water. */
  water: "#b0b0b0",
  /** The fan of road draining into a gully. */
  dampFan: "#bbbbbb",
  /** The gully grating. */
  grating: "#b6b6b6",
  /** A cast iron access cover. */
  cover: "#c8c8c8",
  /** Sealant in a construction joint: coarser than what it joins. */
  joint: "#ededed",
  /** Fresh patching over a service trench. */
  patch: "#efefef",
  /** A crack, open and full of grit. */
  crack: "#e6e6e6",
  /** Thermoplastic lane marking. */
  laneMarking: "#c4c4c4",
  /** The continuous kerb-side line. */
  kerbMarking: "#cccccc",
} as const;

/** The effective roughness the material ends up with for a painted value. */
export function effectiveRoughness(grey: string): number {
  const v = Number.parseInt(grey.slice(1, 3), 16) / 255;
  return v * ROAD_ROUGHNESS_SCALAR;
}
