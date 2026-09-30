import { LEVEL_ORDER } from "@/data/routes";
import type { StratumId } from "@/data/types";
import { CAMERA_EYE, EYE_ABOVE_FEET, cameraAnchorXZ, cameraBearing } from "./generate";
import type { LevelEnvironment, LightSource, Part, Structure } from "./types";
import { LAMP_REACH_SQ } from "./weather";

/* ---------------------------------------------------------------------------
 * Who uses this place.
 *
 * The city has depth, weather, materials and route-aware landmarks, and it is
 * still a set. Everything in it was built by someone and is maintained by
 * someone, and none of that is visible: the platform has no one waiting on it,
 * the plant floor has no one operating it, and the only thing that moves at
 * street level is traffic, which is people in boxes.
 *
 * The answer is not a character system. It is the same answer the traffic
 * uses: at the distance a reader actually views this from, a person is a dark
 * shape that moves with intent, and intent is entirely a matter of *where*
 * they are and *what they are doing there*. A figure standing at the edge of
 * a platform is a commuter. The same figure in the middle of a road is a bug.
 *
 * So the placement is the whole content of this file, and the renderer is left
 * with a quad and a time uniform. No three.js, no DOM, assertable in Node.
 * ------------------------------------------------------------------------- */

/**
 * The kinds of place where people are.
 *
 * Authored zones rather than scattered points, because a scattered crowd is
 * noise: the reader learns nothing from a person standing alone in a road,
 * and learns the whole social structure of a level from five people queuing
 * at a platform edge while one walks a service deck below them.
 */
export type ZoneKind =
  /** The transit platform: arrive, wait, board, gone. */
  | "platform"
  /** Street level in front of the lens: people crossing the frame. */
  | "crossing"
  /** Around machinery: operators and maintenance, staying with the plant. */
  | "service"
  /** The foot of a corporate tower: sparse, orderly, in and out. */
  | "entrance"
  /** Deep infrastructure: one person, a long way from anyone else. */
  | "maintenance";

/**
 * How many of the level's people each kind of place gets, as a weight.
 *
 * This table is the hierarchy the brief asks for, stated once. A transit
 * platform is where a city is most obviously used and a substrate service run
 * is where it is least, and the ratio between those two numbers is the whole
 * difference between "commuter hub" and "nobody should be down here".
 *
 * Corporate entrances are deliberately near the bottom. A tower lobby at
 * night has a guard and someone leaving late, not a crowd — and the sparseness
 * *is* the characterisation, so raising it to make the towers livelier would
 * delete the point.
 */
export const ZONE_WEIGHT: Record<ZoneKind, number> = {
  platform: 1,
  crossing: 0.72,
  service: 0.5,
  entrance: 0.22,
  maintenance: 0.18,
};

/** Priority order. Lower tiers keep the front of this list and drop the tail. */
export const ZONE_PRIORITY: readonly ZoneKind[] = [
  "platform",
  "crossing",
  "service",
  "entrance",
  "maintenance",
];

/**
 * How each kind of place behaves, as the two numbers the shader needs.
 *
 * `travel` is how far a figure moves over one cycle, in metres, and `dwell`
 * is the fraction of that cycle spent standing. Between them they cover every
 * behaviour the brief describes without a state machine anywhere:
 *
 *  - a commuter walks onto a platform, waits most of a cycle, then steps to
 *    the edge and is gone — `travel` 9, `dwell` 0.52;
 *  - a pedestrian crosses the frame and does not stop — `travel` 17,
 *    `dwell` 0;
 *  - an operator stays with the machine they are working on, moving a couple
 *    of metres — `travel` 3.4, `dwell` 0.62;
 *  - one person on a substrate service run barely moves at all.
 *
 * The dwell is also what keeps the level from looking like a conveyor: a
 * street where everybody is walking and nobody is standing reads as traffic.
 */
