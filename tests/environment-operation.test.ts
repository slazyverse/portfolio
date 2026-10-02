import { describe, expect, it } from "vitest";
import { LEVEL_ORDER } from "@/data/routes";
import type { StratumId } from "@/data/types";
import { TRANSIT, generateCity, viewBearing } from "@/lib/environment/generate";
import { BOARD_AT, BOARD_STAGGER, occupants } from "@/lib/environment/occupancy";
import { ENVIRONMENT_BUDGET } from "@/lib/environment/quality";
import {
  VEHICLE_COLOUR,
  angleAt,
  arrivalInterval,
  fleet,
  rateAt,
  services,
  serviceVehicles,
  travelAt,
} from "@/lib/environment/transit";

/**
 * An operated city.
 *
 * The world had architecture, weather, materials, landmarks and people, and
 * its infrastructure still ran on nothing. The clearest case was the transit
 * line, which was measured before it was touched:
 *
 *  - **sixty-eight** vehicles on a seven-hundred-and-forty-metre ring, one
 *    every eleven metres, each eleven to seventeen metres long. A solid chain
 *    of light shaped like carriages;
 *  - eight to nineteen kilometres an hour, between a brisk walk and a slow
 *    bicycle, taking up to six minutes to get round;
 *  - and one genuinely interesting behaviour — a deceleration deep enough to
 *    read as a stop — on a fixed thirty-nine second period with no
 *    relationship to where the station was. It stopped constantly, always
 *    somewhere else.
 *
 * None of that is visible in a diff and all of it is arithmetic, which is
 * exactly the class of thing that belongs in a test.
 */

const HIGH = ENVIRONMENT_BUDGET.high;
const BALANCED = ENVIRONMENT_BUDGET.balanced;
const LOOK = viewBearing("surface");

