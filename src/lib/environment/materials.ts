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

/* ------------------------------------------------------------------ floors --- */

/**
 * Which generated floor a level stands on.
 *
 * Three answers, not two. The surface is a street; the engine deck and the
 * substrate slab are both concrete and both wrong to draw the same way, which
 * is what sharing one grime map did to them for six phases.
 */
export type FloorKind = "road" | "engine" | "substrate";

export function floorFor(level: StratumId): FloorKind {
  if (level === "surface") return "road";
  if (level === "substrate") return "substrate";
  // The interface level is a deck over the engine rather than a floor of its
  // own: it reads as the same industrial surface, one storey up.
  return "engine";
}

/** The roughness the deep-floor materials multiply their maps by. */
export const FLOOR_ROUGHNESS_SCALAR = 0.92;

/**
 * How rough each thing painted onto the deep floors is.
 *
 * Higher is rougher. The engine deck and the substrate slab share this table
 * because they share a vocabulary — both are concrete with steel let into it
 * — and differ in which entries they use and how much grime goes on top.
 *
 * The ordering is the content. Oil and standing water are the smoothest
 * things down here and the only places a highlight should form; spalled
 * concrete and efflorescence are the roughest, because both are a surface
 * that has lost its face.
 */
export const FLOOR_ROUGHNESS = {
  /** Painted steel deck, kept in service. */
  deck: "#cfcfcf",
  /** Sixty-year-old pour, never resurfaced. */
  oldConcrete: "#e4e4e4",
  /** Broad dried areas. */
  dry: "#efefef",
  /** A construction joint between bays. */
  joint: "#f2f2f2",
  /** Open grating over the services. */
  grate: "#c6c6c6",
  /** Bare structural steel. */
  steel: "#bdbdbd",
  /** Walkway marking. Thermoplastic, smoother than the deck. */
  paint: "#c4c4c4",
  /** Oil under a machine. The smoothest thing on either floor. */
  oil: "#b2b2b2",
  /** Deck scuffed by something that swings. */
  scuff: "#c9c9c9",
  /** The damp margin either side of a drainage channel. */
  damp: "#c0c0c0",
  /** Standing water in the channel itself. */
  water: "#b4b4b4",
  /** Concrete that has lost its face, aggregate showing. */
  spall: "#fbfbfb",
  /** Efflorescence: salt carried out of the slab and left on top. */
  salt: "#f8f8f8",
  /** A patch of a different mix. */
  repair: "#eaeaea",
} as const;

/* ------------------------------------------------------- wetness by material --- */

/**
 * What being wet does to each kind of surface.
 *
 * Water does not make everything shiny. It fills the pores of whatever it
 * lands on, and how much difference that makes depends entirely on how porous
 * the surface was: a sheet of glass is already smooth and barely changes, and
 * a concrete slab soaks the water in and mostly just goes darker.
 *
 * So this is an ordering rather than a set of levels, and the ordering is the
 * thing worth asserting:
 *
 *   glass      smoothest. Already a mirror dry; wet only removes the dust.
 *   steel      directional. A thin film on a flat metal face gives one hard
 *              highlight rather than a broad one.
 *   painted    a sheen rather than a reflection. Paint is smooth, its
 *              substrate is not.
 *   asphalt    broad and soft. The roughest thing that still reflects, which
 *              is why a wet road reads as light smeared down it rather than
 *              as a mirror of the building above.
 *   concrete   roughest. Wet concrete is dark concrete; it does not shine.
 *
 * Metalness runs on its own axis: steel is a conductor and concrete is not,
 * and no amount of water changes that.
 */
export interface WetResponse {
  /** Effective roughness of this material when wet. */
  roughness: number;
  /** How much of its reflection is tinted by the material rather than white. */
  metalness: number;
}

export const WET_RESPONSE: Record<
  "glass" | "steel" | "painted" | "asphalt" | "concrete",
  WetResponse
> = {
  glass: { roughness: 0.22, metalness: 0.08 },
  steel: { roughness: 0.4, metalness: 0.72 },
  painted: { roughness: 0.52, metalness: 0.38 },
  asphalt: { roughness: 0.62, metalness: 0.34 },
  concrete: { roughness: 0.84, metalness: 0.1 },
};

/** The order those five sit in, roughest last. Asserted rather than assumed. */
export const WET_ORDER = ["glass", "steel", "painted", "asphalt", "concrete"] as const;

/**
 * The base colour of each floor, before anything is painted on it.
 *
 * Deeper is darker, and that ordering is the assertion. It is also the
 * ordering that was lost for six phases: the two deep levels shared one map
 * tinted by a single near-black token, so "deeper" was carried entirely by
 * the light rig and the floors themselves said nothing.
 *
 * Reflectance, not a background colour — concrete returns something like a
 * fifth of the light that hits it even when it is filthy, and the night comes
 * from the lighting rather than from a pre-darkened texture.
 */
export const FLOOR_ALBEDO: Record<FloorKind, string> = {
  road: "#2b3038",
  engine: "#39404a",
  substrate: "#262c34",
};

/** Relative luminance of a hex colour, for ordering assertions. */
export function luminance(hex: string): number {
  const v = (i: number) => Number.parseInt(hex.slice(i, i + 2), 16) / 255;
  return 0.2126 * v(1) + 0.7152 * v(3) + 0.0722 * v(5);
}

/* ----------------------------------------------------------------- facades --- */

/** The roughness the facade material multiplies its map by. */
export const FACADE_ROUGHNESS_SCALAR = 0.95;

/**
 * How rough each part of an elevation is.
 *
 * Almost every highlight in a night city is a window, so glass against
 * concrete is the single most valuable material distinction a facade can
 * make — and for six phases it made none: the facades took the shared grime
 * texture as a roughness map, which is a map of nothing in particular tiled
 * at a different rate, so a pane of glass and the precast panel beside it
 * returned the same reflection.
 *
 * Glass is the only genuinely smooth thing on a building. Everything else is
 * a question of how much dirt is on it.
 */
export const FACADE_ROUGHNESS = {
  /** A window. The one surface here that reflects rather than scatters. */
  glass: "#3c3c3c",
  /** A metal sill or transom. */
  metal: "#8e8e8e",
  /** Painted or clad structure. */
  painted: "#c2c2c2",
  /** Precast panel and concrete: most of the elevation. */
  concrete: "#e8e8e8",
  /** Louvred plant floors. */
  louvre: "#f4f4f4",
  /** Dirt, which is rough wherever it lands — including across the glazing. */
  grime: "#ffffff",
  /** Where the rain has washed it back off again. */
  clean: "#9a9a9a",
} as const;

/** The effective roughness a facade value ends up with. */
export function effectiveFacadeRoughness(grey: string): number {
  const v = Number.parseInt(grey.slice(1, 3), 16) / 255;
  return v * FACADE_ROUGHNESS_SCALAR;
}