export const ZONE_BEHAVIOUR: Record<ZoneKind, { travel: number; dwell: number }> = {
  platform: { travel: 9, dwell: 0.52 },
  crossing: { travel: 17, dwell: 0 },
  service: { travel: 3.4, dwell: 0.62 },
  entrance: { travel: 7.5, dwell: 0.18 },
  maintenance: { travel: 2.6, dwell: 0.78 },
};

/**
 * Which way the camera is actually looking.
 *
 * `cameraBearing` is where the camera *stands*, as a bearing from the middle
 * of the world, and the camera looks back across the middle rather than out
 * of it — so the direction it faces is half a turn from where it is. The
 * generator has said so in one line since the fixtures were written, and the
 * first draft of this file ignored it and placed every pedestrian crossing
 * directly behind the lens. Measuring found it; reading would have.
 */
function viewDirection(level: StratumId): number {
  return cameraBearing(LEVEL_ORDER.indexOf(level)) + Math.PI;
}

/**
 * How far off the camera's sight line a zone may be and still be authored.
 *
 * The lesson the foreground set learned the expensive way, applied before it
 * has to be learned again: this world is composed around one camera per level,
 * and a bearing of a radian puts a thing outside the frame entirely. Placing
 * people evenly around a 360° city would spend the whole budget behind the
 * lens and leave the shot exactly as empty as it started.
 *
 * Seventy degrees: wider than the lens, because the camera drifts, and because
 * a figure entering frame from just outside it is worth more than one already
 * standing in the middle.
 */
export const VIEW_ARC = 1.22;

/** Past this, a person is fewer than a handful of pixels and costs fill rate. */
export const ZONE_MAX_RANGE = 165;

/** A person is between these two heights, in metres. */
export const FIGURE_MIN_HEIGHT = 1.58;
export const FIGURE_MAX_HEIGHT = 1.92;

/**
 * The most people one place can hold at once.
 *
 * The cap is what turns a budget into a composition. Without it the level
 * budget divides by however many zones happen to exist, which on the first
 * measured run put thirty people on a single pedestrian crossing and
 * twenty-four around one machine — a protest and a shift change rather than a
 * street and a plant floor. A platform holds a crowd; a machine face holds
 * the two people working on it, and no budget should be able to argue.
 *
 * It is also the bound: the number of figures on a level can never exceed the
 * sum of the caps of its zones, whatever a tier asks for.
 */
export const ZONE_CAP: Record<ZoneKind, number> = {
  platform: 16,
  crossing: 7,
  service: 3,
  entrance: 3,
  maintenance: 2,
};

/**
 * And the most places of each kind a level may have.
 *
 * The substrate offered twenty-six maintenance posts, because it is a server
 * hall and every rack in it is something somebody looks after. Twenty-six
 * posts is not isolated service activity, it is a workforce — so the nearest
 * few to the camera survive and the rest are places nobody happens to be
 * tonight, which is both cheaper and truer.
 */
export const ZONE_LIMIT: Record<ZoneKind, number> = {
  platform: 1,
  crossing: 2,
  service: 4,
  entrance: 3,
  maintenance: 3,
};

/**
 * How occupied each level is, against the tier's count for the busiest one.
 *
 * The brief asks that density communicate hierarchy, and this is where it
 * says so. A street under a station is the most used place in the city and a
 * substrate service run is the least, and the ratio between the two numbers
 * below is the whole difference between "commuter city" and "nobody should be
 * down here". Without it every level received the same count and the deepest
 * level was as busy as the street, which is the exact failure the brief names
 * as populating every district equally.
 */
export const LEVEL_OCCUPANCY: Record<StratumId, number> = {
  surface: 1,
  interface: 0.85,
  engine: 0.42,
  substrate: 0.14,
};

/** One authored place where people are, and what they are doing there. */
export interface Zone {
  kind: ZoneKind;
  /** Centre of the cluster, on the surface people are standing on. */
  x: number;
  y: number;
  z: number;
  /** The direction activity runs in, in radians. */
  bearing: number;
  /** Half-width across the bearing: how spread out the cluster is. */
  spread: number;
}

