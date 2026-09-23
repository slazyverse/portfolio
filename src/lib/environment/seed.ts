/**
 * Deterministic pseudo-randomness for environment generation.
 *
 * The city must be the same city on every load. That is not an aesthetic
 * preference — it is what makes the environment debuggable, screenshot-stable,
 * testable and reviewable. A layout that reshuffles on every reload cannot be
 * regression-tested, cannot be compared between two commits, and turns any
 * visual report into an anecdote.
 *
 * So: no `Math.random()` anywhere in the generator. Every value comes from a
 * stream seeded by a string, and the same string always produces the same city.
 *
 * `mulberry32` is used rather than something larger because the requirement is
 * "well-distributed and reproducible", not "cryptographic". It is four lines,
 * has a period of 2^32, and passes the distribution quality this needs.
 */

/**
 * String to 32-bit seed (xmur3).
 *
 * Needed because seeds are authored as readable strings — `"substrate:engine"`
 * rather than `3847261`. A named seed survives a code review; a magic integer
 * does not.
 */
export function hashSeed(input: string): number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i += 1) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export interface Rng {
  /** Next value in [0, 1). */
  next(): number;
  /** Uniform float in [min, max). */
  range(min: number, max: number): number;
  /** Uniform integer in [min, max] — inclusive at both ends. */
  int(min: number, max: number): number;
  /** True with probability `p`. */
  chance(p: number): boolean;
  /** A uniformly chosen member. Throws on an empty list, rather than returning undefined. */
  pick<T>(items: readonly T[]): T;
  /**
   * A value biased toward `min`. `power > 1` skews harder.
   *
   * Cities are not uniformly tall. Most structures are ordinary and a few are
   * landmarks, and a uniform distribution produces a flat, obviously-generated
   * skyline — the single most recognisable tell of procedural geometry.
   */
  skewed(min: number, max: number, power: number): number;
}

export function createRng(seed: number | string): Rng {
  let a = typeof seed === "string" ? hashSeed(seed) : seed >>> 0;

  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick<T>(items: readonly T[]): T {
      const value = items[Math.floor(next() * items.length)];
      if (value === undefined) {
        throw new Error("Rng.pick called with an empty list");
      }
      return value;
    },
    skewed: (min, max, power) => min + Math.pow(next(), power) * (max - min),
  };
}
