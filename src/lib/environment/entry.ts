import type { StratumId } from "@/data/types";
import { cameraTargetForLevel, type CameraTarget } from "./camera";
import type { EntryBeat, EntryLength } from "./entry-policy";

export { ENTRY_BEATS, entryLength } from "./entry-policy";
export type { EntryBeat, EntryLength } from "./entry-policy";

/* ---------------------------------------------------------------------------
 * The opening shot.
 *
 * Phase 5 built a city and a camera architecture: where the camera stands at
 * each level, and how it travels between them. It deliberately stopped short
 * of choreography, because authoring a sequence against a world nobody had
 * looked at on real hardware would have been guessing. The world has now been
 * looked at, and this is the sequence.
 *
 * WHAT THIS IS NOT. It is not a flythrough, and it is not a camera moving
 * forward while the city happens to be there. Every one of the five moves
 * below exists to uncover one specific thing, in the order a person would
 * discover them if they arrived on that street: what is at their feet, then
 * the street itself, then what crosses above it, then how far it goes, then
 * the one building that is larger than the rest. The subject arrives last,
 * because a portfolio that introduces itself before it has established where
 * it is standing has wasted the world it built.
 *
 * WHY IT IS DATA. Keyframes in a plain array, sampled by a pure function, with
 * no rendering library anywhere in this file — the same rule the generator
 * follows. It can be asserted in Node: that the shot is monotonic in time,
 * that every beat is reachable, that it lands exactly on the camera's resting
 * transform, and that reduced motion collapses it to nothing. A cinematic that
 * can only be verified by watching it is a cinematic that quietly breaks.
 *
 * THE LANDING IS NOT THE SHOT. Nothing here gates content. The page is
 * complete, server-rendered and navigable while this plays; the sequence moves
 * a camera behind it and tells the landing state machine which beat it is on.
 * Turn it off entirely and the portfolio is unchanged.
 * ------------------------------------------------------------------------- */

export interface EntryKeyframe extends CameraTarget {
  /** Milliseconds from the start of the shot. */
  at: number;
  beat: EntryBeat;
}

/**
 * How the shot gets from one keyframe to the next.
 *
 * `inOut` for moves that begin and end at rest, which is all of them except
 * the last: the settle uses `out`, so the camera decelerates into its resting
 * transform rather than easing out of a move it is no longer making.
 */
type Segment = "inOut" | "out";

/**
 * Cubic curves, matching `lib/motion`'s `EASE` by construction.
 *
 * Written out rather than imported as bezier control points because a bezier
 * needs solving and these two are closed-form. The numbers are the same
 * instrument easing the rest of the site uses: decelerate and stop, no
 * overshoot, no bounce.
 */
