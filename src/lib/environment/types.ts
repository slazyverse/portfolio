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

/** What a generated structure is, which decides how it is drawn and lit. */
export type StructureKind =
  /** Slender vertical mass. Surface towers. */
  | "tower"
  /** Wide, shorter block. Surface and engine. */
  | "slab"
  /** Thin antenna or aerial. Interface. */
  | "mast"
  /** Industrial plant: wide, heavy, low. Engine. */
  | "machine"
  /** Server rack. Substrate. */
  | "rack";

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
  /** Footprint width, height, footprint depth. */
  size: readonly [number, number, number];
  /** Yaw in radians. Small, deliberate: a city is not perfectly aligned. */
  rotation: number;
  signal: Signal;
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
}

export interface CityStats {
  structures: number;
  lights: number;
  conduits: number;
  anchors: number;
  /** Instanced draw calls the renderer will issue for the static city. */
  drawCalls: number;
}

export interface City {
  seed: string;
  levels: readonly LevelEnvironment[];
  stats: CityStats;
}
