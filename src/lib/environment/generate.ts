import {
  CORPORATIONS,
  DISTRICTS,
  LEVEL_DISTRICTS,
  type Corporation,
  type DistrictId,
} from "@/data/city-identity";
import { ANCHOR_SPECS, CITY_SEED } from "@/data/environment";
import { LEVEL_ORDER, levelIndex, route } from "@/data/routes";
import type { StratumId } from "@/data/types";
import type { QualityTier } from "@/lib/capability";
import {
  composeBuilding,
  corporateMark,
  part,
  type Archetype,
  type DetailTier,
} from "./kit";
import { environmentBudget } from "./quality";
import { createRng, type Rng } from "./seed";
import type {
  City,
  Conduit,
  Part,
  PartKind,
  EnvironmentAnchor,
  LevelEnvironment,
  LightCell,
  Signal,
  SkylineShape,
  Structure,
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
const SPAN = 330;

/**
 * Radius of the central shaft. Nothing is generated inside it.
 *
 * This is the room the camera has. Too small and every shot is a close-up of
 * whichever facade happens to be nearest.
 */
const VOID_RADIUS = 46;

/** Vertical distance between level floors. Descending decreases Y. */
const LEVEL_DROP = 155;

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
const CAMERA_OFFSET = 14;

/**
 * How far the view opens ahead of the camera, and how close the city crowds
 * in beside it.
 *
 * This replaced a single circular clearance of 66 units, and it is the change
 * that fixed the composition. A circle keeps *everything* 66 metres away, so
 * the nearest building in any direction was two-thirds of the way across the
 * shaft, and the result was the exact failure the review named: a miniature
 * skyline observed from a plaza, with a large share of the frame given to
 * empty floor.
 *
 * What a street actually does is the opposite. It is open along its length
 * and closed across it — you stand between two walls and look down a gap. So
 * the clearance is a cone: wide and deep along the line of sight, shallow
 * everywhere else. Buildings now come within about thirty metres at the
 * flanks, where they fill the edges of the frame and occlude it, while the
 * view down the shaft stays open.
 *
 * `CAMERA_CLEARANCE` is still what it says — the room in front of the lens —
 * and `CAMERA_PERSONAL` is the room around it.
 */
const CAMERA_CLEARANCE = 74;
const CAMERA_PERSONAL = 24;
/** Half-angle of the clear cone, in radians. About thirty-five degrees. */
const SIGHT_CONE = 0.62;

/** Signed smallest difference between two bearings. */
function angleDelta(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * May a building stand here, given where the camera is and what it is looking
 * at?
 *
 * The only placement rule that knows about the shot rather than about the
 * city, which is why it is a named function instead of a line in a loop.
 */
function clearsCamera(
  x: number,
  z: number,
  camera: readonly [number, number],
  look: number,
  /** Scales with the level, so a tight hall crowds the lens and a street does not. */
  scale: number,
): boolean {
  const dx = x - camera[0];
  const dz = z - camera[1];
  const distance = Math.hypot(dx, dz);
  if (distance < Math.max(11, CAMERA_PERSONAL * scale)) return false;
  if (distance >= CAMERA_CLEARANCE * scale) return true;
  return Math.abs(angleDelta(Math.atan2(dz, dx), look)) > SIGHT_CONE;
}

/** How far the shaft is carved out at a given level. */
export function levelVoidRadius(level: StratumId): number {
  return VOID_RADIUS * PROFILE[level].voidScale;
}

/**
 * The elevated transit system.
 *
 * Named here rather than in the renderer because two things have to agree
 * about it: the generator, which builds the guideway, its columns and its
 * station, and the traffic system, which runs vehicles along it. When those
 * two disagreed the result was the weakness the review named — a lane of
 * light in the air with no structure under it, which reads as a bug rather
 * than as infrastructure.
 */
export const TRANSIT = {
  /** Distance from the shaft's centre. Mid-ground: past the near buildings. */
  radius: 118,
  /** Height of the deck above the level floor. */
  height: 34,
  /** Deck width, in metres. Two tracks and a walkway. */
  deck: 7.5,
} as const;

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
  kinds: readonly Archetype[];
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
  /**
   * How much of the shaft this level keeps clear, as a fraction.
   *
   * The shaft tapers with the span. Holding the void at a constant 46 while
   * the substrate's footprint narrowed to 138 left that level a buildable
   * band twenty-three metres wide — so the racks stood in a ring on the far
   * side of an empty floor, and the hall the camera was supposed to be
   * standing *inside* was a diorama it was standing in front of. A room
   * gets smaller as it gets deeper, and so does the space in the middle of
   * it.
   */
  voidScale: number;
  /**
   * Where the horizon stands, as a fraction of `SPAN`: near ring, far ring.
   *
   * It has to clear the buildable footprint and sit *inside* this level's fog,
   * and the second half of that was wrong for two phases. The rings were
   * authored at 1.05 to 2.55 spans — 520 to 840 metres — while the fog was
   * tightened to reach 430 at its most generous. Every one of the 256
   * impostors in the city rendered as pure fog colour. The background layer
   * existed in the model, cost its instances, and was invisible in all four
   * levels.
   *
   * A zero band means this level has no horizon at all, which is the correct
   * answer for an interior: the substrate has a ceiling and piers, and a
   * distant skyline inside a room would be a hole in the wall.
   */
  skylineBand: readonly [number, number];
}

const PROFILE: Record<StratumId, LevelProfile> = {
  /**
   * 00 SURFACE — street level. Slender towers and slabs around a wet plaza.
   * Warm amber windows: this is where people are, and amber is the subject.
   */
  surface: {
    kinds: ["tower", "tower", "slab", "stack"],
    footprint: [11, 27],
    height: [26, 118, 2.0],
    signal: "amber",
    litShare: 0.42,
    cell: 3.4,
    conduitAxis: "vertical",
    rows: false,
    spanScale: 1,
    skylineBand: [0.56, 1.21],
    voidScale: 1,
    structureShare: 0.24,
    // The establishing level. Warm, populated, the most lit of the four.
    lightShare: 0.34,
  },
  /**
   * 01 INTERFACE — the network layer. Masts and thin towers carrying cold
   * data spines. Fewer, taller, colder; the machine, not the person.
   */
  interface: {
    kinds: ["tower", "stack", "tower"],
    footprint: [8, 20],
    height: [38, 104, 1.5],
    signal: "cold",
    litShare: 0.34,
    cell: 3.4,
    conduitAxis: "vertical",
    rows: false,
    spanScale: 0.88,
    skylineBand: [0.58, 1.45],
    voidScale: 0.92,
    // Raised from 0.2, taken from the substrate. This level frames a canyon
    // with a gap of sky down the middle, and at thirty-four structures the
    // gap was most of the picture.
    structureShare: 0.24,
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
    footprint: [14, 34],
    height: [11, 38, 1.3],
    signal: "amber",
    litShare: 0.3,
    cell: 3.0,
    conduitAxis: "horizontal",
    rows: false,
    spanScale: 0.76,
    skylineBand: [0.55, 0.92],
    voidScale: 0.74,
    structureShare: 0.16,
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
    footprint: [2.4, 3.6],
    height: [2.8, 5.4, 1.0],
    signal: "cold",
    litShare: 0.8,
    cell: 0.62,
    conduitAxis: "horizontal",
    rows: true,
    // A hall has no horizon. It has a ceiling, which the fixtures build.
    skylineBand: [0, 0],
    voidScale: 0.46,
    spanScale: 0.42,
    /*
     * The four shares sum to exactly one, and that is load-bearing.
     *
     * They summed to 1.02, which nobody noticed while the camera clearance
     * was a circle — the rejected cells meant no level could place its full
     * allocation anyway, so the city came in under its cap by accident. With
     * the clearance opened up at the flanks every level fills its share, the
     * two percent became real, and the city went three structures over a cap
     * it had appeared to respect for two phases. A budget that is only met
     * because the generator keeps failing is not a budget.
     *
     * One place is left for the landmark, which is authored rather than
     * allocated: 169 placed plus the hero is exactly 170 at HIGH.
     */
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
  look: number,
  voidScale: number,
): { cells: Cell[]; step: number } {
  const half = span / 2;
  // Enough cells that rejecting the void still leaves room to choose from.
  const per = Math.max(4, Math.ceil(Math.sqrt(count * 2.6)));
  const step = span / per;
  // Jitter has to stay well inside the cell, because a footprint is sized
  // against the step below. Two neighbours each jittered a third of a cell
  // toward one another is how generated cities end up with buildings growing
  // through each other, which no amount of lighting recovers from.
  const jitter = rows ? step * 0.04 : step * 0.16;

  const cells: Cell[] = [];
  for (let i = 0; i < per; i += 1) {
    for (let j = 0; j < per; j += 1) {
      const x = -half + step * (i + 0.5) + rng.range(-jitter, jitter);
      const z = -half + step * (j + 0.5) + rng.range(-jitter, jitter);
      // The shaft: the space the camera descends through.
      if (Math.hypot(x, z) < VOID_RADIUS * voidScale) continue;
      // And the room the camera stands in once it arrives — open ahead,
      // close at the flanks, which is what a street is.
      if (!clearsCamera(x, z, camera, look, voidScale)) continue;
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

  return { cells: cells.slice(0, count), step };
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

/**
 * How much of the kit a building earns, by how close it stands to the camera.
 *
 * The single most effective piece of rendering discipline in the whole
 * environment: detail is spent where it can be resolved and nowhere else. A
 * building eighty units behind the lens gets a mass and a roofline, because
 * that is all anyone could see of it even if it had fins, pipes and signage.
 *
 * Derived from the camera's standing point rather than from the origin, for
 * the same reason the clearance is — the camera is not at the centre.
 */
function detailFor(
  x: number,
  z: number,
  camera: readonly [number, number],
  budget: { nearRadius: number; midRadius: number },
): DetailTier {
  const distance = Math.hypot(x - camera[0], z - camera[1]);
  if (distance <= budget.nearRadius) return "near";
  if (distance <= budget.midRadius) return "mid";
  return "far";
}

/**
 * The horizon.
 *
 * Flat impostors on a ring well beyond the playable footprint, so the city
 * does not stop at its own edge. An empty horizon is the fastest way to make
 * a world feel like a diorama on a table — and modelled geometry out there
 * would cost three orders of magnitude more than a silhouette in haze for a
 * difference nobody can resolve.
 *
 * Two rings at different radii, so the far city has depth of its own.
 */
function skyline(rng: Rng, level: StratumId, count: number): SkylineShape[] {
  const floor = levelFloor(level);
  const out: SkylineShape[] = [];
  const band = PROFILE[level].skylineBand;
  if (count <= 0 || band[1] <= 0) return out;

  for (let i = 0; i < count; i += 1) {
    // Golden-angle spacing: even coverage without the visible periodicity a
    // uniform step produces.
    const angle = i * 2.399963 + rng.range(-0.12, 0.12);
    const ring = i % 2;
    const depth = ring === 0 ? rng.range(0.35, 0.62) : rng.range(0.66, 1);
    // Inside the fog, beyond the buildings. Both halves matter: outside the
    // fog an impostor is a fog-coloured rectangle on a fog-coloured sky, and
    // inside the footprint it is a flat cut-out standing among real geometry.
    const radius = SPAN * (band[0] + depth * (band[1] - band[0]));

    /*
     * Megastructures.
     *
     * One in seven of the distant silhouettes is not a tower but something
     * three to five times the size of anything in the playable footprint.
     * This is the cheapest scale statement available anywhere in the
     * environment — two triangles — and it does the thing the brief asks for
     * most directly: it makes the world visibly much larger than the part of
     * it the camera is standing in.
     *
     * Sparse on purpose. A horizon where everything is enormous has no scale
     * at all, because scale is a comparison.
     */
    const mega = ring === 1 && i % 7 === 3;
    const height = mega
      ? rng.range(240, 430) * (1 - depth * 0.18)
      : rng.skewed(26, 132, 1.9) * (1 - depth * 0.28);
    const width = mega ? rng.range(90, 210) : rng.range(10, 34);

    out.push({
      position: [Math.cos(angle) * radius, floor, Math.sin(angle) * radius] as const,
      size: [width, height] as const,
      depth,
      // Sparse glow, and less of it the further back it sits — atmospheric
      // perspective applies to light as well as to form.
      // Atmospheric perspective applies to light as well as to form: the
      // further back a tower is, the less of its glow survives the haze.
      lit: rng.chance(mega ? 0.9 : 0.62)
        ? rng.range(0.08, 0.55) * (1 - depth * 0.85) * (mega ? 0.6 : 1)
        : 0,
    });
  }
  return out;
}

/**
 * Which district a building stands in.
 *
 * Distance from the central shaft, not chance. The expensive, controlled
 * ground is nearest the core and everything else is pushed outward — so a
 * premium tower and a patched residential stack end up in the same frame,
 * which is the high-tech-over-low-life contrast stated as geometry.
 */
function districtFor(level: StratumId, x: number, z: number): DistrictId {
  const { core, edge } = LEVEL_DISTRICTS[level];
  const radius = Math.hypot(x, z);
  const inner = levelVoidRadius(level);
  const coreEdge = inner + ((SPAN * PROFILE[level].spanScale) / 2 - inner) * 0.42;
  return radius <= coreEdge ? core : edge;
}

/**
 * Who owns it.
 *
 * Only buildings large enough to be worth signing get an owner, and the
 * corporation is chosen by the district rather than at random — infrastructure
 * belongs to the power company, residential stacks to the housing trust. That
 * is what makes the signage read as ownership instead of as decoration.
 */
function ownerFor(rng: Rng, district: DistrictId, height: number): Corporation | undefined {
  /*
   * Twenty-six metres, and eighteen on the plant floor.
   *
   * A threshold of thirty-four kept ownership off sheds and server cabinets,
   * which was the intent, and also off every building on the engine level,
   * which was not: that level's heights top out at thirty-eight, so the
   * corporation that owns industrial plant never appeared anywhere in the
   * city. A power station is signed by the company that runs it whatever
   * size it is — if anything more insistently, because industrial plant is
   * where ownership is a legal notice rather than a brand.
   */
  const minimum = district === "industrial" ? 18 : 26;
  if (height < minimum) return undefined;
  const likelihood =
    district === "corporate" ? 0.85 : district === "industrial" ? 0.7 : 0.35;
  if (!rng.chance(likelihood)) return undefined;

  const preferred: Record<DistrictId, readonly string[]> = {
    corporate: ["allocation", "vantage", "meridian"],
    commercial: ["meridian", "keelson"],
    residential: ["keelson", "meridian"],
    // The plant floor is the power company's own district, so it owns most
    // of it. A corporation that appears twice in a city is not a presence.
    industrial: ["corrigan", "corrigan", "corrigan", "allocation"],
    undercity: ["vantage", "corrigan"],
  };
  const ids = preferred[district];
  const id = rng.pick(ids);
  return CORPORATIONS.find((c) => c.id === id);
}

/**
 * Skybridges.
 *
 * Structures crossing between buildings are the clearest single signal of
 * architectural chaos that is still art-directed: they only exist where two
 * buildings are genuinely close enough and tall enough to justify one, so the
 * result is tangled where the city is dense and clean where it is not.
 *
 * Generated after placement, because a bridge is a fact about a *pair*.
 */
function skybridges(rng: Rng, structures: readonly Structure[], floor: number): Part[] {
  const out: Part[] = [];
  const MAX_SPAN = 54;

  for (let i = 0; i < structures.length; i += 1) {
    const a = structures[i]!;
    if (a.detail === "far") continue;
    if (!rng.chance(DISTRICTS[a.district].bridges)) continue;

    // Nearest eligible neighbour, not any neighbour: a bridge to the far side
    // of the district would read as a mistake.
    let best: Structure | undefined;
    let bestDistance = Infinity;
    for (let j = i + 1; j < structures.length; j += 1) {
      const b = structures[j]!;
      const distance = Math.hypot(
        a.position[0] - b.position[0],
        a.position[2] - b.position[2],
      );
      if (distance < bestDistance && distance > 14 && distance < MAX_SPAN) {
        best = b;
        bestDistance = distance;
      }
    }
    if (!best) continue;

    // Somewhere both buildings actually reach.
    const ceiling = Math.min(a.size[1], best.size[1]);
    if (ceiling < 26) continue;
    const y = floor + rng.range(ceiling * 0.35, ceiling * 0.8);

    const mx = (a.position[0] + best.position[0]) / 2;
    const mz = (a.position[2] + best.position[2]) / 2;
    const angle = Math.atan2(best.position[2] - a.position[2], best.position[0] - a.position[0]);

    out.push(
      part(
        "bridge",
        [mx, y, mz],
        [bestDistance, rng.range(2.4, 4.6), rng.range(3, 6.5)],
        -angle,
        { signal: "cold", wear: a.wear },
      ),
    );
  }

  return out;
}

/**
 * The landmark.
 *
 * A generated city with no hero is a texture: everything is equally
 * interesting, so nothing is. One structure gets a disproportionate share of
 * the detail budget and stands where the camera is already looking, because
 * that is how a shot acquires a subject.
 *
 * Authored rather than sampled. Its position is derived from the camera's
 * focal direction, its proportions are fixed, and it is the only building in
 * the city that does not take its size from the grid — a landmark that the
 * generator might or might not have produced is not a landmark.
 *
 * Surface only, for now. The other three levels have their own character and
 * the cinematic entry that this is composed for is Phase 6's subject.
 */
function heroFor(level: StratumId, seed: string): Structure | null {
  if (level !== "surface") return null;

  const index = LEVEL_ORDER.indexOf(level);
  const [cx, cz] = cameraAnchorXZ(index);
  // Straight down the camera's line of sight, far enough that the whole
  // tower fits in frame and near enough to dominate it.
  const bearing = cameraBearing(index) + Math.PI;
  // Inside the level's own footprint: a landmark that stands outside the city
  // is a folly on a hill, not a city's tallest building. At this range a
  // 232-metre tower subtends about fifty degrees, so it dominates the frame
  // without leaving it.
  const distance = 150;

  const rng = createRng(`${seed}:hero`);
  return composeBuilding({
    rng,
    level,
    archetype: "tower",
    detail: "hero",
    district: "corporate",
    // The city's largest structure belongs to the company whose name the
    // deepest level already carries.
    owner: CORPORATIONS.find((c) => c.id === "vantage"),
    position: [cx + Math.cos(bearing) * distance, levelFloor(level), cz + Math.sin(bearing) * distance] as const,
    // Wider than anything the grid can produce, so it reads as a landmark in
    // plan as well as in elevation. A tower that is merely taller is a tall
    // tower; a landmark is a different kind of object.
    width: 62,
    depth: 54,
    // Roughly twice the tallest thing the grid will produce, which is what
    // makes it read as the landmark rather than as another tower.
    height: 268,
    rotation: 0.14,
    signal: "amber",
    lit: true,
  });
}

/* -------------------------------------------------------------- fixtures --- */

/**
 * Eye height above a level's floor.
 *
 * Authored per level, because the right eye height is a function of what
 * stands on that level. It lives in the generator rather than in the camera
 * module for the same reason the standing point does: the generator is what
 * has to build a floor under the camera and a ceiling over it, and two copies
 * of this number would be two things to keep in step.
 */
export const EYE_ABOVE_FEET = 1.8;

export const CAMERA_EYE: Record<StratumId, number> = {
  /*
   * Street level, standing in the road.
   *
   * Six and a half, not nine, and the reason is arithmetic rather than taste.
   * The frame's lower edge sits half the vertical field below wherever the
   * camera is pointed, so with a nine-metre eye pitched fifteen degrees up
   * the ground did not enter the shot until thirty-three metres out - and
   * every piece of foreground street hardware the level generates lives
   * between eight and twenty-five. The whole foreground was being built
   * below the bottom of the picture.
   */
  surface: 6.5,
  // On a maintenance deck part-way up the masts. At ninety-six the camera
  // stood above almost everything on the level and framed an empty sky with
  // a deck across the bottom of it; sixty-four puts it inside the canyon,
  // which is where the level's own geometry is.
  interface: 64,
  // On the plant floor, and low enough that the floor itself is in shot.
  // Twenty-one metres put the near ground sixty metres away; the machine
  // blocks are eleven to thirty-eight tall, so eight reads them as masses
  // just as well and keeps the apron in frame.
  engine: 8,
  // Inside a server hall, at the height of the cabinets.
  substrate: 4.4,
};

/**
 * What authored set dressing each level gets.
 *
 * The three things the procedural grid cannot produce, because each is a
 * decision about the shot rather than about a building.
 */
interface FixtureProfile {
  /** Height above the standing surface of the overhead element. */
  gantry: number;
  /** Height of the framing column that closes one edge of the frame. */
  column: number;
  /** Does an elevated transit line run through this level? */
  transit: boolean;
  /** Is this level an interior, and if so how enclosed? */
  enclosure: "hall" | "gantries" | "none";
  /** Does the camera stand on the ground, or on a structure? */
  deck: boolean;
}

const FIXTURES: Record<StratumId, FixtureProfile> = {
  // A street. Overhead signage gantry, a signal column, a transit viaduct
  // crossing the middle distance.
  surface: { gantry: 19, column: 34, transit: true, enclosure: "none", deck: false },
  // Ninety-six metres up, which means the camera is standing on something.
  // A maintenance deck, with railings, and the transit line beyond it.
  interface: { gantry: 16, column: 26, transit: true, enclosure: "none", deck: true },
  // A plant floor: no sky, but no ceiling either — gantries and duct runs
  // crossing overhead, which is what an industrial hall of this size has.
  engine: { gantry: 26, column: 30, transit: false, enclosure: "gantries", deck: false },
  // A hall. This one has a ceiling, and the ceiling is the whole point: the
  // level read as a distant skyline until there was something over it.
  substrate: { gantry: 9, column: 11, transit: false, enclosure: "hall", deck: false },
};

/**
 * The foreground.
 *
 * Street hardware within twenty metres of the lens: barriers, cabinets, a
 * drain, cables, parked vehicles, a signal column that runs out of the top of
 * frame, and a gantry crossing overhead. None of it is a building and none of
 * it is in the way — it is all below eye level except the two pieces that are
 * deliberately above it.
 *
 * This is the single largest composition change in the pass. A shot with
 * nothing in the first twenty metres has no scale reference and no occlusion,
 * so the city behind it reads as a model on a table however large the numbers
 * say it is. Everything here exists to be the thing the eye measures the
 * towers against.
 *
 * Placed relative to the camera's own standing point and its line of sight,
 * so it frames the shot rather than sitting somewhere near it — kept out of
 * the middle by angle, not by luck.
 */
function foregroundSet(
  rng: Rng,
  level: StratumId,
  camera: readonly [number, number],
  look: number,
  base: number,
  density: number,
  out: Part[],
): void {
  const profile = FIXTURES[level];
  const [cx, cz] = camera;

  /*
   * How high the lens sits above the surface everything here stands on.
   *
   * On the ground levels that is the camera's eye height; on the interface,
   * where the camera stands on a deck, it is simply a person's height above
   * that deck. Both of the deliberately-overhead pieces are measured from
   * this rather than from a fixed number, because "overhead" means above the
   * eye, and the eye is at a different height on every level. When the engine
   * floor's camera stood at twenty-one metres, a gantry authored at nineteen
   * was a beam across the middle of the shot.
   */
  const eyeAbove = profile.deck ? EYE_ABOVE_FEET : CAMERA_EYE[level];
  const overhead = Math.max(profile.gantry, eyeAbove + 5.5);
  const columnHeight = Math.max(profile.column, eyeAbove * 1.7);

  /*
   * Street coordinates: `along` the line of sight, `lateral` across it.
   *
   * The first version of this placed everything by bearing and distance,
   * which is the natural way to think about a camera and the wrong way to
   * think about a street. A kerb is a straight line parallel to the road, not
   * an arc at a constant angle — and worse, a bearing of a radian puts an
   * object sixty degrees off axis, which at the lens this world uses is
   * outside the frame entirely. Half the foreground was being generated
   * where nobody could see it.
   *
   * Yaw is `-look` because a rotation about Y sends a box's local +X to
   * (cos, -sin): negating the bearing is what makes local X run *along* the
   * street, which is what a kerb, a cable tray and a parked car all want.
   */
  const ACROSS = look + Math.PI / 2;
  const place = (
    kind: PartKind,
    along: number,
    lateral: number,
    y: number,
    size: readonly [number, number, number],
    extra: Partial<Part> = {},
  ) => {
    out.push(
      part(
        kind,
        [
          cx + Math.cos(look) * along + Math.cos(ACROSS) * lateral,
          base + y,
          cz + Math.sin(look) * along + Math.sin(ACROSS) * lateral,
        ],
        size,
        -look + (extra.rotation ?? 0),
        extra,
      ),
    );
  };

  // --- the deck the camera stands on, where it is not the ground ---------
  // `base` is the walking surface, so everything below is measured from the
  // camera's feet rather than from its eye — which is the difference between
  // a railing at chest height and a railing across the middle of the frame.
  if (profile.deck) {
    /*
     * Mostly behind the lens.
     *
     * Centred four metres ahead, the deck filled the bottom third of the
     * frame with one flat plate and pushed the city into the upper half. A
     * camera standing near the *front* edge of a platform sees a strip of it
     * and then the drop, which is both the better composition and what
     * standing at a railing actually looks like — so the deck is centred
     * slightly behind the camera and its front edge is six metres out.
     */
    place("platform", -1, 0, -0.75, [13, 1.2, 15]);
    // Railings: both flanks and, crucially, the far edge. The front railing
    // is the one that reads — it is the line between "standing on a
    // structure" and "floating above a city".
    //
    // Posts and rails, not a panel. A solid box at chest height is a
    // parapet, and a parapet an arm's length from the lens is a wall.
    for (const side of [-1, 1]) {
      place("prop", -1, side * 6, 1.05, [15, 0.09, 0.09]);
      place("prop", -1, side * 6, 0.6, [15, 0.06, 0.06]);
      for (let i = -2; i <= 2; i += 1) {
        place("prop", -1 + i * 3.4, side * 6, 0.55, [0.09, 1.1, 0.09]);
      }
    }
    // No extra yaw: the length is already in Z, which is the axis that runs
    // across the street. A quarter turn here would send the front railing
    // down the middle of the deck instead of along its edge.
    place("prop", 6, 0, 1.05, [0.09, 0.09, 12]);
    place("prop", 6, 0, 0.6, [0.06, 0.06, 12]);
    for (let i = -2; i <= 2; i += 1) {
      place("prop", 6, i * 2.8, 0.55, [0.09, 1.1, 0.09]);
    }
    // And the trusses under it, visible over the edge. Low and barely
    // canted: a tilt is a lever and the long axis is the arm, so a
    // fifteen-metre member at a steep angle comes back up through the deck
    // it is meant to be holding.
    for (let i = -1; i <= 1; i += 1) {
      place("fin", -1 + i * 4, 0, -3.4, [0.7, 2.6, 15], { tilt: 0.08 * i });
    }
  }

  // --- kerb line, both flanks --------------------------------------------
  const barriers = Math.max(3, Math.round(7 * density));
  for (const side of [-1, 1]) {
    for (let i = 0; i < barriers; i += 1) {
      place(
        "prop",
        8 + i * rng.range(2.6, 3.4),
        side * rng.range(5.2, 6.4),
        0.55,
        [1.6, 1.1, 0.26],
        { rotation: rng.range(-0.06, 0.06), wear: rng.range(0.5, 1) },
      );
    }
  }

  // --- utility hardware, close and low ------------------------------------
  const boxes = Math.max(2, Math.round(5 * density));
  for (let i = 0; i < boxes; i += 1) {
    const side = rng.chance(0.5) ? 1 : -1;
    place(
      "prop",
      rng.range(7, 18),
      side * rng.range(6.5, 9),
      rng.range(0.7, 1.2),
      [rng.range(1.1, 2.2), rng.range(1.4, 2.4), rng.range(0.8, 1.4)],
      { rotation: rng.range(-0.2, 0.2), wear: rng.range(0.4, 1) },
    );
  }

  // A drain and a service cover in the road itself — flat, dead ahead, and
  // the only foreground piece allowed in the middle of the frame because it
  // is ankle high.
  place("prop", rng.range(11, 16), rng.range(-2, 2), 0.06, [1.4, 0.12, 1.4], {
    wear: 1,
  });

  // --- parked vehicles at the kerb ----------------------------------------
  if (!profile.deck) {
    const cars = Math.max(1, Math.round(3 * density));
    for (let i = 0; i < cars; i += 1) {
      const side = rng.chance(0.5) ? 1 : -1;
      place(
        "prop",
        11 + i * rng.range(6, 7.5),
        side * rng.range(7.5, 9),
        0.7,
        [4.6, 1.4, 2],
        { rotation: rng.range(-0.05, 0.05), wear: rng.range(0.4, 0.9) },
      );
    }
  }

  // --- the framing column -------------------------------------------------
  // One large near object running out of the top of the frame. It occludes an
  // edge, it is unmistakably close, and it is what tells the eye how far away
  // everything behind it is — placed just inside the frame rather than at
  // the sixty degrees off axis that put the last one outside it.
  const columnSide = rng.chance(0.5) ? 1 : -1;
  // Further out and thinner than the first attempt, which put a two-metre
  // slab eleven metres from the lens and gave a fifth of the frame to a
  // featureless grey rectangle. Foreground occlusion is meant to be partial.
  const columnAlong = rng.range(14, 18);
  const columnLateral = columnSide * rng.range(8.5, 10.5);
  place("fin", columnAlong, columnLateral, columnHeight / 2, [1.5, columnHeight, 1.5]);
  // Brackets up its length, and the cable tray it carries out over the
  // street. A bare extrusion at this distance is a grey bar; three flanges
  // and a tray make it read as a structure that does something.
  for (let i = 1; i <= 3; i += 1) {
    place("platform", columnAlong, columnLateral, columnHeight * (i / 4), [
      2.6,
      0.32,
      2.6,
    ]);
  }
  place("platform", columnAlong, columnLateral * 0.72, columnHeight * 0.62, [
    0.7,
    0.35,
    6.5,
  ]);
  place("prop", columnAlong + 1.2, columnLateral * 0.8, columnHeight * 0.58, [
    9,
    0.3,
    0.3,
  ]);
  // A hazard plate on it, at the height a person would read one.
  place("sign", columnAlong - 1, columnLateral, 2.6, [0.9, 0.55, 0.2], {
    signal: "amber",
    emissive: 0.55,
    wear: 1,
  });

  // --- the overhead gantry -------------------------------------------------
  // Crossing the street above the camera. This closes the top of the frame,
  // which is the half of the composition a ground-level shot usually loses.
  //
  // The length goes in Z and the yaw is left alone. The first attempt added a
  // quarter turn "to cross the street" and did the opposite — it sent a
  // thirty-four-metre beam straight down the line of sight, where it rendered
  // as a black spike through the middle of the hero tower.
  //
  // One beam, not two, and further out than it was: a pair of one-metre
  // girders twenty metres away turned the top of every shot into a gateway.
  const gantryAlong = rng.range(26, 34);
  place("bridge", gantryAlong, 0, overhead, [0.75, 0.75, 32]);
  for (const side of [-1, 1]) {
    place("fin", gantryAlong, side * 15, overhead * 0.5, [0.9, overhead, 0.9]);
  }
  // What hangs off it: a signal head and two directional plates. Small,
  // bright, and the reason the gantry reads as equipment and not as a beam.
  for (let i = -1; i <= 1; i += 1) {
    place(
      "sign",
      gantryAlong,
      i * 6,
      overhead - 1.5,
      i === 0 ? [1.6, 1.2, 0.3] : [2.6, 0.9, 0.3],
      {
        signal: i === 0 ? "amber" : "cold",
        emissive: i === 0 ? 0.9 : 0.55,
        wear: 0.7,
      },
    );
  }

  // --- cable runs ----------------------------------------------------------
  // Slung across the street, above the eye. Cheap, and nothing says "this
  // place was wired by whoever needed it wired" more economically — as long
  // as they run across the view rather than down it.
  const cables = Math.max(2, Math.round(3 * density));
  for (let i = 0; i < cables; i += 1) {
    place(
      "prop",
      rng.range(13, 30),
      rng.range(-3, 3),
      rng.range(eyeAbove + 3.4, overhead),
      [0.14, 0.14, rng.range(24, 34)],
      { tilt: rng.range(-0.04, 0.04) },
    );
  }
}

/**
 * The transit spine: a guideway, the columns under it, and one station.
 *
 * The previous pass ran a lane of light through the air and nothing else, and
 * it read exactly as what it was — a road that happened to be flying. A
 * transport system is legible from its infrastructure, not from its vehicles,
 * so this builds the infrastructure and lets the existing traffic system run
 * on it.
 *
 * One station rather than a lot of track. A single convincing piece of
 * infrastructure states the fact; a kilometre of generic guideway only
 * repeats it.
 */
function transitSpine(
  rng: Rng,
  floor: number,
  look: number,
  density: number,
  out: Part[],
): void {
  const { radius, height, deck } = TRANSIT;
  const y = floor + height;

  // The guideway sweeps across the view. Centred on the camera's sight line,
  // so the station lands dead ahead and the track leaves frame both ways.
  const segments = Math.max(7, Math.round(16 * density));
  const sweep = 1.6;
  const step = sweep / segments;
  const chord = 2 * radius * Math.sin(step / 2) * 1.02;

  for (let i = 0; i < segments; i += 1) {
    const a = look - sweep / 2 + step * (i + 0.5);
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    // A box whose local X runs along the tangent. The yaw is negated because
    // a rotation about Y sends +X to (cos, -sin).
    const yaw = -(a + Math.PI / 2);

    // The deck.
    out.push(
      part("bridge", [x, y, z], [chord, 1.6, deck], yaw, { wear: rng.range(0.3, 0.7) }),
    );
    // Guide rails along both edges. Two thin lines on a deck are what make it
    // read as track rather than as a road.
    for (const side of [-1, 1]) {
      out.push(
        part(
          "fin",
          [
            x + Math.cos(a) * side * (deck / 2 - 0.5),
            y + 1.1,
            z + Math.sin(a) * side * (deck / 2 - 0.5),
          ],
          [chord, 0.55, 0.45],
          yaw,
          { wear: rng.range(0.3, 0.7) },
        ),
      );
    }
    // A column every third bay, with a capital and a canted brace.
    if (i % 3 === 1) {
      out.push(
        part("pipe", [x, floor + height / 2, z], [3, height, 3], yaw, {
          wear: rng.range(0.4, 0.9),
        }),
      );
      out.push(
        part("platform", [x, y - 1.4, z], [7, 1, deck + 2.5], yaw, {
          wear: rng.range(0.4, 0.9),
        }),
      );
      for (const side of [-1, 1]) {
        out.push(
          part(
            "fin",
            [x + Math.cos(a) * side * 2.4, y - 6, z + Math.sin(a) * side * 2.4],
            [0.6, 9, 0.6],
            yaw,
            { tilt: 0.42 * side, wear: rng.range(0.4, 0.9) },
          ),
        );
      }
    }
    // Underside lighting, which is most of what makes a viaduct read at
    // night — the structure is dark, the line under it is not.
    if (i % 2 === 0) {
      out.push(
        part("sign", [x, y - 1, z], [chord * 0.9, 0.22, 0.3], yaw, {
          signal: "cold",
          emissive: 0.5,
          wear: 0.5,
        }),
      );
    }
  }

  /* --- the station ------------------------------------------------------ */
  const a = look;
  const sx = Math.cos(a) * radius;
  const sz = Math.sin(a) * radius;
  const yaw = -(a + Math.PI / 2);
  /** A point on the platform: `t` along the track, `o` across it. */
  const along = (t: number, o: number): readonly [number, number] => [
    sx + Math.cos(a + Math.PI / 2) * t + Math.cos(a) * o,
    sz + Math.sin(a + Math.PI / 2) * t + Math.sin(a) * o,
  ];

  const p = (
    kind: PartKind,
    t: number,
    o: number,
    yy: number,
    size: readonly [number, number, number],
    extra: Partial<Part> = {},
  ) => {
    const [px, pz] = along(t, o);
    out.push(part(kind, [px, yy, pz], size, yaw, extra));
  };

  // Platform: wider than the track, and long enough to be a place.
  p("platform", 0, 0, y + 0.4, [38, 1.4, 17], { wear: 0.35 });
  // Canopy, canted, on its own columns.
  p("platform", 0, 0, y + 8.4, [36, 0.7, 15], { tilt: 0.07, wear: 0.4 });
  for (let i = -2; i <= 2; i += 1) {
    for (const side of [-1, 1]) {
      p("mast", i * 8, side * 6, y + 4.5, [0.55, 8, 0.55], { wear: 0.4 });
    }
  }
  // Platform edge lighting, both faces.
  for (const side of [-1, 1]) {
    p("sign", 0, side * 7.6, y + 1.3, [36, 0.3, 0.4], {
      signal: "cold",
      emissive: 0.75,
      wear: 0.3,
    });
  }
  // The lit soffit under the platform: the station's own glow, falling on
  // whatever is below it.
  p("sign", 0, 0, y - 0.6, [34, 0.4, 12], { signal: "amber", emissive: 0.62, wear: 0.3 });

  // The vertical core that connects it to the ground, with the escalator run
  // canted off it. Without this the platform is a slab in the sky.
  p("fin", 20, 0, floor + height / 2, [8, height, 9], { wear: 0.5 });
  p("platform", 12, 0, floor + height * 0.5, [22, 1, 4.6], { tilt: 0.86, wear: 0.5 });
  p("sign", 20, -4.8, floor + 4, [3.2, 2.4, 0.4], {
    signal: "amber",
    emissive: 0.8,
    wear: 0.4,
  });

  // Service machinery on the platform, and the signal gantry over the track.
  for (let i = 0; i < 3; i += 1) {
    p("roofUnit", -14 + i * 5, rng.range(-4, 4), y + 2.4, [2.4, 2.2, 2], {
      wear: rng.range(0.4, 0.8),
    });
  }
  p("bridge", -21, 0, y + 6.5, [1, 1, 16], { wear: 0.6 });

  // The operator's mark on the station. Transit belongs to Meridian
  // Interchange, and this is the one place in the city where the owner of a
  // piece of infrastructure is stated at the point of use.
  const meridian = CORPORATIONS.find((c) => c.id === "meridian");
  if (meridian) {
    const [mx, mz] = along(-20, -8.4);
    corporateMark(meridian, mx, y + 6.4, mz, 6.5, yaw, 0.92, out);
  }
}

/**
 * The enclosure: what is over the camera's head on the levels that are
 * interiors.
 *
 * The review's first and largest finding was that the substrate read as a
 * distant industrial skyline rather than as a place you are standing inside.
 * The cause was simple and structural — the level had a floor, buildings and
 * fog, and nothing at all above it, so the eye had no reason to read it as
 * anything but an exterior at night.
 *
 * A ceiling fixes that in one move, and a ceiling with piers, duct runs and
 * strip lighting fixes it convincingly: those are what tell you the span of
 * the room, and the span of the room is what makes it a megastructure rather
 * than a basement.
 */
function enclosure(
  rng: Rng,
  level: StratumId,
  floor: number,
  span: number,
  density: number,
  out: Part[],
): void {
  const mode = FIXTURES[level].enclosure;
  if (mode === "none") return;

  const half = span / 2;
  // The engine floor's camera stands twenty-one metres up, so its overhead
  // structure has to clear that by a real margin — at thirty, two-hundred-
  // and-fifty-metre duct runs converged on the vanishing point like a
  // starburst and were the loudest thing in the level.
  const height = mode === "hall" ? 16 : 44;

  if (mode === "hall") {
    // Ceiling plates on a coarse grid, with a gap at the centre so the shaft
    // the camera descends stays open — the one hole in the ceiling is also
    // the only light from above, which is a better reason for it than "the
    // camera needs to get through".
    const cells = 4;
    const plate = span / cells;
    for (let i = 0; i < cells; i += 1) {
      for (let j = 0; j < cells; j += 1) {
        const x = -half + plate * (i + 0.5);
        const z = -half + plate * (j + 0.5);
        if (Math.hypot(x, z) < levelVoidRadius(level) * 0.9) continue;
        out.push(
          part("platform", [x, floor + height, z], [plate * 0.98, 1.4, plate * 0.98], 0, {
            wear: rng.range(0.5, 0.9),
          }),
        );
      }
    }
    // Piers. Square section, standing clear of the shaft, and the thing that
    // states the span: a room whose roof is held up is a room with a size.
    const piers = Math.max(4, Math.round(10 * density));
    for (let i = 0; i < piers; i += 1) {
      const a = (i / piers) * Math.PI * 2 + 0.3;
      const inner = levelVoidRadius(level);
      const r = inner + 8 + (i % 2) * (half - inner - 20);
      out.push(
        part(
          "fin",
          [Math.cos(a) * r, floor + height / 2, Math.sin(a) * r],
          [4.5, height, 4.5],
          a,
          { wear: rng.range(0.6, 1) },
        ),
      );
      // The capital where it meets the plate.
      out.push(
        part(
          "platform",
          [Math.cos(a) * r, floor + height - 1.6, Math.sin(a) * r],
          [9, 1.2, 9],
          a,
          { wear: rng.range(0.6, 1) },
        ),
      );
    }
  }

  // Duct runs and cable trays crossing overhead, on both interior levels.
  // Horizontal cylinders: the tilt field is what makes a pipe lie down.
  const ducts = Math.max(3, Math.round((mode === "hall" ? 7 : 4) * density));
  const bore: readonly [number, number] = mode === "hall" ? [1, 1.9] : [0.7, 1.2];
  for (let i = 0; i < ducts; i += 1) {
    const a = (i / ducts) * Math.PI + rng.range(-0.2, 0.2);
    const offset = rng.range(-half * 0.5, half * 0.5);
    out.push(
      part(
        "pipe",
        [
          Math.cos(a + Math.PI / 2) * offset,
          floor + height - rng.range(2.5, 5),
          Math.sin(a + Math.PI / 2) * offset,
        ],
        [rng.range(bore[0], bore[1]), span * 0.92, rng.range(bore[0], bore[1])],
        -a,
        { tilt: Math.PI / 2, wear: rng.range(0.6, 1) },
      ),
    );
  }

  // Strip lighting under the ceiling. Emissive, cold, and unevenly spaced,
  // because a service ceiling is lit where the work is and not elsewhere.
  // Short runs where there is no ceiling to mount them on continuously: on
  // the engine floor a hundred-metre bar of light is not a fitting, it is a
  // stripe drawn across the sky.
  const stripSpan: readonly [number, number] =
    mode === "hall" ? [0.3, 0.5] : [0.1, 0.18];
  const strips = Math.max(3, Math.round((mode === "hall" ? 9 : 14) * density));
  for (let i = 0; i < strips; i += 1) {
    const a = (i / strips) * Math.PI + 0.4;
    const offset = rng.range(-half * 0.6, half * 0.6);
    out.push(
      part(
        "sign",
        [
          Math.cos(a + Math.PI / 2) * offset,
          floor + height - rng.range(1.6, 2.4),
          Math.sin(a + Math.PI / 2) * offset,
        ],
        [span * rng.range(stripSpan[0], stripSpan[1]), 0.28, 0.6],
        -a,
        // Dim. A service ceiling is lit enough to work under and no more;
        // at 0.7 these read as a lattice of white bars rather than as light.
        { signal: "cold", emissive: rng.range(0.26, 0.44), wear: 0.5 },
      ),
    );
  }

  if (mode === "gantries") {
    // No ceiling, but the crane rails and walkways an industrial hall of this
    // size would be spanned by. They close the top of the frame without
    // closing the level in.
    const spans = Math.max(2, Math.round(5 * density));
    for (let i = 0; i < spans; i += 1) {
      const a = (i / spans) * Math.PI + 0.6;
      out.push(
        // Upward from the nominal height, never down into it. The engine
        // floor's camera stands twenty-one metres up, so a crane rail that
        // varied *below* thirty put a beam across the middle of the shot.
        part("bridge", [0, floor + height + rng.range(0, 7), 0], [span * 0.95, 2.2, 4], -a, {
          wear: rng.range(0.6, 1),
        }),
      );
    }
  }
}

/** Everything authored for a level that is not a building. */
function levelFixtures(
  seed: string,
  level: StratumId,
  floor: number,
  span: number,
  camera: readonly [number, number],
  look: number,
  density: number,
): Part[] {
  const out: Part[] = [];
  const rng = createRng(`${seed}:${level}:fixtures`);
  const profile = FIXTURES[level];

  // The walking surface: the ground, or — where the camera is ninety-six
  // metres up — the deck it is standing on, which is an eye height below it.
  const standing = floor + (profile.deck ? CAMERA_EYE[level] - EYE_ABOVE_FEET : 0);
  foregroundSet(rng, level, camera, look, standing, density, out);
  if (profile.transit) transitSpine(rng, floor, look, density, out);
  enclosure(rng, level, floor, span, density, out);

  return out;
}

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

  const index = LEVEL_ORDER.indexOf(level);
  const camera = cameraAnchorXZ(index);
  // The camera looks across the shaft, so the clear cone points back through
  // the origin.
  const look = cameraBearing(index) + Math.PI;
  const { cells, step } = placements(
    rng,
    Math.floor(budget.structures * profile.structureShare),
    profile.rows,
    SPAN * profile.spanScale,
    camera,
    look,
    profile.voidScale,
  );

  // A footprint may not exceed what its cell can hold, minus the street. The
  // podium flares wider than the shaft, so the ceiling accounts for that too.
  const maxFootprint = Math.min(profile.footprint[1], step * 0.52);
  const minFootprint = Math.min(profile.footprint[0], maxFootprint * 0.6);

  const structures: Structure[] = cells.map((cell, i) => {
    const w = rng.range(minFootprint, maxFootprint);
    const d = profile.rows
      ? w * rng.range(2.4, 3.6)
      : w * rng.range(0.72, 1.32);
    const h = rng.skewed(profile.height[0], profile.height[1], profile.height[2]);
    const district = districtFor(level, cell.x, cell.z);
    const composed = composeBuilding({
      rng,
      level,
      archetype: profile.rows ? "rack" : rng.pick(profile.kinds),
      detail: detailFor(cell.x, cell.z, camera, budget),
      district,
      owner: ownerFor(rng, district, h),
      position: [cell.x, floor, cell.z] as const,
      width: w,
      depth: d,
      height: h,
      // Rows are orderly; everything else is a few degrees off true.
      rotation: profile.rows ? 0 : rng.range(-0.06, 0.06),
      signal: DISTRICTS[district].signal,
      // The district decides how much of a facade burns light overnight. A
      // corporate tower is lit because nobody is paying attention to the bill.
      lit: rng.chance(DISTRICTS[district].litShare * profile.litShare * 1.6),
    });
    return { ...composed, id: `${level}-${i}` };
  });

  const hero = heroFor(level, seed);
  if (hero) {
    // The landmark gets a skirt of secondary structures — a plinth of lower
    // masses around its base. A tower standing alone on a plane reads as a
    // model; one growing out of its own podium complex reads as a place that
    // was built around something.
    const skirtRng = createRng(`${seed}:hero-skirt`);
    const [hx, , hz] = hero.position;
    const skirt: Part[] = [];
    for (let i = 0; i < 7; i += 1) {
      const angle = (i / 7) * Math.PI * 2 + skirtRng.range(-0.3, 0.3);
      const radius = 46 + skirtRng.range(0, 26);
      const w = skirtRng.range(14, 30);
      const h = skirtRng.range(16, 52);
      skirt.push(
        part(
          "mass",
          [
            hx + Math.cos(angle) * radius,
            levelFloor(level) + h / 2,
            hz + Math.sin(angle) * radius,
          ],
          [w, h, skirtRng.range(14, 30)],
          skirtRng.range(-0.3, 0.3),
          {
            signal: "cold",
            variant: skirtRng.int(0, 3),
            wear: skirtRng.range(0.05, 0.3),
          },
        ),
      );
    }
    structures.unshift({
      ...hero,
      id: `${level}-hero`,
      parts: [...hero.parts, ...skirt],
    });
  }

  // Skybridges are a property of pairs, so they are generated once the whole
  // level is placed and hung on the first structure of the pair.
  if (!profile.rows && structures.length > 1) {
    const bridges = skybridges(rng, structures, floor);
    if (bridges.length > 0) {
      structures[0] = {
        ...structures[0]!,
        parts: [...structures[0]!.parts, ...bridges],
      };
    }
  }

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
    fixtures: levelFixtures(
      seed,
      level,
      floor,
      SPAN * profile.spanScale,
      camera,
      look,
      budget.fixtureDetail,
    ),
    lights,
    conduits: conduits(rng, level, profile, budget.conduitsPerLevel),
    anchors: anchorsFor(level),
    skyline: skyline(rng, level, budget.skyline),
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
      parts: count(
        (l) =>
          l.structures.reduce((sum, st) => sum + st.parts.length, 0) +
          l.fixtures.length,
      ),
      lights: count((l) => l.lights.length),
      conduits: count((l) => l.conduits.length),
      anchors: count((l) => l.anchors.length),
      skyline: count((l) => l.skyline.length),
      /**
       * An upper bound on the draw calls the static city will issue.
       *
       * Recounted this phase, because the previous figure was an
       * approximation that had drifted: it said "seven part kinds plus four"
       * and by then there were nine kinds and six fixed meshes it did not
       * mention. Undercounting a budget is the same failure as overcounting
       * one, so this is now enumerated against what the scene actually
       * declares:
       *
       *   11  one instanced mesh per kit piece kind
       *    4  merged facade meshes, one per texture variant
       *    1  accent lights   1  conduits   1  street   2  skyline
       *       plus rain, traffic, steam, light pooling and contact shade
       *
       * The number that matters is that it is *fixed* — it does not grow with
       * the size of the city. Every building on every level, and every
       * authored fixture, shares the same instanced meshes, so a denser city
       * costs instances and never draw calls.
       */
      drawCalls:
        11 +
        4 +
        5 +
        (environmentBudget(tier).rain > 0 ? 1 : 0) +
        (environmentBudget(tier).traffic > 0 ? 1 : 0) +
        (environmentBudget(tier).groundFx ? 1 : 0) +
        (environmentBudget(tier).contactShade ? 1 : 0) +
        1,
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
