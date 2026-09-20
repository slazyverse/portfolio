import { ANCHOR_SPECS, CITY_SEED } from "@/data/environment";
import { LEVEL_ORDER, levelIndex, route } from "@/data/routes";
import type { StratumId } from "@/data/types";
import type { QualityTier } from "@/lib/capability";
import { environmentBudget } from "./quality";
import { createRng, type Rng } from "./seed";
import type {
  City,
  Conduit,
  EnvironmentAnchor,
  LevelEnvironment,
  LightCell,
  Signal,
  Structure,
  StructureKind,
} from "./types";

/* ---------------------------------------------------------------------------
 * The city, generated.
 *
 * ART DIRECTION — decided by looking at what the site already is, not by
 * looking at a reference render.
 *
 * This is not a city you fly over. It is a vertical shaft you descend through,
 * because that is what the site's information architecture already says: four
 * levels, shallow to deep, and "descending" is the site's central verb. A
 * horizontal skyline would have been the obvious cyberpunk image and it would
 * have illustrated nothing. A well, with the four levels stacked as bands of
 * one continuous structure, makes the metaphor literally true — the level rail
 * in the chrome and the camera's Y position are the same fact.
 *
 * It also happens to be the cheap option, which is usually how you know a
 * visual decision is the right one:
 *
 *  - the camera is inside the geometry, so most of the city is behind it and
 *    frustum-culled for free;
 *  - the central void is empty by construction, so the expensive middle of the
 *    screen is mostly fog;
 *  - every structure is a box and every light is a quad.
 *
 * DARKNESS IS THE MATERIAL. Most of this city is unlit. The Phase 2 palette is
 * near-black grounds with two restrained signals, and a city where every
 * surface glows would abandon that in the first frame. Lit cells are sparse and
 * they mean something: amber is the subject, cold is the machine. That rule
 * came from the design system and the city does not get an exemption from it.
 * ------------------------------------------------------------------------- */

/**
 * Footprint of one level, in world units. Square.
 *
 * Sized against the structures rather than picked: at 74 the band of buildable
 * ground was only 25 units wide while the towers standing in it were up to 42
 * tall, so from inside the shaft the camera faced a continuous wall with no
 * silhouette and no depth for the fog to grade. Wide enough that there is a
 * middle distance, tight enough that it is still a canyon and not a plain.
 */
const SPAN = 130;

/**
 * Radius of the central shaft. Nothing is generated inside it.
 *
 * This is the room the camera has. Too small and every shot is a close-up of
 * whichever facade happens to be nearest.
 */
const VOID_RADIUS = 18;

/** Vertical distance between level floors. Descending decreases Y. */
const LEVEL_DROP = 46;

/**
 * How far the camera stands from the centre of the shaft, and how much room is
 * kept clear around it.
 *
 * The camera's standing point lives here, in the generator, rather than only in
 * the camera module — because the generator is what has to keep that spot
 * clear. Carving the void around the origin alone was not enough: the camera
 * stands off-centre, so the nearest structure could end up about ten units
 * away, and a twelve-unit-wide machine block ten units from the lens fills the
 * entire frame. The level rendered as one flat rectangle.
 *
 * The void that matters is the one around the viewer, not the one around the
 * origin, so both are enforced.
 */
const CAMERA_OFFSET = 7.6;
const CAMERA_CLEARANCE = 27;

/**
 * Where the camera stands horizontally at a given level.
 *
 * Exported so the camera module reads it from here rather than keeping a
 * second copy. One definition, and the generator is the one that owns it,
 * because the generator is what must avoid building on it.
 */
export function cameraAnchorXZ(index: number): readonly [number, number] {
  const bearing = (index / 4) * Math.PI * 2 * 0.62;
  return [Math.cos(bearing) * CAMERA_OFFSET, Math.sin(bearing) * CAMERA_OFFSET];
}

/** The direction the camera looks at a given level, as a bearing in radians. */
export function cameraBearing(index: number): number {
  return (index / 4) * Math.PI * 2 * 0.62;
}

