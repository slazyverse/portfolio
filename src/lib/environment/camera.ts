import { ANCHOR_SPECS } from "@/data/environment";
import { LEVEL_ORDER, route } from "@/data/routes";
import type { RouteId, StratumId } from "@/data/types";
import {
  CAMERA_EYE,
  anchorPlacement,
  cameraAnchorXZ,
  cameraBearing,
  levelFloor,
} from "./generate";

/**
 * The camera model.
 *
 * Phase 5 builds the *architecture* — where the camera stands at each level,
 * how it gets between them, and how that is driven from the route. It does not
 * build the cinematic entry; that is Phase 6, and writing the choreography now
 * would mean authoring a sequence against a world that has not been looked at
 * on real hardware yet.
 *
 * What is settled here is the thing Phase 6 needs to be able to assume: that
 * "descend to level N" is a pure function of the level, and that the transition
 * between any two levels is defined for every pair.
 */

export interface CameraTarget {
  position: readonly [number, number, number];
  lookAt: readonly [number, number, number];
  fov: number;
}

/**
 * Height above a level's floor at which the camera rests.
 *
 * Authored per level rather than stepped by a formula, because the right eye
 * height is a function of what stands on that level. A linear step put the
 * camera eleven units above a substrate whose racks are three to six tall —
 * so the shot was the tops of server cabinets seen from above, which is a
 * view of a floor, not a view of a hall.
 *
 * Read from the generator, which owns it: the generator has to build the
 * foreground street around this height and, on the interface level, the deck
 * the camera is standing on. A second copy here would be a second thing to
 * keep in step, which is exactly how a camera ends up floating.
 */
const EYE = CAMERA_EYE;

/**
 * How far above or below the horizon each level looks, measured at the focal
 * distance.
 *
 * Authored per level, because the subject is different on each one. At the
 * surface the subject is up — towers rising out of frame — and a level camera
 * would frame nothing but wet road. Deeper down the subject is ahead or
 * slightly below.
 */
const PITCH: Record<StratumId, number> = {
  /*
   * Near level, and the towers converge anyway.
   *
   * This was 46 - about sixteen degrees up - on the reasoning that a canyon
   * reads as tall when the verticals converge. It does, but the convergence
   * comes from the wide lens and from standing between hundred-metre
   * buildings thirty metres apart, not from the pitch; and the pitch was
   * costing the entire lower third of the composition. At sixteen degrees up
   * with a sixty-two degree field, the ground did not appear until
   * thirty-three metres, which is past every barrier, cabinet, cable drop and
   * parked vehicle the foreground contains.
   *
   * Four metres of rise over the focal distance is about one and a half
   * degrees: enough to keep the tops of the near towers out of frame, little
   * enough that the wet street starts twelve metres from the lens.
   */
  surface: 4,
  // Across the masts rather than down at the deck. A downward pitch from a
  // camera standing on a platform frames the platform.
  interface: 12,
  // Slightly up into the overhead structure, but not so far that the apron
  // in front of the machine blocks leaves the shot.
  engine: 8,
  // Level, and a touch up, so the ceiling of the hall is in frame and the
  // floor does not take half of it.
  substrate: 4,
};

/** How far across the shaft the camera looks. Past the far wall. */
const FOCUS_DISTANCE = 165;

/**
 * Where the camera stands to observe a level.
 *
 * The bearing rotates as you descend so the four levels are not the same shot
 * at four heights. It is derived from the level's index rather than authored,
 * so adding a level cannot leave a camera position undefined.
 */
export function cameraTargetForLevel(level: StratumId): CameraTarget {
  const i = LEVEL_ORDER.indexOf(level);
  const floor = levelFloor(level);
  const bearing = cameraBearing(i);
  const eye = EYE[level];
  // Read from the generator, which is what keeps this spot clear of geometry.
  // A second copy of the offset here is a second thing to keep in step.
  const [x, z] = cameraAnchorXZ(i);

  return {
    position: [x, floor + eye, z] as const,
    /**
     * Across the shaft to the opposite wall, tilted slightly down.
     *
     * The first version looked steeply downward — about sixty-five degrees —
     * and the result was a view of the ground plane's edge cutting the frame
     * as a diagonal, with the city itself out of shot. A near-horizontal look
     * across the void puts the far wall in frame, the near wall at the edges,
     * and the drop at the bottom, which is the composition the shaft was for.
     */
    lookAt: [
      Math.cos(bearing + Math.PI) * FOCUS_DISTANCE,
      floor + eye + PITCH[level],
      Math.sin(bearing + Math.PI) * FOCUS_DISTANCE,
    ] as const,
    /**
     * Wider at the surface, narrower at depth.
     *
     * A wide lens exaggerates the convergence of tall verticals, which is what
     * makes a street canyon feel tall — it is the shot every city photographer
     * reaches for and it costs nothing. The substrate is a tight space where
     * the same lens would only distort it, and a narrow one agrees with the
     * compression the design system already applies to that level.
     */
    fov: level === "surface" ? 62 : 54 - i * 3,
  };
}