/** One person, resolved against the place they are in. */
export interface Figure {
  kind: ZoneKind;
  /** Where this figure's path is centred. */
  x: number;
  y: number;
  z: number;
  /** The direction they walk in, in radians. */
  bearing: number;
  /** How far they cover over one cycle, in metres. */
  travel: number;
  /** Fraction of the cycle spent standing. */
  dwell: number;
  /** Cycles per second. */
  rate: number;
  /** Where in the cycle they start. */
  phase: number;
  height: number;
  /** What is lighting them, if anything is. */
  source: LightSource | null;
}

/** A lamp, with the height it hangs at. */
interface Fixture {
  x: number;
  y: number;
  z: number;
  emissive: number;
  source: LightSource;
}

/**
 * Every lamp on the level, kept in three dimensions.
 *
 * Deliberately not the weather module's list, and the difference is the
 * reason this exists. Rain falls down a column to the floor, so it asks which
 * lamps are low enough to light the column — a flat question with a height
 * filter on it. A person is at a point, and the interface's people are on a
 * transit deck thirty-five metres up and a maintenance deck sixty-two metres
 * up, where every lamp near them is far above the level's floor. Measured
 * with the weather rule, not one figure on that entire level was lit by
 * anything: the platform edge lighting they were standing directly under was
 * filtered out for being too high above a floor nobody was standing on.
 *
 * Measuring in three dimensions removes the need for the height filter
 * altogether. A lit window two hundred metres up fails the distance test on
 * its own, which is what the height filter was approximating.
 */
function lamps(band: LevelEnvironment): Fixture[] {
  const out: Fixture[] = [];
  const consider = (p: Part): void => {
    if (p.emissive <= 0.5) return;
    out.push({
      x: p.position[0],
      y: p.position[1],
      z: p.position[2],
      emissive: p.emissive,
      source: p.source ?? (p.signal === "cold" ? "machine" : "interior"),
    });
  };
  for (const p of band.fixtures) consider(p);
  for (const st of band.structures) for (const p of st.parts) consider(p);
  return out;
}

/**
 * What is lighting someone standing here.
 *
 * Brightness over distance, which is how anything gets its colour: a dim lamp
 * three metres away beats a bright one at twenty-five. Measured from the
 * chest rather than the feet, because that is the part of a figure a reader
 * is looking at.
 */
function litBy(fixtures: readonly Fixture[], x: number, y: number, z: number) {
  let best: LightSource | null = null;
  let score = 0;
  for (const l of fixtures) {
    const d2 = (l.x - x) ** 2 + (l.y - y) ** 2 + (l.z - z) ** 2;
    if (d2 > LAMP_REACH_SQ) continue;
    const s = l.emissive / (1 + d2 * 0.012);
    if (s > score) {
      score = s;
      best = l.source;
    }
  }
  return best;
}

/** The surface a figure on this level is standing on. */
function standing(band: LevelEnvironment, level: StratumId): number {
  // The interface camera stands on a maintenance deck rather than on the
  // level's floor, which is ninety-six metres of air below it. Anyone walking
  // about up there is walking on the deck.
  return band.floor + (level === "interface" ? CAMERA_EYE[level] - EYE_ABOVE_FEET : 0);
}

