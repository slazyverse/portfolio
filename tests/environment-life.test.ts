import { describe, expect, it } from "vitest";
import { generateCity } from "@/lib/environment/generate";
import { ENVIRONMENT_BUDGET } from "@/lib/environment/quality";
import type { LightBehaviour, LightSource } from "@/lib/environment/types";

/**
 * The living city.
 *
 * Phase 8 did two things to the environment: it gave the city a vocabulary of
 * lamps instead of two signal colours, and it gave those lamps something to do
 * over time. Both are easy to get wrong in ways a screenshot will not show.
 *
 * The risks this suite exists for:
 *
 *  - **drift into a light show.** Motion is convincing in proportion to how
 *    little of it there is. A city where a third of the windows pulse is not
 *    alive, it is a screensaver, and nothing about a still frame would tell
 *    you that had happened.
 *  - **losing the signal rule.** `--accent` means the subject. The whole point
 *    of adding lamp colours was to stop every warm thing in the world being
 *    the same colour as the person it is about, and a facade that quietly
 *    starts using `subject` would undo exactly that.
 *  - **non-determinism.** The city is seeded, and Phase 8 put timing into the
 *    data. If a phase or a behaviour were drawn from anything but the seed,
 *    two renders of the same route would differ and the environment's central
 *    guarantee would be gone.
 */

const SOURCES: LightSource[] = [
  "sodium",
  "interior",
  "machine",
  "warning",
  "utility",
  "subject",
];

const BEHAVIOURS: LightBehaviour[] = ["steady", "breathe", "flicker", "blink"];

describe("the city is lit by fixtures, not by two tokens", () => {
  const city = generateCity("high");
  const lights = city.levels.flatMap((l) => l.lights);

  it("gives every cell a known fixture and a known behaviour", () => {
    expect(lights.length).toBeGreaterThan(100);
    for (const l of lights) {
      expect(SOURCES, `unknown source ${l.source}`).toContain(l.source);
      expect(BEHAVIOURS, `unknown behaviour ${l.behaviour}`).toContain(l.behaviour);
    }
  });

  it("uses more than two colours, and spreads them across the city", () => {
    // The failure this replaces: every lit thing in the world was `--accent`
    // or `--cold`, and the result read as a monochrome render with two
    // filters on it.
    const used = new Set(lights.map((l) => l.source));
    expect(used.size, `only ${[...used].join(", ")} in use`).toBeGreaterThanOrEqual(4);
  });

  it("never spends the subject's colour on the city", () => {
    // `--accent` marks the subject and their work. A window may not borrow
    // it, which is the only reason it still means anything when it appears.
    for (const l of lights) {
      expect(l.source, `${l.signal} cell claims the subject colour`).not.toBe("subject");
    }
  });

  it("keeps warm fixtures on warm signals and cold on cold", () => {
    // The Phase 2 semantics survive underneath the new vocabulary: warm light
    // means people are here, cold light means the machine is.
    const warm: LightSource[] = ["interior", "sodium"];
    for (const l of lights) {
      if (warm.includes(l.source)) {
        expect(l.signal, "a warm lamp on a machine signal").toBe("amber");
      }
    }
  });
});

