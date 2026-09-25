/* ---------------------------------------------------------------------------
 * Who gets an opening.
 *
 * Deliberately its own module, with no imports at all, and that is a budget
 * decision rather than a tidiness one.
 *
 * The landing page has to answer "is there a cinematic on this visit?" during
 * its first render, which puts whatever it imports into the initial bundle.
 * The keyframes next door cannot go there: they are anchored to the camera's
 * resting transform, so `entry.ts` imports the camera module, which imports
 * the generator, which is the entire city — several hundred kilobytes of
 * architecture that exists to be lazily loaded. Importing `entryLength` from
 * that file took the initial bundle from 190.2 KB to 201.0 KB and broke a
 * ceiling this project has held since Phase 1.
 *
 * The policy is five booleans and a string. It belongs on its own.
 * ------------------------------------------------------------------------- */

/**
 * What a move in the opening is *for*.
 *
 * The landing state machine reads these rather than a clock, so the interface
 * and the camera cannot drift apart: the subject line appears because the
 * camera reached the subject, not because some number of milliseconds elapsed.
 */
export type EntryBeat =
  /** Ankle height, tight lens. Wet asphalt, a barrier, rain. No city yet. */
  | "wake"
  /** Standing up into the street: the signal column, the kerb, the frontage. */
  | "street"
  /** Tilting to the viaduct crossing overhead — the city is inhabited. */
  | "transit"
  /** Widening. The towers converge and the depth of the place arrives. */
  | "scale"
  /** The one building larger than the rest. */
  | "landmark"
  /** Settling onto the resting transform, where the portfolio takes over. */
  | "subject";

export const ENTRY_BEATS: readonly EntryBeat[] = [
  "wake",
  "street",
  "transit",
  "scale",
  "landmark",
  "subject",
];

export type EntryLength = "full" | "short" | "none";

/**
 * Which opening this visit gets.
 *
 * Five real facts decide it, and none of them is a timer:
 *
 *   reduced motion  someone asked for less movement, so there is none. The
 *                   answer is `none`, not "the same thing, faster".
 *   webgl / tier    a camera move is only worth making if a city is being
 *                   drawn. LOW never starts a WebGL context at all, which is
 *                   what every phone resolves to.
 *   internal        a return to Home from inside the site gets nothing: they
 *                   never left the world, and replaying its introduction
 *                   would be telling them where they already are.
 *   seen            a second arrival in the same session gets the short form.
 */
export function entryLength(input: {
  reducedMotion: boolean;
  seen: boolean;
  internal: boolean;
  tier: "high" | "balanced" | "low";
  webgl: boolean;
}): EntryLength {
  if (input.reducedMotion || !input.webgl || input.tier === "low") return "none";
  if (input.internal) return "none";
  if (input.seen) return "short";
  // BALANCED renders the city with less headroom to spend on doing it
  // beautifully, and a six-second camera move is the first thing that goes.
  return input.tier === "balanced" ? "short" : "full";
}

/* ----------------------------------------------------------- the deadline --- */

/**
 * The moment the subject must be on screen, measured from the start of the
 * navigation. One deadline, honoured by everything that can withhold the hero.
 *
 * This number is not a pacing choice; it is the promise. Whatever the device
 * turns out to be, whatever the renderer does or fails to do, the portfolio is
 * readable by here. The inline script in the document head enforces it for the
 * case where the bundle never executes, and the landing store enforces it for
 * every case where it does — both from this constant, so the two can never
 * disagree about when the wait is over.
 */
export const SIGNAL_DEADLINE_MS = 7000;

/**
 * How long each opening takes, in the initial bundle.
 *
 * The authored keyframes live next door in `entry.ts`, which imports the
 * camera, which imports the generator, which is the whole city — several
 * hundred kilobytes the landing must not carry in order to answer a question
 * about time. So the duration is restated here, and a test asserts it against
 * the keyframes themselves. A restated number with a test on it is a fact in
 * two places; a restated number without one is a bug waiting for a re-cut.
 */
export const ENTRY_DURATION_MS: Record<EntryLength, number> = {
  full: 5250,
  short: 2500,
  none: 0,
};

/**
 * The latest the renderer can produce its first frame and still be allowed to
 * play this opening.
 *
 * Working backwards from the deadline rather than forwards from arrival is the
 * whole fix. A shot is only worth starting if it can finish before the subject
 * is due, so the window closes early on a slow machine — the visitor gets the
 * page at about a second and three quarters instead of staring at a dark field
 * until the full deadline, and there is no moment at which the hero is on
 * screen while an opening is still coming for it.
 */
export function entryWindowMs(length: EntryLength): number {
  return SIGNAL_DEADLINE_MS - ENTRY_DURATION_MS[length];
}

/** Can an opening of this length still finish on time, starting now? */
export function entryFitsDeadline(length: EntryLength, elapsedMs: number): boolean {
  return elapsedMs <= entryWindowMs(length);
}
