import type { DistrictId } from "@/data/city-identity";
import type { RouteId, StratumId } from "@/data/types";

/**
 * The environment's data model.
 *
 * Deliberately three.js-free. Nothing in this file, or in the generator that
 * produces it, imports a rendering library — the city is *data* first and
 * geometry second.
 *
 * That separation is the load-bearing decision of this phase:
 *
 *  - the generator can be unit-tested in Node, hermetically, in milliseconds,
 *    with no WebGL, no canvas and no headless browser;
 *  - determinism is provable rather than eyeballed;
 *  - the Canvas and CSS fallbacks can read the same model as the WebGL path,
 *    so the fallbacks are the same city rendered more cheaply, not a different
 *    thing wearing the same name;
 *  - nothing here reaches the initial bundle, because nothing here is imported
 *    by a page — only by the lazily loaded environment.
 */

/** What a generated structure is, which decides how it is composed and lit. */
export type StructureKind = "tower" | "slab" | "stack" | "machine" | "rack";

/**
 * The pieces a building is assembled from.
 *
 * Each kind becomes exactly one `InstancedMesh` at render time, across the
 * whole city and all four levels. That is the trade this model exists to make:
 * a richer building costs more instances, which are close to free, and never
 * more draw calls, which are not.
 */
export type PartKind =
  /** A building volume, textured with the facade atlas. */
  | "mass"
  /** Vertical structural fin on a facade. */
  | "fin"
  /** Rooftop plant: air handling, machine rooms. */
  | "roofUnit"
  /** Cylindrical water tank on a frame. */
  | "tank"
  /** Antenna mast, often with an obstruction light. */
  | "mast"
  /** Emissive signage panel. */
  | "sign"
  /** Service pipework running up a flank. */
  | "pipe"
  /** Horizontal relief: floor bands, setback shelves, balconies. */
  | "platform"
  /** A skybridge between two neighbours. */
  | "bridge"
  /** Human-scale street furniture: cabinets, bollards, railings, vents. */
  | "prop";

export interface Part {
  kind: PartKind;
  /** Centre of the part, in world space. */
  position: readonly [number, number, number];
  size: readonly [number, number, number];
  rotation: number;
  signal: Signal;
  /** Which facade atlas cell a mass uses. */
  variant: number;
  /** 0..1. Drives grime, roughness and colour desaturation. */
  wear: number;
  /** 0..1. Emissive strength, for signs and obstruction lights. */
  emissive: number;
}

/**
 * How much of the kit a building received.
 *
 * Assigned by distance from the level's camera, so detail is spent where it
 * can be seen. This is the difference between a city that costs what it looks
 * like and one that pays full price for geometry behind the lens.
 */
export type DetailTier = "hero" | "near" | "mid" | "far";

/** Which signal family lights a thing. The Phase 2 semantics are not negotiable. */
export type Signal =
  /** `--accent`. Reserved for the subject: a person, their work, their traces. */
  | "amber"
  /** `--cold`. Reserved for the machine: telemetry, data, infrastructure. */
  | "cold"
  /** Unlit. Most of the city. */
  | "none";

export interface Structure {
  id: string;
  level: StratumId;
  kind: StructureKind;
  /** Centre of the footprint. `y` is the base, not the centre of mass. */
  position: readonly [number, number, number];
  /** Overall bounding footprint and height. */
  size: readonly [number, number, number];
  /** Yaw in radians. Small, deliberate: a city is not perfectly aligned. */
  rotation: number;
  signal: Signal;
  /**
   * Which district this building stands in.
   *
   * The single field that carries class. Maintenance, signage density,
   * storefronts, exposed services, balconies and clutter all fall out of it,
   * which is how the world communicates inequality without a word of copy.
   */
  district: DistrictId;
  /** The corporation that has put its name on this, where one has. */
  owner?: string;
  detail: DetailTier;
  /** Facade atlas cell for the building's main masses. */
  variant: number;
  /** 0..1 weathering. */
  wear: number;
  /** The kit pieces this building is assembled from. */
  parts: readonly Part[];
}

/**
 * One lit cell — a window, a panel indicator, a status LED.
 *
 * Stored as flat data rather than as a scene node because at the high tier
 * there are well over a thousand of them and every one becomes a single
 * instance matrix in one `InstancedMesh`. They are never individual objects in
 * the scene graph.
 */
export interface LightCell {
  position: readonly [number, number, number];
  /** Face normal as a yaw in radians, so the cell sits flat on its wall. */
  rotation: number;
  signal: Exclude<Signal, "none">;
  /** 0..1. Varies so the facade is not a uniform grid of identical dots. */
  intensity: number;
  size: number;
}

/** A run of cable, pipe or data line. Rendered as merged line segments. */
export interface Conduit {
  id: string;
  points: readonly (readonly [number, number, number])[];
  signal: Exclude<Signal, "none">;
}

/**
 * What an authored navigation object *is*, in the world's own terms.
 *
 * Kinds are in-world nouns because the environment is a register of its own.
 * The mapping from a kind to a destination is authored, never inferred.
 */
export type AnchorKind =
  | "communication-tower"
  | "terminal"
  | "network-node"
  | "contract-hub"
  | "infrastructure-core"
  | "archive"
  | "ledger"
  | "relay";

/**
 * A place in the world that stands for a place in the site.
 *
 * Phase 5 generates these and stops. They are not clickable, they are not
 * focusable, and they do not drive navigation — that interaction layer is a
 * later phase's job, and building it now would mean guessing at a camera model
 * and an input model that do not exist yet.
 *
 * What this phase owes the later one is a stable interface, which is this:
 * an anchor carries a `routeId` and never a URL. The route table already owns
 * paths, titles and levels. If a path changes, the city does not notice.
 */
export interface EnvironmentAnchor {
  id: string;
  kind: AnchorKind;
  /** The join key into the Phase 3 route table. Never a path. */
  routeId: RouteId;
  level: StratumId;
  position: readonly [number, number, number];
  /** Primary anchors are landmarks; secondary ones are found once you look. */
  importance: "primary" | "secondary";
}

/**
 * A distant building on the horizon, drawn as a flat impostor.
 *
 * Never resolved as geometry: at that range a silhouette in haze is
 * indistinguishable from a modelled tower, and the difference in cost is
 * three orders of magnitude. An empty horizon is the fastest way to make a
 * city feel like a diorama.
 */
export interface SkylineShape {
  position: readonly [number, number, number];
  size: readonly [number, number];
  /** 0..1 — how far into the haze it sits. */
  depth: number;
  /** Sparse window glow, baked as a count rather than as geometry. */
  lit: number;
}

/** One level of the city: a horizontal band of the vertical shaft. */
export interface LevelEnvironment {
  level: StratumId;
  /** "00".."03". */
  index: string;
  /** World Y of this level's floor. Descending means decreasing Y. */
  floor: number;
  structures: readonly Structure[];
  lights: readonly LightCell[];
  conduits: readonly Conduit[];
  anchors: readonly EnvironmentAnchor[];
  /** The horizon behind this level. */
  skyline: readonly SkylineShape[];
}

export interface CityStats {
  structures: number;
  /** Kit pieces across the whole city, grouped into one mesh per kind. */
  parts: number;
  lights: number;
  conduits: number;
  anchors: number;
  /** Distant impostor silhouettes on the horizon. */
  skyline: number;
  /** Instanced draw calls the renderer will issue for the static city. */
  drawCalls: number;
}

export interface City {
  seed: string;
  levels: readonly LevelEnvironment[];
  stats: CityStats;
}