/** Signed angle between two bearings, in [-pi, pi]. */
function delta(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

describe("a train stops at the station", () => {
  const trains = fleet(HIGH.traffic, 0, LOOK).filter((v) => v.kind === "train");

  it("runs a line rather than a chain of carriages", () => {
    /*
     * Four, and the number it replaces was an accident rather than a
     * decision: the elevated lane took every fifth vehicle in the traffic
     * budget, which at this tier was sixty-eight of them.
     */
    expect(trains.length).toBe(TRANSIT.services);
    const spacing = (2 * Math.PI * TRANSIT.radius) / trains.length;
    const longest = Math.max(...trains.map((t) => t.length * 2));
    expect(spacing, "the trains are nose to tail").toBeGreaterThan(longest * 4);
  });

  it("moves at a speed a train moves at", () => {
    for (const t of trains) {
      const metresPerSecond = Math.abs(t.rate) * t.radius;
      expect(metresPerSecond).toBeGreaterThan(7);
      expect(metresPerSecond).toBeLessThan(20);
    }
  });

  it("is slowest exactly where the platform is", () => {
    /*
     * The defect this phase exists to fix, stated as an assertion.
     *
     * Written as `u - brake * sin(u)`, the minimum of the derivative falls at
     * u = 0 by construction, and at u = 0 the offset from the anchor is also
     * zero — so pointing the anchor at the station is the entire mechanism.
     * There is no phase to solve for and nothing to drift.
     */
    for (const t of trains) {
      let slowAt = 0;
      let slowest = Infinity;
      for (let s = 0; s < TRANSIT.period; s += 0.05) {
        const r = Math.abs(rateAt(t, s));
        if (r < slowest) {
          slowest = r;
          slowAt = s;
        }
      }
      const off = Math.abs(delta(angleAt(t, slowAt), LOOK));
      expect((off * 180) / Math.PI, "a train dwells away from the station").toBeLessThan(1);
      // And it is genuinely slow there: a tenth of line speed, not a dip.
      expect(slowest / Math.abs(t.rate)).toBeLessThan(0.12);
    }
  });

  it("arrives on an interval a reader will actually see one on", () => {
    // Evenly spaced, so the wait is the interval rather than four at once and
    // then a minute of nothing.
    const interval = arrivalInterval(HIGH.traffic);
    expect(interval).toBeCloseTo(TRANSIT.period / TRANSIT.services, 6);
    expect(interval).toBeLessThanOrEqual(20);

    const dwells = trains
      .map((t) => {
        let at = 0;
        let slowest = Infinity;
        for (let s = 0; s < TRANSIT.period; s += 0.05) {
          const r = Math.abs(rateAt(t, s));
          if (r < slowest) {
            slowest = r;
            at = s;
          }
        }
        return at;
      })
      .sort((a, b) => a - b);
    for (let i = 1; i < dwells.length; i += 1) {
      expect(dwells[i]! - dwells[i - 1]!).toBeCloseTo(interval, 0);
    }
  });

  it("is only drawn where there is track under it", () => {
    // The guideway is a sweep of about ninety degrees centred on the station,
    // not a closed loop. The ring is how a vehicle is computed, not something
    // the world contains.
    for (const t of trains) {
      expect(t.sweep).toBeLessThan(Math.PI / 2);
      expect(t.sweep).toBeGreaterThan(0.5);
    }
    for (const v of fleet(HIGH.traffic, 0, LOOK)) {
      if (v.kind === "train") continue;
      expect(v.sweep, `a ${v.kind} vehicle is clipped to an arc`).toBeGreaterThan(Math.PI);
    }
  });
});

describe("nothing in the street ever runs backwards", () => {
  it("keeps the brake under the one bound that matters", () => {
    /*
     * The whole motion model is `u - brake * sin(u * mul)`, whose derivative
     * is `1 - brake * mul * cos(...)`. That stays non-negative if and only if
     * `brake * mul` is at most one, and a streak that reverses is not
     * traffic — so the bound is asserted rather than trusted.
     */
    for (const tier of ["high", "balanced"] as const) {
      for (const v of fleet(ENVIRONMENT_BUDGET[tier].traffic, 0, LOOK)) {
        expect(v.brake * v.brakeMul, `a ${v.kind} vehicle can reverse`).toBeLessThan(1);
        expect(v.brake).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("never actually reverses, sampled over four minutes", () => {
    for (const v of fleet(HIGH.traffic, 0, LOOK)) {
      for (let s = 0; s < 240; s += 0.73) {
        const r = rateAt(v, s);
        expect(Math.sign(r), `a ${v.kind} vehicle reversed`).toBe(Math.sign(v.rate));
      }
    }
  });

  it("bunches the street at places rather than at times", () => {
    // A lane's brake minima fall at evenly spaced angles around its ring, so
    // traffic slows at the same handful of bearings on every lap. That is
    // what a junction looks like from a distance, and it falls out of
    // anchoring the brake to a place.
    const street = fleet(HIGH.traffic, 0, LOOK).filter((v) => v.kind === "street");
    expect(street.length).toBeGreaterThan(100);
    for (const v of street) {
      expect(v.brakeMul).toBeGreaterThanOrEqual(4);
      expect(Number.isInteger(v.brakeMul)).toBe(true);
    }
    // More than one lane, so they do not all queue in the same places.
    expect(new Set(street.map((v) => v.brakeMul)).size).toBeGreaterThan(1);
  });
});

describe("the city sends somebody to look after itself", () => {
  const all = fleet(HIGH.traffic, 0, LOOK);

  it("puts service vehicles on the road, and few of them", () => {
    const carts = all.filter((v) => v.kind === "service");
    expect(carts.length).toBeGreaterThan(0);
    expect(carts.length).toBeLessThan(all.length * 0.05);
    for (const c of carts) {
      // Low, slow, and carrying the one amber in this street that moves.
      expect(c.colour).toBe(VEHICLE_COLOUR.beacon);
      expect(Math.abs(c.rate) * c.radius).toBeLessThan(4);
      expect(c.length).toBeLessThan(2);
    }
  });

  it("spends the budget it stops spending on carriages", () => {
    // Cutting sixty-eight trains to four costs nothing, because the vertices
    // change lanes rather than disappearing.
    for (const tier of ["high", "balanced"] as const) {
      const count = ENVIRONMENT_BUDGET[tier].traffic;
      expect(fleet(count, 0, LOOK).length).toBe(count);
    }
    expect(fleet(0, 0, LOOK)).toEqual([]);
  });

  it("reduces what is running as the tier drops", () => {
    expect(services(BALANCED.traffic)).toBeLessThan(services(HIGH.traffic));
    expect(serviceVehicles(BALANCED.traffic)).toBeLessThan(serviceVehicles(HIGH.traffic));
    expect(services(0)).toBe(0);
    expect(serviceVehicles(0)).toBe(0);
    // A thinner service is a longer wait, which is what a timetable is.
    expect(arrivalInterval(BALANCED.traffic)).toBeGreaterThan(
      arrivalInterval(HIGH.traffic),
    );
    expect(arrivalInterval(0)).toBe(0);
  });
});

describe("the people on the platform are waiting for the train", () => {
  const city = generateCity("high");
  const bandFor = (l: StratumId) => city.levels.find((b) => b.level === l)!;
  const peopleOn = (l: StratumId, arrival: number) =>
    occupants(bandFor(l), l, HIGH.figures, HIGH.zoneKeep, arrival);

  it("puts the queue on the timetable rather than on its own clock", () => {
    /*
     * The difference between a station with people near it and a station
     * being used, and it costs two numbers. Phase 13 put commuters on a
     * platform and the trains went past them on an unrelated clock; a reader
     * could watch for a minute and never see the two facts connect.
     */
    const arrival = arrivalInterval(HIGH.traffic);
    const platform = peopleOn("surface", arrival).filter((f) => f.kind === "platform");
    expect(platform.length).toBeGreaterThan(0);
    for (const f of platform) {
      expect(f.rate, "a commuter is not on the service interval").toBeCloseTo(
        1 / arrival,
        9,
      );
      // Boarding happens at the moment a train is at rest, give or take the
      // stagger that stops the queue moving as one rank.
      const fromBoarding = BOARD_AT - f.phase;
      expect(fromBoarding).toBeGreaterThanOrEqual(-1e-9);
      expect(fromBoarding).toBeLessThan(platform.length * BOARD_STAGGER + 1e-9);
    }
  });

  it("still staggers them, so a queue is not a chorus line", () => {
    const arrival = arrivalInterval(HIGH.traffic);
    const platform = peopleOn("surface", arrival).filter((f) => f.kind === "platform");
    const phases = platform.map((f) => f.phase);
    expect(new Set(phases.map((p) => p.toFixed(5))).size).toBe(phases.length);
    // And the whole platform empties in a few seconds rather than a few
    // frames or a few minutes.
    const spread = (Math.max(...phases) - Math.min(...phases)) * arrival;
    expect(spread).toBeGreaterThan(0.5);
    expect(spread).toBeLessThan(8);
  });

  it("leaves everyone else on their own clock", () => {
    const arrival = arrivalInterval(HIGH.traffic);
    const others = peopleOn("surface", arrival).filter((f) => f.kind !== "platform");
    expect(others.length).toBeGreaterThan(0);
    expect(new Set(others.map((f) => f.rate.toFixed(6))).size).toBeGreaterThan(1);
  });

  it("gives nobody a timetable where no train is running", () => {
    // A level with no service should look like one: people on their own
    // cycles, waiting for nothing.
    const none = peopleOn("surface", 0);
    const platform = none.filter((f) => f.kind === "platform");
    expect(platform.length).toBeGreaterThan(0);
    expect(new Set(platform.map((f) => f.rate.toFixed(6))).size).toBeGreaterThan(1);
  });

  it("is still the same city twice", () => {
    const arrival = arrivalInterval(HIGH.traffic);
    const key = () =>
      LEVEL_ORDER.flatMap((l) =>
        peopleOn(l, arrival).map(
          (f) => `${f.kind}:${f.x.toFixed(4)}:${f.rate.toFixed(6)}:${f.phase.toFixed(6)}`,
        ),
      ).join(";");
    expect(key()).toBe(key());
    const a = fleet(HIGH.traffic, 0, LOOK).map((v) => `${v.kind}:${v.rate}:${v.offset}`);
    const b = fleet(HIGH.traffic, 0, LOOK).map((v) => `${v.kind}:${v.rate}:${v.offset}`);
    expect(a).toEqual(b);
    // And the vehicles are where they were, at a given moment.
    for (const [i, v] of fleet(HIGH.traffic, 0, LOOK).entries()) {
      expect(travelAt(v, 37.5)).toBe(travelAt(fleet(HIGH.traffic, 0, LOOK)[i]!, 37.5));
    }
  });
});

describe("the station says what it is doing", () => {
  const city = generateCity("high");

  it("lights the platform on the service interval, and only there", () => {
    for (const level of city.levels) {
      const station = level.lights.filter((l) => l.behaviour === "service");
      const hasTransit = level.level === "surface" || level.level === "interface";
      if (!hasTransit) {
        expect(station.length, `${level.level} has a station it should not`).toBe(0);
        continue;
      }
      expect(station.length, `${level.level}`).toBeGreaterThan(0);
      expect(station.length, `${level.level}`).toBeLessThanOrEqual(6);
      for (const c of station) {
        // Exempt from the quota, for the beacon's reason: a signal with two
        // of its cells thinned away is not dimmer, it is broken.
        expect(c.fixed).toBe(true);
        // Every cell states the same fact at the same moment, which is what
        // separates a signal from a decoration.
        expect(c.phase).toBe(0);
        expect(c.source).not.toBe("subject");
      }
    }
  });

  it("stands near the platform it belongs to", () => {
    const surface = city.levels.find((l) => l.level === "surface")!;
    const look = viewBearing("surface");
    const sx = Math.cos(look) * TRANSIT.radius;
    const sz = Math.sin(look) * TRANSIT.radius;
    for (const c of surface.lights.filter((l) => l.behaviour === "service")) {
      const range = Math.hypot(c.position[0] - sx, c.position[2] - sz);
      expect(range, "a station light is not at the station").toBeLessThan(30);
    }
  });

  it("does not turn the city into a light show", () => {
    /*
     * An existing guard, and it caught this phase's first draft.
     *
     * The city is not allowed to animate more than a fifth of its lights, and
     * it was already at 18.9% — so the station had about thirteen cells of
     * headroom in the entire world and the draft spent eighteen of them. The
     * guard was right. What went was the far side of the platform, which the
     * camera never sees.
     */
    const lights = city.levels.flatMap((l) => l.lights);
    const moving = lights.filter((l) => l.behaviour !== "steady").length;
    expect(moving / lights.length).toBeLessThan(0.2);
  });
});

describe("one world, one of everything", () => {
  it("builds each level once and reuses it", () => {
    // Nothing here may quietly become per-component. The city is generated
    // once per tier and every system reads the same model.
    const a = generateCity("high");
    const b = generateCity("high");
    expect(a.levels.length).toBe(LEVEL_ORDER.length);
    expect(new Set(a.levels.map((l) => l.level)).size).toBe(LEVEL_ORDER.length);
    for (const [i, level] of a.levels.entries()) {
      expect(level.lights.length).toBe(b.levels[i]!.lights.length);
      expect(level.fixtures.length).toBe(b.levels[i]!.fixtures.length);
    }
  });

  it("keeps the whole operated city inside its draw-call ceiling", () => {
    // Everything this phase added rides in meshes that already existed: the
    // trains and the service vehicles are the traffic mesh, and the station's
    // signals are the accent mesh.
    for (const tier of ["high", "balanced", "low"] as const) {
      expect(generateCity(tier).stats.drawCalls).toBeLessThanOrEqual(30);
    }
  });
});