/** How the four levels differ. The only place level character is defined. */
interface LevelProfile {
  kinds: readonly StructureKind[];
  /** Base footprint range: [min, max]. */
  footprint: readonly [number, number];
  /** Height range and the skew applied to it. */
  height: readonly [number, number, number];
  /** Which signal lights this level, and how much of it is lit at all. */
  signal: Exclude<Signal, "none">;
  /** Probability a given structure is lit at all. Most are not. */
  litShare: number;
  /** Spacing of lit cells on a facade. */
  cell: number;
  /** Conduits run vertically (data spines) or horizontally (pipe runs). */
  conduitAxis: "vertical" | "horizontal";
  /** Structures snap to rows rather than a jittered grid. */
  rows: boolean;
  /**
   * This level's share of the city-wide structure budget. The four sum to 1.
   *
   * Density is character here, not fairness. The substrate is a server hall
   * and reads as one only when it is crowded; the engine floor is meant to be
   * sparse and heavy. An equal split gave all four the same crowd.
   */
  structureShare: number;
  /**
   * How much of the full span this level occupies, as a fraction.
   *
   * The shaft tapers as it descends. That is the reading of the metaphor —
   * the surface is open and the substrate is a tight hall you are inside of —
   * and it does useful work: a narrower band concentrates the same number of
   * structures into a denser wall, so depth gets denser without costing a
   * single extra instance.
   */
  spanScale: number;
  /**
   * This level's share of the city-wide light budget. The four sum to 1.
   *
   * Authored, not derived. A single global probability across all four levels
   * does not work, and measurably so: the substrate's cell grid is roughly
   * four times finer than the interface's, so it offers an order of magnitude
   * more candidate cells and swallows the budget — the first version gave the
   * substrate 961 lights and the interface 60, which renders that level
   * invisible. The share is therefore a composition decision, made here, and
   * the generator hits it exactly.
   */
  lightShare: number;
}

const PROFILE: Record<StratumId, LevelProfile> = {
  /**
   * 00 SURFACE — street level. Slender towers and slabs around a wet plaza.
   * Warm amber windows: this is where people are, and amber is the subject.
   */
  surface: {
    kinds: ["tower", "tower", "slab"],
    footprint: [3.4, 8.2],
    height: [12, 42, 2.1],
    signal: "amber",
    litShare: 0.42,
    cell: 1.5,
    conduitAxis: "vertical",
    rows: false,
    spanScale: 1,
    structureShare: 0.26,
    // The establishing level. Warm, populated, the most lit of the four.
    lightShare: 0.34,
  },
  /**
   * 01 INTERFACE — the network layer. Masts and thin towers carrying cold
   * data spines. Fewer, taller, colder; the machine, not the person.
   */
  interface: {
    kinds: ["mast", "tower", "mast"],
    footprint: [1.6, 5.4],
    height: [16, 38, 1.5],
    signal: "cold",
    litShare: 0.34,
    cell: 1.5,
    conduitAxis: "vertical",
    rows: false,
    spanScale: 0.88,
    structureShare: 0.2,
    // Sparse cold points across tall masts: a network, not a skyline.
    lightShare: 0.2,
  },
  /**
   * 02 ENGINE — industrial. Wide, heavy, low machine blocks with horizontal
   * pipe runs. Amber again, but as furnace light from below rather than
   * windows: this is where the work is done.
   */
  engine: {
    kinds: ["machine", "slab", "machine"],
    footprint: [4.5, 9.5],
    height: [5, 17, 1.3],
    signal: "amber",
    litShare: 0.3,
    cell: 1.4,
    conduitAxis: "horizontal",
    rows: false,
    spanScale: 0.76,
    structureShare: 0.18,
    // The darkest level by design. Light here is furnace glow, and rare.
    lightShare: 0.16,
  },
  /**
   * 03 SUBSTRATE — bedrock. Server rows in a dark hall, cold indicator dots,
   * cable trays. Dense and orderly because this level is exact: the design
   * system tightens its rhythm here too, and the city follows the same rule.
   */
  substrate: {
    kinds: ["rack"],
    footprint: [2.2, 3.4],
    height: [2.6, 6.4, 1.0],
    signal: "cold",
    litShare: 0.8,
    cell: 0.62,
    conduitAxis: "horizontal",
    rows: true,
    spanScale: 0.64,
    structureShare: 0.36,
    // A server hall reads as dense rows of indicators or it reads as nothing.
    lightShare: 0.3,
  },
};

/** World Y of a level's floor. */
export function levelFloor(level: StratumId): number {
  return -LEVEL_ORDER.indexOf(level) * LEVEL_DROP;
}

/* ------------------------------------------------------------- placement --- */

interface Cell {
  x: number;
  z: number;
}