/** Signed angle between two bearings, in [-pi, pi]. */
function delta(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * The station platform, found in the geometry rather than recomputed.
 *
 * The generator already decides where the station goes, and a second copy of
 * that arithmetic here would be a thing to keep in sync forever. The station
 * deck is the one `platform` part that is both high above the floor and long
 * enough to be a place — every other platform in the kit is a facade band, a
 * setback shelf or a balcony.
 */
function platformZone(band: LevelEnvironment): Zone | null {
  let best: Part | null = null;
  for (const p of band.fixtures) {
    if (p.kind !== "platform") continue;
    const length = Math.max(p.size[0], p.size[2]);
    if (length < 24) continue;
    if (p.position[1] - band.floor < 12) continue;
    if (best === null || length > Math.max(best.size[0], best.size[2])) best = p;
  }
  if (best === null) return null;
  // The long axis is where people walk; the deck's own yaw gives the bearing.
  const alongX = best.size[0] >= best.size[2];
  return {
    kind: "platform",
    x: best.position[0],
    y: best.position[1] + best.size[1] / 2,
    z: best.position[2],
    bearing: alongX ? -best.rotation : -best.rotation + Math.PI / 2,
    spread: Math.min(best.size[0], best.size[2]) * 0.3,
  };
}

/**
 * The street in front of the lens.
 *
 * Placed against the camera rather than against a building, because this is a
 * decision about the shot: the single most effective place to put a person is
 * between the reader and something lit, close enough to be read as a person
 * and far enough not to be a wall.
 */
function crossingZones(level: StratumId, surface: number): Zone[] {
  const [cx, cz] = cameraAnchorXZ(LEVEL_ORDER.indexOf(level));
  const look = viewDirection(level);
  // Two lines across the sight line: one in the near ground where a figure is
  // a real silhouette, one further out where they are part of the street.
  return [26, 52].map((ahead) => ({
    kind: "crossing" as const,
    x: cx + Math.cos(look) * ahead,
    y: surface,
    z: cz + Math.sin(look) * ahead,
    // Across the line of sight: people cross the frame rather than walking
    // away down it, because a figure walking away is a figure shrinking.
    bearing: look + Math.PI / 2,
    spread: 3.5,
  }));
}

/**
 * Somebody crossing a skybridge.
 *
 * The interface's answer, arrived at after two that were not. Its station is
 * occluded and its own deck is too small to stand anyone on without putting a
 * figure a third of the frame high — but the level is a canyon of towers with
 * bridges strung between them, and a bridge is by definition in the gap
 * between two buildings rather than behind one. They are also at the camera's
 * own height rather than a hundred metres below it, which is the whole
 * problem with everything else on this level.
 *
 * A person walking between two towers at midnight is the most economical
 * statement available that people work up here.
 */
function bridgeZones(band: LevelEnvironment): Zone[] {
  const out: Zone[] = [];
  for (const st of band.structures) {
    for (const p of st.parts) {
      if (p.kind !== "bridge") continue;
      // Long enough to walk along, and a deck rather than a canopy fin.
      if (p.size[0] < 16) continue;
      if (p.position[1] - band.floor < 20) continue;
      out.push({
        kind: "crossing",
        x: p.position[0],
        y: p.position[1] + p.size[1] / 2,
        z: p.position[2],
        bearing: -p.rotation,
        spread: 0.9,
      });
    }
  }
  return out;
}

/**
 * The maintenance landings along the guideway.
 *
 * The interface needed these and finding out why took a measurement rather
 * than an opinion. Its station is a hundred and four metres away and dead
 * ahead, which sounded fine — until the figures were rendered in a debug
 * colour and counted: sixteen people on that platform came to **eight pixels**
 * in the frame. The towers between the camera and the station occlude almost
 * all of it, so the one level whose entire subject is transit had no visible
 * human presence at all.
 *
 * The guideway itself is visible, because it crosses the whole frame, and the
 * generator puts a short landing on every third bay of it. Those are spread
 * along the arc instead of stacked at one bearing, so what one tower hides
 * the next one does not — and a person on a trackside landing is the most
 * ordinary thing in the world.
 */
function tracksideZones(band: LevelEnvironment): Zone[] {
  const out: Zone[] = [];
  for (const p of band.fixtures) {
    if (p.kind !== "platform") continue;
    const length = Math.max(p.size[0], p.size[2]);
    // The landings, not the station deck and not a facade band.
    if (length < 5 || length > 12) continue;
    if (p.position[1] - band.floor < 12) continue;
    out.push({
      kind: "maintenance",
      x: p.position[0],
      y: p.position[1] + p.size[1] / 2,
      z: p.position[2],
      bearing: -p.rotation,
      spread: 1.2,
    });
  }
  return out;
}

/**
 * Someone working within twenty metres of the lens.
 *
 * The deep levels needed this and the first pass did not have it. Service
 * zones are derived from the plant they belong to, and every machine block in
 * this world stands in a buildable band that starts sixty-six metres out — so
 * the engine level's twelve operators were all between seventy-seven and a
 * hundred and eighteen metres away, dark shapes against a dark mid-ground,
 * and the rendered frame contained no visible person at all. The level read
 * exactly as unstaffed as it had before the layer existed.
 *
 * A worker among the foreground hardware fixes it, and is truer anyway: the
 * cabinets, gantry and cable runs a few metres from the camera are precisely
 * the things somebody has to come and open. Off to one side of the sight
 * line, because the middle of the frame belongs to the city.
 */
function foregroundService(level: StratumId, surface: number): Zone[] {
  const [cx, cz] = cameraAnchorXZ(LEVEL_ORDER.indexOf(level));
  const look = viewDirection(level);
  const across = look + Math.PI / 2;
  return [
    { ahead: 15, lateral: -7.5 },
    { ahead: 21, lateral: 9.5 },
  ].map(({ ahead, lateral }) => ({
    kind: "service" as const,
    x: cx + Math.cos(look) * ahead + Math.cos(across) * lateral,
    y: surface,
    z: cz + Math.sin(look) * ahead + Math.sin(across) * lateral,
    bearing: across,
    spread: 1.6,
  }));
}

/**
 * Everything on this level that somebody has to look after.
 *
 * Standing on the structure's own base rather than on the level's walking
 * surface, which are the same number on the ground levels and emphatically
 * not on the interface, where the camera is sixty-two metres above the floor
 * the buildings are founded on. Anchoring people to the camera's height there
 * would stand them in mid-air against a facade.
 */
function serviceZones(band: LevelEnvironment, kinds: readonly string[]): Zone[] {
  const out: Zone[] = [];
  for (const s of band.structures) {
    if (!kinds.includes(s.kind)) continue;
    // At the face of the plant, not inside it.
    const reach = Math.max(s.size[0], s.size[2]) / 2 + 2.6;
    out.push({
      kind: "service",
      x: s.position[0] + Math.sin(s.rotation) * reach,
      y: s.position[1],
      z: s.position[2] - Math.cos(s.rotation) * reach,
      bearing: s.rotation,
      spread: 2.2,
    });
  }
  return out;
}

/**
 * The foot of a tower with a name on it.
 *
 * Only owned structures, and only the tall ones: a corporate entrance is a
 * thing a corporation has, and the point of the zone is that the reader can
 * tell the difference between a lobby and a loading bay by how people behave
 * at it.
 */
function entranceZones(structures: readonly Structure[]): Zone[] {
  const out: Zone[] = [];
  for (const s of structures) {
    if (s.owner === undefined) continue;
    if (s.size[1] < 40) continue;
    const front = s.size[2] / 2 + 3;
    out.push({
      kind: "entrance",
      x: s.position[0] + Math.sin(s.rotation) * front,
      // A lobby is at the foot of the tower, which is where the tower is
      // founded and not where the camera happens to be standing.
      y: s.position[1],
      z: s.position[2] - Math.cos(s.rotation) * front,
      // Along the frontage: people arrive parallel to the face and turn in.
      bearing: s.rotation + Math.PI / 2,
      spread: 1.8,
    });
  }
  return out;
}

/** Racks and cabinets: the deepest thing anyone has a reason to walk to. */
function maintenanceZones(band: LevelEnvironment): Zone[] {
  const out: Zone[] = [];
  for (const s of band.structures) {
    if (s.kind !== "rack") continue;
    const reach = Math.max(s.size[0], s.size[2]) / 2 + 2;
    out.push({
      kind: "maintenance",
      x: s.position[0] - Math.sin(s.rotation) * reach,
      y: s.position[1],
      z: s.position[2] + Math.cos(s.rotation) * reach,
      bearing: s.rotation,
      spread: 1.4,
    });
  }
  return out;
}

/**
 * Every place on this level where a person has a reason to be.
 *
 * Which kinds a level gets is the level's character, and it is the only place
 * in this file where the four strata differ by name:
 *
 *  - **surface** is a street with a station over it: commuters and people
 *    crossing a frontage, plus whoever is standing in a doorway;
 *  - **interface** is a transit deck ninety-six metres up. Almost everyone
 *    there is there for the train;
 *  - **engine** is staffed rather than visited — operators and maintenance
 *    with the plant, and nobody crossing anything;
 *  - **substrate** has the fewest people in the city and they are all working.
 */
export function zonesFor(band: LevelEnvironment, level: StratumId): Zone[] {
  const surface = standing(band, level);
  const out: Zone[] = [];
  const station = platformZone(band);

  if (level === "surface") {
    if (station) out.push(station);
    out.push(...crossingZones(level, surface));
    out.push(...entranceZones(band.structures));
  } else if (level === "interface") {
    /*
     * The station, and nothing else. The one level with no street on it.
     *
     * Both of the other things people do in this world need ground to do it
     * on, and this camera is standing on a maintenance deck thirteen metres
     * across, ninety-six up, with a hundred and fifty-five metres of air
     * under everything past its front edge. The first pass gave the level the
     * same pair of pedestrian crossings the surface gets, twenty-six and
     * fifty-two metres ahead: twenty-nine people walking on nothing at all,
     * in a line across the middle of the skyline. A lobby would have been the
     * same mistake more quietly — a cluster of four-pixel figures at the
     * bottom of a shaft.
     *
     * What is actually at this height is the transit deck, so this level gets
     * the people a transit deck has — on the platform, and on the landings
     * along the running line, which are the part of it the camera can
     * actually see.
     */
    if (station) out.push(station);
    out.push(...bridgeZones(band));
    out.push(...tracksideZones(band));
  } else if (level === "engine") {
    out.push(...foregroundService(level, surface));
    out.push(...serviceZones(band, ["machine", "stack"]));
    out.push(...maintenanceZones(band));
  } else {
    out.push(...foregroundService(level, surface));
    out.push(...maintenanceZones(band));
  }

  // Only what the camera can see. Everything else is budget spent behind the
  // lens, which is how half of an earlier foreground pass came to be invisible.
  const [cx, cz] = cameraAnchorXZ(LEVEL_ORDER.indexOf(level));
  const look = viewDirection(level);
  const seen = out
    .map((z) => ({ z, range: Math.hypot(z.x - cx, z.z - cz) }))
    .filter(({ z, range }) => {
      if (range > ZONE_MAX_RANGE) return false;
      // A zone on top of the lens is not a zone; it is a figure in your face.
      if (range < 9) return false;
      return Math.abs(delta(Math.atan2(z.z - cz, z.x - cx), look)) <= VIEW_ARC;
    })
    // Nearest first, so a level with more candidates than it may keep keeps
    // the ones the reader can actually resolve as people.
    .sort((a, b) => a.range - b.range);

  const taken: Record<string, number> = {};
  const kept: Zone[] = [];
  for (const { z } of seen) {
    const n = (taken[z.kind] ?? 0) + 1;
    if (n > ZONE_LIMIT[z.kind]) continue;
    taken[z.kind] = n;
    kept.push(z);
  }
  return kept;
}

/** The ceiling on how many people a level may hold, at a given tier. */
export function levelBudget(level: StratumId, figures: number): number {
  return Math.round(figures * LEVEL_OCCUPANCY[level]);
}

/**
 * Hands the level's people out among its places.
 *
 * Weighted rather than even, because even is exactly the failure mode: a city
 * where the platform, the plant and the tower lobby each have four people in
 * it is a city where density carries no information at all. The weights are
 * the hierarchy, and a lower tier drops zones off the tail of the priority
 * list before it thins the ones at the head — a BALANCED platform should look
 * like a platform, not like a platform missing half its commuters.
 */
export function allocate(zones: readonly Zone[], budget: number, keep: number): Map<Zone, number> {
  const out = new Map<Zone, number>();
  if (budget <= 0 || zones.length === 0) return out;

  const ranked = [...zones].sort((a, b) => {
    const pa = ZONE_PRIORITY.indexOf(a.kind);
    const pb = ZONE_PRIORITY.indexOf(b.kind);
    return pa - pb;
  });
  const live = ranked.slice(0, Math.max(1, Math.round(ranked.length * keep)));

  const total = live.reduce((sum, z) => sum + ZONE_WEIGHT[z.kind], 0);
  let spent = 0;
  for (const z of live) {
    // At least one, and never more than the place holds. A zone that exists
    // and is empty is worse than no zone — it is a lit platform nobody uses —
    // and one that overflows its cap is a crowd where the world wanted a
    // pair of operators.
    const share = Math.round((budget * ZONE_WEIGHT[z.kind]) / total);
    const n = Math.min(ZONE_CAP[z.kind], Math.max(1, share), budget - spent);
    if (n <= 0) break;
    out.set(z, n);
    spent += n;
  }
  return out;
}

/**
 * Everyone on this level, as data.
 *
 * Derived from the figure's index within its zone rather than from a clock or
 * a generator, so the same level at the same tier produces the same people
 * standing in the same places with the same timing, run after run. The
 * irrationals are the ones the rest of the environment uses: they spread a
 * small integer sequence across the unit interval without ever repeating,
 * which is what stops six commuters from sharing one phase and stepping
 * forward together like a chorus line.
 */
export function occupants(
  band: LevelEnvironment,
  level: StratumId,
  budget: number,
  keep: number,
): Figure[] {
  const zones = zonesFor(band, level);
  const share = allocate(zones, levelBudget(level, budget), keep);
  const fixtures = lamps(band);
  const out: Figure[] = [];

  let n = 0;
  for (const [zone, count] of share) {
    const behaviour = ZONE_BEHAVIOUR[zone.kind];
    for (let i = 0; i < count; i += 1, n += 1) {
      // Across the path, so a cluster is a cluster and not a queue.
      const lateral = ((n * 0.6180339887) % 1 - 0.5) * 2 * zone.spread;
      const x = zone.x + Math.cos(zone.bearing + Math.PI / 2) * lateral;
      const z = zone.z + Math.sin(zone.bearing + Math.PI / 2) * lateral;
      out.push({
        kind: zone.kind,
        x,
        y: zone.y,
        z,
        // A few degrees either side of the zone's line. People do not walk on
        // rails, and a rank of figures on exactly parallel paths is the
        // clearest possible signal that they were placed by a loop.
        bearing: zone.bearing + ((n * 0.3247179572) % 1 - 0.5) * 0.5,
        travel: behaviour.travel * (0.8 + ((n * 0.5698402909) % 1) * 0.45),
        dwell: behaviour.dwell,
        // Cycles per second. Slow: a whole cycle is an arrival, a wait and a
        // departure, and those take the better part of a minute.
        rate: 0.018 + ((n * 0.7548776662) % 1) * 0.022,
        phase: (n * 0.4142135624) % 1,
        height:
          FIGURE_MIN_HEIGHT +
          ((n * 0.2360679775) % 1) * (FIGURE_MAX_HEIGHT - FIGURE_MIN_HEIGHT),
        // From the chest, which is the part of a figure anyone looks at.
        source: litBy(fixtures, x, zone.y + 1.1, z),
      });
    }
  }
  return out;
}

/** Re-exported so the renderer reads one number from one place. */
export { LAMP_REACH_SQ };
