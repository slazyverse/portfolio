import { describe, expect, it } from "vitest";
import { LEVEL_ORDER } from "@/data/routes";
import type { StratumId } from "@/data/types";
import {
  cameraAnchorXZ,
  cameraBearing,
  generateCity,
} from "@/lib/environment/generate";
import {
  LEVEL_OCCUPANCY,
  VIEW_ARC,
  ZONE_BEHAVIOUR,
  ZONE_CAP,
  ZONE_LIMIT,
  ZONE_MAX_RANGE,
  ZONE_PRIORITY,
  ZONE_WEIGHT,
  levelBudget,
  occupants,
  zonesFor,
  type Figure,
  type ZoneKind,
} from "@/lib/environment/occupancy";
import { ENVIRONMENT_BUDGET } from "@/lib/environment/quality";
import type { City, LevelEnvironment } from "@/lib/environment/types";

/**
 * Ambient life.
 *
 * The city had architecture, weather, materials and landmarks, and the only
 * thing in it moving under its own power was traffic — which is people in
 * boxes. Nobody waited for the train running through the middle of every
 * shot; nobody operated the plant floor. The reader could see that the place
 * had been built and could not see that anyone used it.
 *
 * What makes that fixable without a character system is that almost none of
 * the information is in the figure. A person is a dark shape ten to forty
 * pixels tall; what makes them a commuter rather than a bug is entirely
 * *where they are* and *what they are doing there*. So the placement is the
 * product, it is pure, and this is where it is held to account.
 *
 * Every number asserted below was measured before it was chosen. Two of them
 * were measured because the first version was wrong in a way that looked
 * completely fine from the outside.
 */

const HIGH = ENVIRONMENT_BUDGET.high;
const BALANCED = ENVIRONMENT_BUDGET.balanced;

const city = generateCity("high");
const bandFor = (level: StratumId): LevelEnvironment =>
  city.levels.find((l) => l.level === level)!;

/** Everyone on a level, at a tier. */
function peopleOn(
  level: StratumId,
  tier: "high" | "balanced" = "high",
  from: City = city,
): Figure[] {
  const budget = ENVIRONMENT_BUDGET[tier];
  const band = from.levels.find((l) => l.level === level)!;
  return occupants(band, level, budget.figures, budget.zoneKeep);
}