/* ------------------------------------------------------------- by route --- */

/**
 * The most the camera will turn away from a level's own composition.
 *
 * Thirty degrees. Enough that two routes on the same level are unmistakably
 * two different views; little enough that the shaft, the far wall and the drop
 * are all still in frame, because those are what make the level read as the
 * level. Beyond about this the camera starts facing a wall, and a portfolio
 * that turns to face a wall when you open a page has made navigation into a
 * thing that happens *to* the reader.
 */
const MAX_TURN = Math.PI / 6;

/** Shortest signed angle from `a` to `b`, in radians. */
function angleDelta(a: number, b: number): number {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

/**
 * Where the camera stands to observe a *route*.
 *
 * The level decides where the camera is; the route decides what it faces. That
 * distinction is the whole of Phase 9's spatial idea. Before this, every route
 * on a level produced a byte-identical shot — `/dossier` and `/systems` are
 * both Interface, so opening one after the other changed the text and nothing
 * else, and the city was demonstrably a backdrop rather than a place.
 *
 * Now each route turns toward its own anchor: the terminal, the node array,
 * the contract hub, the core. The standing position, eye height, pitch and
 * lens are untouched, so the composition is the level's and only the heading
 * differs — which is the difference between arriving somewhere and being
 * moved somewhere.
 *
 * A route with no anchor is not an error and gets the level's own shot. Not
 * every page needs a landmark, and inventing one for each would make none of
 * them mean anything.
 */
export function cameraTargetForRoute(
  routeId: RouteId,
  /**
   * The level to stand on, when it is not the route table's.
   *
   * Contracts are the reason. They share one route record and genuinely sit
   * at different depths — deadlockd is substrate work and the other two are
   * engine work — so the depth comes from the contract, exactly as it already
   * does for the chrome and the page header. An anchor is only used when it
   * is actually on the level being stood on; otherwise the camera would face
   * a landmark two hundred metres above it.
   */
  levelOverride?: StratumId,
): CameraTarget {
  const level = levelOverride ?? route(routeId).level;
  const base = cameraTargetForLevel(level);
  const spec = ANCHOR_SPECS.find(
    (s) => s.routeId === routeId && route(s.routeId).level === level,
  );
  if (!spec) return base;

  const floor = levelFloor(level);
  const bearing = cameraBearing(LEVEL_ORDER.indexOf(level)) + Math.PI;
  const [ax, , az] = anchorPlacement(spec, floor, bearing);
  const [cx, , cz] = base.position;

  // The heading the anchor is actually on, from where the camera stands.
  const toAnchor = Math.atan2(az - cz, ax - cx);

  const turn = Math.max(-MAX_TURN, Math.min(MAX_TURN, angleDelta(bearing, toAnchor)));
  const heading = bearing + turn;

  return {
    ...base,
    // Same height and pitch as the level: only the heading moves. Aiming at
    // the anchor's own height as well would tilt the camera off the horizon
    // and lose the shaft, which is the composition the level is built on.
    lookAt: [
      Math.cos(heading) * FOCUS_DISTANCE,
      base.lookAt[1],
      Math.sin(heading) * FOCUS_DISTANCE,
    ] as const,
  };
}

/**
 * How long a descent between two levels should take, in milliseconds.
 *
 * Proportional to the distance travelled, with a floor, so that moving one
 * level and moving three do not take the same time — a fixed duration makes
 * short moves feel sluggish and long ones feel teleported.
 *
 * Returns 0 under reduced motion. The caller then snaps, rather than easing
 * quickly: "reduce motion" is not "the same motion, faster".
 */
export function descentDuration(
  from: StratumId,
  to: StratumId,
  reducedMotion: boolean,
): number {
  if (reducedMotion) return 0;
  const distance = Math.abs(LEVEL_ORDER.indexOf(to) - LEVEL_ORDER.indexOf(from));
  if (distance === 0) return 0;
  return 620 + distance * 340;
}

/** Cubic ease-in-out, matching the design system's `--ease-precise` feel. */
export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