/**
 * Candidate footprints on a jittered grid with the shaft carved out.
 *
 * A grid rather than polar scatter because cities have streets — polar
 * placement produces a ring, which reads immediately as generated. The jitter
 * is what stops it reading as a chessboard. The two together give the thing a
 * city has: alignment you can sense but not measure.
 */
function placements(
  rng: Rng,
  count: number,
  rows: boolean,
  span: number,
  camera: readonly [number, number],
): Cell[] {
  const half = span / 2;
  // Enough cells that rejecting the void still leaves room to choose from.
  const per = Math.max(4, Math.ceil(Math.sqrt(count * 2.6)));
  const step = span / per;
  const jitter = rows ? step * 0.06 : step * 0.3;

  const cells: Cell[] = [];
  for (let i = 0; i < per; i += 1) {
    for (let j = 0; j < per; j += 1) {
      const x = -half + step * (i + 0.5) + rng.range(-jitter, jitter);
      const z = -half + step * (j + 0.5) + rng.range(-jitter, jitter);
      // The shaft: the space the camera descends through.
      if (Math.hypot(x, z) < VOID_RADIUS) continue;
      // And the room the camera stands in once it arrives.
      if (Math.hypot(x - camera[0], z - camera[1]) < CAMERA_CLEARANCE) continue;
      cells.push({ x, z });
    }
  }

  // Deterministic Fisher-Yates, so which cells survive is reproducible.
  for (let i = cells.length - 1; i > 0; i -= 1) {
    const j = rng.int(0, i);
    const a = cells[i]!;
    const b = cells[j]!;
    cells[i] = b;
    cells[j] = a;
  }

  return cells.slice(0, count);
}

/* ---------------------------------------------------------------- lights --- */

/**
 * Lit cells on a structure's facades.
 *
 * Placed on the four walls rather than scattered in a volume, so they read as
 * windows and indicator panels rather than fireflies. `litProbability` is
 * passed in already scaled to the city-wide budget, which is how the cap is
 * respected without truncating whole buildings out of the lighting — slicing a
 * flat list at the cap would leave one side of the city dark.
 */
/**
 * How many candidate cells a structure's facades offer.
 *
 * Mirrors the loop bounds in `facadeLights` exactly and consumes no
 * randomness, so the count can be taken before generating anything. Keeping
 * the two in step is the price of having an exact budget; the alternative was
 * a closed-form estimate, and that was measurably wrong — it overestimated the
 * engine level by about ninety percent, because `floor()` on per-structure
 * dimensions is sharply non-linear at the sizes that level uses, and the
 * level filled barely half its share as a result.
 */
function countFacadeCells(s: Structure, profile: LevelProfile): number {
  const [w, h, d] = s.size;
  const step = profile.cell;
  const rowsN = Math.max(1, Math.floor((h - step) / step));
  const across = [w, w, d, d];
  let cols = 0;
  for (const face of across) {
    cols += Math.max(1, Math.floor((face - step * 0.5) / step));
  }
  return rowsN * cols;
}

function facadeLights(
  rng: Rng,
  s: Structure,
  profile: LevelProfile,
  litProbability: number,
  out: LightCell[],
): void {
  const [w, h, d] = s.size;
  const [x, y, z] = s.position;
  const step = profile.cell;

  const faces = [
    { nx: 0, nz: 1, across: w, rot: 0 },
    { nx: 0, nz: -1, across: w, rot: Math.PI },
    { nx: 1, nz: 0, across: d, rot: Math.PI / 2 },
    { nx: -1, nz: 0, across: d, rot: -Math.PI / 2 },
  ] as const;

  const rowsN = Math.max(1, Math.floor((h - step) / step));

  for (const face of faces) {
    const colsN = Math.max(1, Math.floor((face.across - step * 0.5) / step));
    for (let r = 1; r <= rowsN; r += 1) {
      for (let c = 0; c < colsN; c += 1) {
        if (!rng.chance(litProbability)) continue;
        const along = -face.across / 2 + step * (c + 0.5);
        // Nudged off the wall so the quad never z-fights with the facade.
        const ox = face.nx * (d / 2 + 0.02) + (face.nx === 0 ? along : 0);
        const oz = face.nz * (w / 2 + 0.02) + (face.nz === 0 ? along : 0);
        out.push({
          position: [x + ox, y + step * r, z + oz],
          rotation: face.rot + s.rotation,
          signal: profile.signal,
          // Windows are not identical. Varying intensity is most of what
          // separates a facade from a texture.
          intensity: rng.skewed(0.45, 1, 1.5),
          // A quarter of the cell, not half. At half, the quads read as lit
          // panels the width of the building rather than as windows — the
          // first pass put three cyan billboards on a mast 1.6 units wide.
          size: step * rng.range(0.2, 0.32),
        });
      }
    }
  }
}