describe("motion is the exception, not the rule", () => {
  const lights = generateCity("high").levels.flatMap((l) => l.lights);

  it("leaves the overwhelming majority of the city still", () => {
    const moving = lights.filter((l) => l.behaviour !== "steady").length;
    const share = moving / lights.length;
    // Generous ceiling, deliberately: the assertion is not about the exact
    // number, it is that a future change cannot quietly turn the city into a
    // light show without this failing.
    expect(share, `${Math.round(share * 100)}% of the city animates`).toBeLessThan(0.2);
  });

  it("blinks only what a city actually blinks", () => {
    // Hazard and obstruction lights, and nothing else. A blinking office
    // window is a fault, not a feature.
    for (const l of lights) {
      if (l.behaviour === "blink") expect(l.source).toBe("warning");
    }
  });

  it("puts obstruction beacons on the tallest structures and nowhere else", () => {
    const city = generateCity("high");
    for (const level of city.levels) {
      const beacons = level.lights.filter((l) => l.fixed);
      // Four faces per tower, at most six towers.
      expect(beacons.length % 4, `${level.level} has a partial beacon`).toBe(0);
      expect(beacons.length).toBeLessThanOrEqual(24);
      for (const b of beacons) {
        expect(b.source).toBe("warning");
        expect(b.behaviour).toBe("blink");
      }
    }
  });

  it("gives every cell its own place in its cycle", () => {
    // A facade whose lamps share a phase flashes in unison, which reads as one
    // system being driven rather than as a street.
    const phases = new Set(lights.map((l) => Math.round(l.phase * 100)));
    expect(phases.size).toBeGreaterThan(50);
    for (const l of lights) {
      expect(Number.isFinite(l.phase)).toBe(true);
      expect(l.phase).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("environmental life is seeded, not random", () => {
  it("produces the same behaviour and timing on every generation", () => {
    // The guarantee the whole environment rests on. Phase 8 moved timing into
    // the data, so timing is now part of what has to be reproducible.
    const a = generateCity("high").levels.flatMap((l) => l.lights);
    const b = generateCity("high").levels.flatMap((l) => l.lights);

    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i += 1) {
      expect(a[i]!.source).toBe(b[i]!.source);
      expect(a[i]!.behaviour).toBe(b[i]!.behaviour);
      expect(a[i]!.phase).toBe(b[i]!.phase);
    }
  });

  it("produces a different city from a different seed", () => {
    const a = generateCity("high", "seed-a").levels.flatMap((l) => l.lights);
    const b = generateCity("high", "seed-b").levels.flatMap((l) => l.lights);
    const same = a.every(
      (l, i) => b[i] && l.source === b[i]!.source && l.phase === b[i]!.phase,
    );
    expect(same).toBe(false);
  });
});

describe("life scales with the tier that has to draw it", () => {
  const high = ENVIRONMENT_BUDGET.high;
  const balanced = ENVIRONMENT_BUDGET.balanced;
  const low = ENVIRONMENT_BUDGET.low;

  it("reduces every moving system at the middle tier", () => {
    expect(balanced.traffic).toBeLessThan(high.traffic);
    expect(balanced.rain).toBeLessThan(high.rain);
    expect(balanced.steam).toBeLessThan(high.steam);
    expect(balanced.maxLights).toBeLessThan(high.maxLights);
  });

  it("keeps something moving at the middle tier rather than nothing", () => {
    // A tier is the same city rendered more cheaply. A street with no
    // movement on it at all reads as dead, not as cheaper — which is the one
    // failure a reduction is supposed to avoid.
    expect(balanced.traffic).toBeGreaterThan(0);
    expect(balanced.rain).toBeGreaterThan(0);
    expect(balanced.steam).toBeGreaterThan(0);
  });

  it("draws no animated environment at all on the lowest tier", () => {
    // LOW never starts a WebGL context — it gets the 2D atmosphere instead —
    // so every one of these is zero by construction rather than by taste.
    expect(low.traffic).toBe(0);
    expect(low.rain).toBe(0);
    expect(low.steam).toBe(0);
    expect(low.maxLights).toBe(0);
    expect(generateCity("low").stats.lights).toBe(0);
  });

  it("keeps the lit city inside the ceiling its tier declares", () => {
    // Beacons are exempt from thinning, so the arithmetic that enforces the
    // quota has to account for them rather than be bypassed by them.
    for (const tier of ["high", "balanced", "low"] as const) {
      expect(generateCity(tier).stats.lights).toBeLessThanOrEqual(
        ENVIRONMENT_BUDGET[tier].maxLights,
      );
    }
  });
});