/** Signed angle between two bearings, in [-pi, pi]. */
function delta(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

describe("people are where a person would be", () => {
  it("puts every one of them in front of the lens", () => {
    /*
     * The defect the first draft of this file shipped, stated as an
     * assertion.
     *
     * `cameraBearing` is where the camera *stands*; the camera looks back
     * across the middle of the world rather than out of it, so the direction
     * it faces is half a turn from that. The generator has said so in one
     * line since the fixtures were written. The first version of the
     * occupancy module used the bearing directly, which placed both pedestrian
     * crossings — the single most valuable piece of human presence in the
     * whole layer, a figure between the reader and a lit street — directly
     * behind the camera, where nothing would ever see them.
     *
     * It typechecked, it was deterministic, it produced a sensible-looking
     * count, and it was invisible. Only measuring found it.
     */
    for (const level of LEVEL_ORDER) {
      const index = LEVEL_ORDER.indexOf(level);
      const [cx, cz] = cameraAnchorXZ(index);
      const look = cameraBearing(index) + Math.PI;
      const people = peopleOn(level);
      expect(people.length, `${level} has nobody on it`).toBeGreaterThan(0);

      for (const f of people) {
        const range = Math.hypot(f.x - cx, f.z - cz);
        expect(range, `${level}: someone is beyond the fog`).toBeLessThanOrEqual(
          ZONE_MAX_RANGE + ZONE_BEHAVIOUR[f.kind].travel,
        );
        expect(range, `${level}: someone is standing on the lens`).toBeGreaterThan(4);
        const off = Math.abs(delta(Math.atan2(f.z - cz, f.x - cx), look));
        expect(
          off,
          `${level}: a ${f.kind} figure is ${((off * 180) / Math.PI).toFixed(0)}deg off axis`,
        ).toBeLessThanOrEqual(VIEW_ARC + 0.45);
      }
    }
  });

  it("stands them on the surface the level walks on", () => {
    // The interface camera is on a maintenance deck ninety-six metres above
    // its level's floor. Someone waiting for a train up there is standing on
    // the deck, and a figure placed on the floor instead would be a person
    // falling past the bottom of the frame forever.
    for (const level of LEVEL_ORDER) {
      const band = bandFor(level);
      for (const f of peopleOn(level)) {
        expect(f.y, `${level}`).toBeGreaterThanOrEqual(band.floor - 0.01);
        expect(f.y - band.floor, `${level}: someone is floating`).toBeLessThan(120);
      }
    }
  });

  it("gives everyone somewhere to be going", () => {
    for (const level of LEVEL_ORDER) {
      for (const f of peopleOn(level)) {
        expect(f.travel, `${level}`).toBeGreaterThan(0);
        expect(f.rate, `${level}`).toBeGreaterThan(0);
        expect(f.dwell, `${level}`).toBeGreaterThanOrEqual(0);
        expect(f.dwell, `${level}`).toBeLessThan(1);
        expect(f.phase).toBeGreaterThanOrEqual(0);
        expect(f.phase).toBeLessThan(1);
        expect(Number.isFinite(f.height)).toBe(true);
      }
    }
  });
});

describe("density says who uses the place", () => {
  it("does not populate every level equally", () => {
    /*
     * The brief's sharpest instruction, and the first measured run failed it
     * outright: the figure budget was per level, so the substrate — a sealed
     * hall four hundred and sixty-five metres down — carried exactly as many
     * people as a street under a transit station, spread over twenty-six
     * maintenance posts. That is not a city, it is a uniform scattering with
     * a hierarchy painted on the documentation.
     *
     * The ordering below *is* the characterisation. Nothing in the world
     * states it in words.
     */
    const counts = LEVEL_ORDER.map((l) => peopleOn(l).length);
    const [surface, iface, engine, substrate] = counts as [
      number,
      number,
      number,
      number,
    ];
    expect(surface, "the street should be the busiest place").toBeGreaterThan(engine);
    expect(iface).toBeGreaterThan(engine);
    expect(engine, "the plant floor is staffed, not visited").toBeGreaterThan(substrate);
    expect(substrate, "someone is down there").toBeGreaterThan(0);
    // And the gap is a real one rather than a rounding difference.
    expect(surface / Math.max(1, substrate)).toBeGreaterThan(2.5);
  });

  it("keeps the level scalars in the order the levels are used in", () => {
    expect(LEVEL_OCCUPANCY.surface).toBeGreaterThan(LEVEL_OCCUPANCY.interface);
    expect(LEVEL_OCCUPANCY.interface).toBeGreaterThan(LEVEL_OCCUPANCY.engine);
    expect(LEVEL_OCCUPANCY.engine).toBeGreaterThan(LEVEL_OCCUPANCY.substrate);
    for (const level of LEVEL_ORDER) {
      expect(levelBudget(level, HIGH.figures)).toBeLessThanOrEqual(HIGH.figures);
    }
  });

  it("sends people to the places worth putting them", () => {
    // Priority and weight have to agree, or the tier that drops zones drops
    // the wrong ones: a BALANCED city that keeps the corporate lobbies and
    // loses the transit platform has spent its budget on the least legible
    // human presence in the world.
    for (let i = 1; i < ZONE_PRIORITY.length; i += 1) {
      const above = ZONE_PRIORITY[i - 1]!;
      const here = ZONE_PRIORITY[i]!;
      expect(
        ZONE_WEIGHT[above],
        `${here} outranks ${above} by weight but not by priority`,
      ).toBeGreaterThanOrEqual(ZONE_WEIGHT[here]);
    }
  });

  it("keeps a corporate entrance sparser than a platform", () => {
    // Density and behaviour rather than a label. A tower lobby at midnight
    // has a guard and someone leaving late, not a crowd — and the sparseness
    // is the characterisation, so a livelier lobby would delete the point.
    expect(ZONE_CAP.entrance).toBeLessThan(ZONE_CAP.platform);
    expect(ZONE_CAP.entrance).toBeLessThan(ZONE_CAP.crossing);
    expect(ZONE_WEIGHT.entrance).toBeLessThan(ZONE_WEIGHT.platform);
    // Orderly, too: people arrive, go in, and are not milling about.
    expect(ZONE_BEHAVIOUR.entrance.dwell).toBeLessThan(ZONE_BEHAVIOUR.service.dwell);
  });

  it("makes a worker stay with the thing they are working on", () => {
    // A maintenance figure that walks seventeen metres is not maintaining
    // anything; it is commuting through a plant room. Service and maintenance
    // stay put and a pedestrian does not stop at all.
    expect(ZONE_BEHAVIOUR.crossing.dwell).toBe(0);
    expect(ZONE_BEHAVIOUR.service.travel).toBeLessThan(ZONE_BEHAVIOUR.crossing.travel);
    expect(ZONE_BEHAVIOUR.maintenance.travel).toBeLessThan(ZONE_BEHAVIOUR.service.travel);
    expect(ZONE_BEHAVIOUR.maintenance.dwell).toBeGreaterThan(ZONE_BEHAVIOUR.service.dwell);
    // And a commuter waits for the train rather than walking through the
    // station, which is the one behaviour the transit layer exists to show.
    expect(ZONE_BEHAVIOUR.platform.dwell).toBeGreaterThan(0.3);
  });

  it("never leaves a zone standing empty", () => {
    // A lit platform with nobody on it is worse than no platform: it is an
    // authored statement that this is a place people use, contradicted in
    // the same frame.
    for (const level of LEVEL_ORDER) {
      const zones = zonesFor(bandFor(level), level);
      const kinds = new Set(peopleOn(level).map((f) => f.kind));
      const dropped = Math.round(zones.length * HIGH.zoneKeep);
      if (dropped === zones.length) {
        for (const z of zones) {
          expect(kinds.has(z.kind), `${level}: an empty ${z.kind} zone`).toBe(true);
        }
      }
    }
  });
});

describe("the count is bounded whatever the budget asks for", () => {
  it("never exceeds what the level's places can hold", () => {
    /*
     * The cap is what turns a budget into a composition, and this is the
     * bound that makes the whole layer safe to give a number to.
     *
     * Measured before it existed: the level budget divided by however many
     * zones happened to exist, which put thirty people on one pedestrian
     * crossing and twenty-four around a single machine. A protest and a shift
     * change, rather than a street and a plant floor.
     */
    for (const level of LEVEL_ORDER) {
      const zones = zonesFor(bandFor(level), level);
      const ceiling = zones.reduce((sum, z) => sum + ZONE_CAP[z.kind], 0);
      const people = peopleOn(level);
      expect(people.length, `${level}`).toBeLessThanOrEqual(ceiling);
      expect(people.length, `${level}`).toBeLessThanOrEqual(
        levelBudget(level, HIGH.figures),
      );

      const perZone = new Map<string, number>();
      for (const f of people) {
        const key = `${f.kind}:${Math.round(f.x)}:${Math.round(f.z)}`;
        perZone.set(key, (perZone.get(key) ?? 0) + 1);
      }
      for (const [, n] of perZone) expect(n).toBeLessThanOrEqual(ZONE_CAP.platform);
    }
  });

  it("never authors more places of a kind than a level should have", () => {
    // Twenty-six maintenance posts on the substrate is a workforce, not
    // isolated service activity. The nearest few to the camera survive; the
    // rest are places nobody happens to be tonight.
    for (const level of LEVEL_ORDER) {
      const seen = new Map<ZoneKind, number>();
      for (const z of zonesFor(bandFor(level), level)) {
        seen.set(z.kind, (seen.get(z.kind) ?? 0) + 1);
      }
      for (const [kind, n] of seen) {
        expect(n, `${level} has ${n} ${kind} zones`).toBeLessThanOrEqual(ZONE_LIMIT[kind]);
      }
    }
  });

  it("costs the city one draw call and not one per person", () => {
    // Every figure on a level shares a single mesh, so an occupied city costs
    // one call more than an empty one however many people are in it. A
    // ceiling here is what stops someone "just adding a mesh".
    for (const tier of ["high", "balanced", "low"] as const) {
      expect(generateCity(tier).stats.drawCalls).toBeLessThanOrEqual(30);
    }
    expect(generateCity("high").stats.drawCalls).toBe(
      generateCity("balanced").stats.drawCalls + 1,
    );
  });
});

describe("a tier buys fewer people, not a different city", () => {
  it("thins the crowd as the tier drops", () => {
    for (const level of LEVEL_ORDER) {
      const high = peopleOn(level, "high").length;
      const balanced = peopleOn(level, "balanced").length;
      expect(balanced, `${level}`).toBeLessThanOrEqual(high);
    }
    const highTotal = LEVEL_ORDER.reduce((n, l) => n + peopleOn(l, "high").length, 0);
    const balancedTotal = LEVEL_ORDER.reduce(
      (n, l) => n + peopleOn(l, "balanced").length,
      0,
    );
    expect(balancedTotal).toBeLessThan(highTotal);
  });

  it("drops whole places rather than half-emptying all of them", () => {
    // A BALANCED platform should still look like a platform. Leaving every
    // zone in the city with two people in it is a larger lie than losing the
    // corporate lobby entirely.
    expect(BALANCED.zoneKeep).toBeLessThan(HIGH.zoneKeep);
    expect(HIGH.zoneKeep).toBe(1);
    for (const level of LEVEL_ORDER) {
      const all = zonesFor(bandFor(level), level);
      const kinds = new Set(peopleOn(level, "balanced").map((f) => f.kind));
      if (all.length > 2) {
        expect(kinds.size, `${level}`).toBeLessThanOrEqual(
          new Set(all.map((z) => z.kind)).size,
        );
      }
    }
  });

  it("draws nobody at the tier that never starts a renderer", () => {
    /*
     * LOW has no traffic, no steam and no rain either: it never reaches
     * WebGL, so the cheapest contextual movement it preserves is the CSS
     * atmosphere, which is the whole of what it renders. A figure count here
     * would be describing something that is never drawn.
     *
     * The same fact is what answers the mobile requirement — a phone is LOW,
     * a phone gets no WebGL, and no part of understanding this site has ever
     * depended on the city being drawn at all.
     */
    expect(ENVIRONMENT_BUDGET.low.figures).toBe(0);
    expect(ENVIRONMENT_BUDGET.low.zoneKeep).toBe(0);
    for (const level of LEVEL_ORDER) {
      const band = generateCity("low").levels.find((l) => l.level === level)!;
      expect(occupants(band, level, 0, 0)).toEqual([]);
    }
  });
});

describe("the same city is occupied the same way twice", () => {
  it("places and times everyone identically across runs", () => {
    // The world is deterministic and its people are part of the world. Two
    // readers on the same machine see the same person waiting in the same
    // place at the same point in their cycle.
    const key = (f: Figure) =>
      [
        f.kind,
        f.x.toFixed(4),
        f.y.toFixed(4),
        f.z.toFixed(4),
        f.bearing.toFixed(4),
        f.travel.toFixed(4),
        f.dwell.toFixed(4),
        f.rate.toFixed(5),
        f.phase.toFixed(5),
        f.height.toFixed(4),
        String(f.source),
      ].join(",");

    for (const level of LEVEL_ORDER) {
      const a = peopleOn(level, "high", generateCity("high")).map(key).join(";");
      const b = peopleOn(level, "high", generateCity("high")).map(key).join(";");
      expect(b, `${level} is not deterministic`).toBe(a);
      expect(a.length).toBeGreaterThan(0);
    }
  });

  it("does not put the whole crowd on one phase", () => {
    /*
     * The failure mode that a deterministic sequence invites: derive the
     * phase from the index within a zone and the six commuters on a platform
     * step forward together like a chorus line.
     *
     * The figure index runs across the whole level rather than restarting per
     * zone, and the phase comes off an irrational, so no two people share a
     * moment in their cycle.
     */
    for (const level of LEVEL_ORDER) {
      const people = peopleOn(level);
      if (people.length < 4) continue;
      const phases = people.map((f) => f.phase);
      expect(new Set(phases.map((p) => p.toFixed(4))).size).toBe(phases.length);
      // And spread across the cycle rather than bunched in a corner of it.
      expect(Math.max(...phases) - Math.min(...phases)).toBeGreaterThan(0.6);
      // Rates differ too, so pairs that start together do not stay together.
      expect(new Set(people.map((f) => f.rate.toFixed(5))).size).toBeGreaterThan(
        Math.min(3, people.length - 1),
      );
    }
  });

  it("carries no identity anyone could stop and inspect", () => {
    // These are atmosphere. There is no name, no id, no route and nothing
    // addressable on a figure, which is what keeps them out of the
    // accessibility tree and out of the evidence rules by construction rather
    // than by an attribute someone could forget to set.
    const keys = Object.keys(peopleOn("surface")[0]!).sort();
    expect(keys).toEqual(
      [
        "bearing",
        "dwell",
        "height",
        "kind",
        "phase",
        "rate",
        "source",
        "travel",
        "x",
        "y",
        "z",
      ].sort(),
    );
  });
});

describe("people are lit by the city they are standing in", () => {
  it("takes the colour of whatever lamp is nearest, where there is one", () => {
    // The same argument the steam and the rain already make. A figure is read
    // almost entirely as a shape against a background, so the one thing it
    // must not be is a flat cut-out belonging to no part of the scene.
    let lit = 0;
    let total = 0;
    for (const level of LEVEL_ORDER) {
      for (const f of peopleOn(level)) {
        total += 1;
        if (f.source !== null) lit += 1;
        // Nothing in the world is lit by the subject's own accent but the
        // subject, which is the rule the whole signage grammar rests on.
        expect(f.source).not.toBe("subject");
      }
    }
    expect(total).toBeGreaterThan(0);
    expect(lit, "nothing is lighting anybody").toBeGreaterThan(0);
  });
});
