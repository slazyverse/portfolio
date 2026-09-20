import { LEVEL_ORDER } from "@/data/routes";
import type { StratumId } from "@/data/types";
import { cameraAnchorXZ, cameraBearing, levelFloor } from "./generate";

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
 * Each value sits inside its level's structures rather than over them.
 */
const EYE: Record<StratumId, number> = {
  surface: 19,
  interface: 16,
  engine: 8,
  substrate: 3.6,
};

/** How far across the shaft the camera looks. Past the far wall. */
const FOCUS_DISTANCE = 62;

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
      // Proportional to the eye height, not a fixed drop. A fixed eleven-unit
      // drop is a gentle tilt from nineteen units up and a stare into the
      // floor from three and a half.
      floor + eye * 0.45,
      Math.sin(bearing + Math.PI) * FOCUS_DISTANCE,
    ] as const,
    // Narrower at depth. The substrate is a tight space and a wide lens would
    // contradict the compression the design system applies to the same level.
    fov: 52 - i * 2.5,
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