function ease(kind: Segment, t: number): number {
  if (kind === "out") return 1 - Math.pow(1 - t, 3);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/* ------------------------------------------------------------------ shot --- */

/**
 * The full opening, on the surface level.
 *
 * Every position is derived from the geometry the generator actually built:
 * the camera rests at (14, 6.5, 0) looking down −X, the transit deck crosses
 * at 34 metres on a ring of radius 118, and the Vantage tower stands at
 * (−136, 0) and is 290 metres tall. The shot is composed against those
 * numbers rather than against a screenshot, which is why it survives a change
 * of seed: the landmark is authored, so it is always on this axis.
 *
 * The lateral drift in Z is small and deliberate. A camera that only moves
 * along its own sight line produces no parallax, and without parallax a city
 * reads as a painted backdrop however much geometry is in it.
 */
const FULL: readonly EntryKeyframe[] = [
  {
    // Ankle height, behind and beside the resting point, on a long lens. The
    // first frame is a barrier, a drain and rain on asphalt — a place, at a
    // scale a person recognises, before any architecture at all.
    at: 0,
    position: [30, 1.8, 9],
    lookAt: [16, 1.1, 4],
    fov: 34,
    beat: "wake",
  },
  {
    // Standing up. The signal column and the kerb run enter frame and the
    // street opens along its length.
    at: 1050,
    position: [24, 3.4, 5.5],
    lookAt: [-10, 5, 1],
    fov: 42,
    beat: "street",
  },
  {
    // Tilt to the viaduct. Its soffit is lit and there are vehicles on it:
    // the first evidence that the place is used rather than built.
    at: 2100,
    position: [19, 5.2, 2.6],
    lookAt: [-118, 33, 0],
    fov: 48,
    beat: "transit",
  },
  {
    // Widen. The verticals converge, the far wall arrives, and the city
    // acquires a depth it did not appear to have at 34 degrees.
    at: 3150,
    position: [16, 6.2, 1],
    lookAt: [-150, 58, 0],
    fov: 56,
    beat: "scale",
  },
  {
    // Up the Vantage tower, which is the only thing on this level that does
    // not take its size from the grid.
    at: 4200,
    position: [14.6, 6.5, 0.3],
    lookAt: [-136, 118, 0],
    fov: 60,
    beat: "landmark",
  },
  {
    // The settle begins. This keyframe exists so that the last *move* is the
    // subject's rather than the landmark's: a keyframe names the move that
    // starts at it, so without this one the camera would still be reporting
    // "landmark" while it eased into rest, and the heading would arrive on
    // the same frame the camera stopped. Two events where there should be one.
    at: 4650,
    position: [14.2, 6.5, 0.12],
    lookAt: [-150, 52, 0],
    fov: 61,
    beat: "subject",
  },
  {
    // The resting transform, exactly. From here the Phase 5 route camera
    // takes over and a level change is an ordinary descent.
    at: 5250,
    ...cameraTargetForLevel("surface"),
    beat: "subject",
  },
];

/**
 * The short opening.
 *
 * Three moves instead of six, for the tier that can render the city but has
 * less headroom to spend on doing it beautifully, and for anyone who has
 * already watched the long one this session. It keeps the first frame, the
 * one move that proves the city is inhabited, and the landing — which is the
 * smallest set that still reads as authored rather than as a cut.
 */
const SHORT: readonly EntryKeyframe[] = [
  { at: 0, position: [26, 2.6, 6], lookAt: [6, 2.4, 2], fov: 38, beat: "wake" },
  {
    at: 1100,
    position: [18, 5.4, 2],
    lookAt: [-118, 34, 0],
    fov: 50,
    beat: "transit",
  },
  { at: 1900, position: [15.6, 6.4, 0.6], lookAt: [-150, 40, 0], fov: 58, beat: "subject" },
  { at: 2500, ...cameraTargetForLevel("surface"), beat: "subject" },
];

export function entryShot(length: EntryLength): readonly EntryKeyframe[] {
  if (length === "full") return FULL;
  if (length === "short") return SHORT;
  return [];
}

/** How long an opening runs, in milliseconds. Zero when there is none. */
export function entryDuration(length: EntryLength): number {
  const shot = entryShot(length);
  return shot.length === 0 ? 0 : shot[shot.length - 1]!.at;
}

/* ---------------------------------------------------------------- sample --- */

export interface EntrySample extends CameraTarget {
  beat: EntryBeat;
  /** 0..1 across the whole shot. */
  progress: number;
  done: boolean;
}

function mix(a: number, b: number, k: number): number {
  return a + (b - a) * k;
}

function mix3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  k: number,
): readonly [number, number, number] {
  return [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)];
}

/**
 * Where the camera is, `elapsed` milliseconds into the shot.
 *
 * Pure and deterministic: the same elapsed time always produces the same
 * transform, which is what lets the sequence be asserted in a unit test
 * instead of watched. Past the end it clamps to the resting transform and
 * reports `done`, so a caller that keeps sampling gets a still camera rather
 * than an extrapolation.
 */
export function sampleEntry(
  shot: readonly EntryKeyframe[],
  elapsed: number,
): EntrySample | null {
  if (shot.length === 0) return null;
  const last = shot[shot.length - 1]!;
  const total = last.at;

  if (elapsed >= total) {
    return { ...last, beat: last.beat, progress: 1, done: true };
  }

  let i = 0;
  while (i < shot.length - 2 && elapsed >= shot[i + 1]!.at) i += 1;

  const from = shot[i]!;
  const to = shot[i + 1]!;
  const span = to.at - from.at;
  const raw = span <= 0 ? 1 : (elapsed - from.at) / span;
  // The final segment decelerates into rest; the others begin and end at rest.
  const k = ease(i === shot.length - 2 ? "out" : "inOut", Math.min(Math.max(raw, 0), 1));

  return {
    position: mix3(from.position, to.position, k),
    lookAt: mix3(from.lookAt, to.lookAt, k),
    fov: mix(from.fov, to.fov, k),
    // The beat belongs to the move being made, not to the one it is heading
    // for: the interface should say "street" while the camera is standing up
    // into the street, not while it is still at ankle height.
    beat: from.beat,
    progress: total <= 0 ? 1 : elapsed / total,
    done: false,
  };
}

/** The level the opening is composed on. The landing is a surface shot. */
export const ENTRY_LEVEL: StratumId = "surface";
