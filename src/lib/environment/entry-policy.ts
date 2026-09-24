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