/* -------------------------------------------------------------- conduits --- */

function conduits(
  rng: Rng,
  level: StratumId,
  profile: LevelProfile,
  count: number,
): Conduit[] {
  const floor = levelFloor(level);
  const out: Conduit[] = [];

  for (let i = 0; i < count; i += 1) {
    const points: [number, number, number][] = [];

    if (profile.conduitAxis === "vertical") {
      // A data spine dropping toward the next level, stepped rather than
      // straight — a straight line between two levels reads as a wire, a
      // stepped one reads as infrastructure routed around something.
      const angle = rng.range(0, Math.PI * 2);
      const radius = rng.range(VOID_RADIUS + 2, SPAN / 2 - 6);
      let x = Math.cos(angle) * radius;
      let z = Math.sin(angle) * radius;
      const top = floor + rng.range(6, 26);
      const bottom = floor - LEVEL_DROP * rng.range(0.55, 0.95);
      points.push([x, top, z]);
      const steps = rng.int(2, 4);
      for (let s = 1; s <= steps; s += 1) {
        const y = top + ((bottom - top) * s) / steps;
        points.push([x, y, z]);
        x += rng.range(-3.4, 3.4);
        z += rng.range(-3.4, 3.4);
        points.push([x, y, z]);
      }
      points.push([x, bottom, z]);
    } else {
      // A pipe run crossing the level, kinked around the shaft.
      const y = floor + rng.range(1.5, 12);
      const angle = rng.range(0, Math.PI * 2);
      const r1 = SPAN / 2 - 2;
      const sweep = rng.range(Math.PI * 0.45, Math.PI * 0.9);
      const segs = rng.int(3, 5);
      for (let s = 0; s <= segs; s += 1) {
        const a = angle + (sweep * s) / segs;
        const r = VOID_RADIUS + 3 + ((r1 - VOID_RADIUS - 3) * ((s % 2) + 1)) / 2.4;
        points.push([Math.cos(a) * r, y + rng.range(-0.5, 0.5), Math.sin(a) * r]);
      }
    }

    // Always cold, on every level, including the amber ones. Conduits are
    // infrastructure and the palette reserves cold for the machine. A pipe run
    // glowing amber would read as "a person is here", which is precisely the
    // distinction the two signals exist to carry.
    out.push({ id: `${level}-conduit-${i}`, points, signal: "cold" });
  }

  return out;
}

/* --------------------------------------------------------------- anchors --- */

/**
 * The authored navigation anchors that belong to a level.
 *
 * The level comes from the route table, not from the anchor. That is the whole
 * point of keying on `routeId`: move a route to a different level and its
 * anchor moves with it, with no second edit and no chance of the two
 * disagreeing.
 */
function anchorsFor(level: StratumId): EnvironmentAnchor[] {
  const floor = levelFloor(level);
  return ANCHOR_SPECS.filter((spec) => route(spec.routeId).level === level).map(
    (spec) => {
      const angle = spec.bearing * Math.PI * 2;
      const radius = spec.importance === "primary" ? VOID_RADIUS + 5 : VOID_RADIUS + 13;
      return {
        id: spec.id,
        kind: spec.kind,
        routeId: spec.routeId,
        level,
        position: [
          Math.cos(angle) * radius,
          floor + (spec.importance === "primary" ? 9 : 4),
          Math.sin(angle) * radius,
        ] as const,
        importance: spec.importance,
      };
    },
  );
}

/* ------------------------------------------------------------------ city --- */

function generateLevel(
  level: StratumId,
  tier: QualityTier,
  seed: string,
): LevelEnvironment {
  const profile = PROFILE[level];
  const budget = environmentBudget(tier);
  // A per-level stream, so changing one level's generation cannot shift the
  // numbers every later level receives.
  const rng = createRng(`${seed}:${level}`);
  const floor = levelFloor(level);

  const cells = placements(
    rng,
    Math.floor(budget.structures * profile.structureShare),
    profile.rows,
    SPAN * profile.spanScale,
    cameraAnchorXZ(LEVEL_ORDER.indexOf(level)),
  );
  const structures: Structure[] = cells.map((cell, i) => {
    const kind = rng.pick(profile.kinds);
    const w = rng.range(profile.footprint[0], profile.footprint[1]);
    const d = profile.rows ? w * rng.range(2.4, 3.6) : w * rng.range(0.7, 1.4);
    const h = rng.skewed(profile.height[0], profile.height[1], profile.height[2]);
    return {
      id: `${level}-${i}`,
      level,
      kind,
      position: [cell.x, floor, cell.z] as const,
      size: [w, h, d] as const,
      // Rows are orderly; everything else is a few degrees off true.
      rotation: profile.rows ? 0 : rng.range(-0.06, 0.06),
      signal: rng.chance(profile.litShare) ? profile.signal : "none",
    };
  });

  // Count first, then light. The exact candidate total is arithmetic over the
  // structures that already exist, so the probability that hits this level's
  // authored share is derived rather than guessed.
  const quota = lightQuota(tier, level);
  let candidates = 0;
  for (const s of structures) {
    if (s.signal === "none") continue;
    candidates += countFacadeCells(s, profile);
  }
  const litProbability = candidates === 0 ? 0 : Math.min(1, quota / candidates);

  const lights: LightCell[] = [];
  if (quota > 0) {
    for (const s of structures) {
      if (s.signal === "none") continue;
      facadeLights(rng, s, profile, litProbability, lights);
    }
  }

  return {
    level,
    index: levelIndex(level),
    floor,
    structures,
    lights,
    conduits: conduits(rng, level, profile, budget.conduitsPerLevel),
    anchors: anchorsFor(level),
  };
}

/**
 * Thins a level's lit cells by a uniform stride.
 *
 * Uniform rather than random, and applied across the already-generated list
 * rather than by rejecting during generation, because the list is ordered by
 * structure: taking every nth cell removes a proportional share from *every*
 * building instead of darkening whichever ones the budget happened to reach
 * last. Truncating a flat list at the cap would leave one side of the city
 * black.
 *
 * Deterministic by construction — no rng is consulted.
 */
function thin<T>(items: readonly T[], keep: number): T[] {
  if (keep >= items.length) return [...items];
  if (keep <= 0) return [];
  const out: T[] = [];
  const stride = items.length / keep;
  for (let i = 0; i < keep; i += 1) {
    out.push(items[Math.floor(i * stride)]!);
  }
  return out;
}

/** This level's hard ceiling on lit cells. */
function lightQuota(tier: QualityTier, level: StratumId): number {
  return Math.floor(environmentBudget(tier).maxLights * PROFILE[level].lightShare);
}

/**
 * Generates the whole city.
 *
 * Pure: same seed and tier in, identical model out, on any machine. No clock,
 * no `Math.random`, no DOM. That is what makes the determinism test meaningful
 * rather than decorative.
 */
export function generateCity(tier: QualityTier, seed: string = CITY_SEED): City {
  // Each level is generated to its own authored share of the light budget and
  // thinned to exactly that quota. Allocating per level rather than globally is
  // what stops the densest geometry from consuming the whole ceiling and
  // leaving another level dark.
  const levels: LevelEnvironment[] = LEVEL_ORDER.map((level) => {
    const generated = generateLevel(level, tier, seed);
    return {
      ...generated,
      lights: thin(generated.lights, lightQuota(tier, level)),
    };
  });

  const count = (pick: (l: LevelEnvironment) => number) =>
    levels.reduce((sum, l) => sum + pick(l), 0);

  return {
    seed,
    levels,
    stats: {
      structures: count((l) => l.structures.length),
      lights: count((l) => l.lights.length),
      conduits: count((l) => l.conduits.length),
      anchors: count((l) => l.anchors.length),
      // One instanced mesh for all structures, one for all lit cells, one
      // merged line geometry for all conduits, one points cloud for rain,
      // plus the ground plane. The whole city is a handful of draw calls,
      // which is the entire reason for instancing it.
      drawCalls: 4 + (environmentBudget(tier).rain > 0 ? 1 : 0),
    },
  };
}

/** Exported for the `/system` laboratory and for tests. */
export const CITY_GEOMETRY = {
  SPAN,
  VOID_RADIUS,
  LEVEL_DROP,
  CAMERA_OFFSET,
  CAMERA_CLEARANCE,
} as const;
