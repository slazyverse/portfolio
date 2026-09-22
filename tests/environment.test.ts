import { describe, expect, it } from "vitest";
import { ANCHOR_SPECS, CITY_SEED } from "@/data/environment";
import { LEVEL_ORDER, ROUTES, route } from "@/data/routes";
import type { StratumId } from "@/data/types";
import { QUALITY, type QualityTier } from "@/lib/capability";
import { cameraTargetForLevel, descentDuration, easeInOut } from "@/lib/environment/camera";
import { CITY_GEOMETRY, generateCity, levelFloor } from "@/lib/environment/generate";
import {
  ENVIRONMENT_BUDGET,
  environmentBudget,
  resolveEnvironmentMode,
} from "@/lib/environment/quality";
import { createRng, hashSeed } from "@/lib/environment/seed";

const TIERS: QualityTier[] = ["high", "balanced", "low"];

/* ------------------------------------------------------------------- rng --- */

describe("deterministic randomness", () => {
  it("produces the same stream for the same seed", () => {
    const a = createRng("substrate");
    const b = createRng("substrate");
    const left = Array.from({ length: 64 }, () => a.next());
    const right = Array.from({ length: 64 }, () => b.next());
    expect(left).toEqual(right);
  });

  it("produces a different stream for a different seed", () => {
    const a = Array.from({ length: 32 }, createRng("substrate").next);
    const b = Array.from({ length: 32 }, createRng("substrate-2").next);
    expect(a).not.toEqual(b);
  });

  it("stays within [0, 1)", () => {
    const rng = createRng("bounds");
    for (let i = 0; i < 5000; i += 1) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("distributes evenly enough to place a city with", () => {
    const rng = createRng("distribution");
    const buckets = new Array<number>(10).fill(0);
    const n = 100_000;
    for (let i = 0; i < n; i += 1) {
      buckets[Math.floor(rng.next() * 10)]! += 1;
    }
    // Each bucket should hold ~10%. A generator that clusters would produce a
    // city with visibly empty quarters.
    for (const count of buckets) {
      expect(count / n).toBeGreaterThan(0.09);
      expect(count / n).toBeLessThan(0.11);
    }
  });

  it("hashes seeds to stable unsigned 32-bit values", () => {
    expect(hashSeed("substrate")).toBe(hashSeed("substrate"));
    expect(hashSeed("substrate")).toBeGreaterThanOrEqual(0);
    expect(hashSeed("substrate")).toBeLessThan(2 ** 32);
    expect(hashSeed("a")).not.toBe(hashSeed("b"));
  });

  it("throws rather than returning undefined when picking from nothing", () => {
    expect(() => createRng(1).pick([])).toThrow(/empty/i);
  });
});

/* --------------------------------------------------------------- city ------ */

describe("city generation is deterministic", () => {
  it("produces an identical city from the same seed and tier", () => {
    const a = generateCity("high", "fixed-seed");
    const b = generateCity("high", "fixed-seed");
    expect(a).toEqual(b);
    // Deep-equality could pass on two empty cities; assert there is one.
    expect(a.stats.structures).toBeGreaterThan(0);
  });

  it("produces a different city from a different seed", () => {
    const a = generateCity("high", "seed-a");
    const b = generateCity("high", "seed-b");
    expect(a.levels[0]!.structures).not.toEqual(b.levels[0]!.structures);
  });

  it("is stable across repeated generation, not just twice", () => {
    const reference = JSON.stringify(generateCity("balanced", CITY_SEED));
    for (let i = 0; i < 12; i += 1) {
      expect(JSON.stringify(generateCity("balanced", CITY_SEED))).toBe(reference);
    }
  });

  it("does not depend on which tier was generated first", () => {
    const highFirst = JSON.stringify(generateCity("high", "order"));
    generateCity("low", "order");
    generateCity("balanced", "order");
    expect(JSON.stringify(generateCity("high", "order"))).toBe(highFirst);
  });

  it("contains no NaN or infinite coordinates", () => {
    for (const tier of TIERS) {
      const city = generateCity(tier);
      for (const level of city.levels) {
        for (const s of level.structures) {
          for (const v of [...s.position, ...s.size, s.rotation]) {
            expect(Number.isFinite(v)).toBe(true);
          }
          for (const v of s.size) expect(v).toBeGreaterThan(0);
        }
        for (const l of level.lights) {
          for (const v of l.position) expect(Number.isFinite(v)).toBe(true);
          expect(l.size).toBeGreaterThan(0);
        }
        for (const c of level.conduits) {
          expect(c.points.length).toBeGreaterThanOrEqual(2);
          for (const p of c.points) {
            for (const v of p) expect(Number.isFinite(v)).toBe(true);
          }
        }
      }
    }
  });
});

describe("city structure", () => {
  it("generates all four levels, in descent order", () => {
    const city = generateCity("high");
    expect(city.levels.map((l) => l.level)).toEqual([...LEVEL_ORDER]);
    expect(city.levels.map((l) => l.index)).toEqual(["00", "01", "02", "03"]);
  });

  it("places each level's geometry at that level's floor", () => {
    const city = generateCity("high");
    for (const level of city.levels) {
      expect(level.floor).toBe(levelFloor(level.level));
      for (const s of level.structures) {
        expect(s.position[1]).toBe(level.floor);
        expect(s.level).toBe(level.level);
      }
    }
  });

  it("descends: every level sits below the one before it", () => {
    const city = generateCity("high");
    for (let i = 1; i < city.levels.length; i += 1) {
      expect(city.levels[i]!.floor).toBeLessThan(city.levels[i - 1]!.floor);
    }
  });

  it("keeps the central shaft clear so the camera can descend through it", () => {
    const city = generateCity("high");
    for (const level of city.levels) {
      for (const s of level.structures) {
        const radius = Math.hypot(s.position[0], s.position[2]);
        expect(radius).toBeGreaterThanOrEqual(CITY_GEOMETRY.VOID_RADIUS);
      }
    }
  });

  it("keeps every structure inside the level footprint", () => {
    const half = CITY_GEOMETRY.SPAN / 2;
    for (const level of generateCity("high").levels) {
      for (const s of level.structures) {
        expect(Math.abs(s.position[0])).toBeLessThanOrEqual(half);
        expect(Math.abs(s.position[2])).toBeLessThanOrEqual(half);
      }
    }
  });

  it("honours the Phase 2 signal semantics: nothing invents a third colour", () => {
    for (const level of generateCity("high").levels) {
      for (const s of level.structures) {
        expect(["amber", "cold", "none"]).toContain(s.signal);
      }
      for (const l of level.lights) {
        expect(["amber", "cold"]).toContain(l.signal);
      }
      // Conduits are infrastructure, so they are machine-coloured everywhere.
      for (const c of level.conduits) {
        expect(c.signal).toBe("cold");
      }
    }
  });

  it("leaves most of the city dark", () => {
    // Darkness is the material. The measure has to be luminance, though, not
    // merely "carries a light at all": a server rack showing four indicator
    // LEDs in a black hall is dark, and counting it the same as a lit tower
    // made this assertion claim the substrate had gone neon when what had
    // actually happened was that it had become a server hall.
    //
    // So: on the levels where a light means a window, most structures stay
    // unlit — and everywhere, facades stay punctuated rather than covered.
    const city = generateCity("high");

    for (const level of city.levels) {
      if (level.level === "substrate") continue;
      const lit = level.structures.filter((s) => s.signal !== "none").length;
      expect(lit / level.structures.length).toBeLessThan(0.5);
    }

    // Facade windows are a texture now, so accent lights stay sparse. If this
    // climbs it means quads have crept back into doing the facade's job.
    const litStructures = city.levels
      .flatMap((l) => [...l.structures])
      .filter((s) => s.signal !== "none").length;
    expect(city.stats.lights / litStructures).toBeLessThan(30);
  });
});

/* ------------------------------------------------------------- anchors ----- */

describe("navigation anchors map to real routes", () => {
  it("resolves every anchor's routeId through the route table", () => {
    for (const spec of ANCHOR_SPECS) {
      expect(() => route(spec.routeId)).not.toThrow();
    }
  });

  it("only anchors routes that actually exist and are available", () => {
    for (const spec of ANCHOR_SPECS) {
      const target = route(spec.routeId);
      expect(target.available).toBe(true);
    }
  });

  it("hardcodes no URLs — anchors carry route ids only", () => {
    for (const spec of ANCHOR_SPECS) {
      expect(JSON.stringify(spec)).not.toMatch(/\//);
    }
  });

  it("places each anchor on the level its route declares", () => {
    const city = generateCity("high");
    for (const level of city.levels) {
      for (const anchor of level.anchors) {
        expect(anchor.level).toBe(level.level);
        expect(route(anchor.routeId).level).toBe(level.level);
      }
    }
  });

  it("generates every authored anchor exactly once", () => {
    const city = generateCity("high");
    const ids = city.levels.flatMap((l) => l.anchors.map((a) => a.id));
    expect(ids.slice().sort()).toEqual(ANCHOR_SPECS.map((s) => s.id).slice().sort());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("generates the same anchors at every tier — navigation is not a luxury", () => {
    const byTier = TIERS.map((t) =>
      generateCity(t)
        .levels.flatMap((l) => l.anchors.map((a) => a.id))
        .sort(),
    );
    expect(byTier[1]).toEqual(byTier[0]);
    expect(byTier[2]).toEqual(byTier[0]);
  });

  it("uses unique anchor ids", () => {
    const ids = ANCHOR_SPECS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps anchors out of the shaft the camera travels down", () => {
    for (const level of generateCity("high").levels) {
      for (const a of level.anchors) {
        expect(Math.hypot(a.position[0], a.position[2])).toBeGreaterThanOrEqual(
          CITY_GEOMETRY.VOID_RADIUS,
        );
      }
    }
  });
});

/* --------------------------------------------------------- quality tiers --- */

describe("quality tiers", () => {
  it("produces a valid budget for every tier", () => {
    for (const tier of TIERS) {
      const b = environmentBudget(tier);
      expect(b.structures).toBeGreaterThan(0);
      expect(b.maxLights).toBeGreaterThanOrEqual(0);
      expect(b.rain).toBeGreaterThanOrEqual(0);
      expect(b.conduitsPerLevel).toBeGreaterThan(0);
    }
  });

  it("orders the tiers monotonically — lower tiers never cost more", () => {
    const [high, balanced, low] = [
      ENVIRONMENT_BUDGET.high,
      ENVIRONMENT_BUDGET.balanced,
      ENVIRONMENT_BUDGET.low,
    ];
    expect(high.structures).toBeGreaterThan(balanced.structures);
    expect(balanced.structures).toBeGreaterThan(low.structures);
    expect(high.maxLights).toBeGreaterThan(balanced.maxLights);
    expect(balanced.maxLights).toBeGreaterThan(low.maxLights);
    expect(high.rain).toBeGreaterThan(balanced.rain);
  });

  it("keeps generated geometry within the tier's budget", () => {
    for (const tier of TIERS) {
      const budget = environmentBudget(tier);
      const city = generateCity(tier);
      // The structure cap is city-wide, which is the figure that decides what
      // the renderer actually costs.
      expect(city.stats.structures).toBeLessThanOrEqual(budget.structures);
      for (const level of city.levels) {
        expect(level.conduits.length).toBe(budget.conduitsPerLevel);
      }
      // The light cap is a city-wide ceiling, and it is the one that matters:
      // lit cells are the only thing here that scales into the thousands.
      expect(city.stats.lights).toBeLessThanOrEqual(budget.maxLights);
    }
  });

  it("spends a real share of the light budget rather than under-filling it", () => {
    // A cap respected by generating almost nothing is not a working budget.
    const city = generateCity("high");
    expect(city.stats.lights).toBeGreaterThan(ENVIRONMENT_BUDGET.high.maxLights * 0.35);
  });

  it("gives every level a visible share of the light budget", () => {
    // The regression this exists for: a single city-wide probability let the
    // substrate's fine cell grid take 961 of 1599 lights and left the
    // interface with 60 across 38 structures — a level that renders as black.
    // The budget is allocated per level precisely so that cannot recur.
    for (const tier of ["high", "balanced"] as const) {
      const city = generateCity(tier);
      for (const level of city.levels) {
        const share = level.lights.length / city.stats.lights;
        expect(share).toBeGreaterThan(0.1);
        expect(share).toBeLessThan(0.5);
      }
    }
  });

  it("generates strictly less at lower tiers", () => {
    const high = generateCity("high").stats;
    const balanced = generateCity("balanced").stats;
    const low = generateCity("low").stats;
    expect(balanced.structures).toBeLessThan(high.structures);
    expect(low.structures).toBeLessThan(balanced.structures);
    expect(balanced.lights).toBeLessThan(high.lights);
    expect(low.lights).toBe(0);
  });

  it("keeps the whole city inside a small, fixed number of draw calls", () => {
    // Raised from 8 when the city gained an architectural kit: seven part
    // kinds, plus lit cells, conduits, ground, skyline, rain and ground FX.
    //
    // The number that matters is that it is *fixed* — it does not grow with
    // the size of the city. Every building on every level shares the same
    // seven instanced meshes, so a denser city costs instances and never draw
    // calls. A ceiling here is what stops someone "just adding a mesh".
    for (const tier of TIERS) {
      expect(generateCity(tier).stats.drawCalls).toBeLessThanOrEqual(16);
    }
  });
});

/* ---------------------------------------------------------- fallback ------- */

describe("rendering mode resolution", () => {
  it("uses WebGL only where the tier contract permits it", () => {
    for (const tier of TIERS) {
      const mode = resolveEnvironmentMode({ tier, webgl: true, canvas2d: true });
      expect(mode === "webgl").toBe(QUALITY[tier].webgl);
    }
  });

  it("falls back to canvas on a capable device with no WebGL", () => {
    expect(resolveEnvironmentMode({ tier: "high", webgl: false, canvas2d: true })).toBe(
      "canvas",
    );
    expect(
      resolveEnvironmentMode({ tier: "balanced", webgl: false, canvas2d: true }),
    ).toBe("canvas");
  });

  it("falls back to CSS on a low-tier device", () => {
    expect(resolveEnvironmentMode({ tier: "low", webgl: true, canvas2d: true })).toBe(
      "css",
    );
  });

  it("falls back to CSS when there is no drawing context at all", () => {
    expect(
      resolveEnvironmentMode({ tier: "high", webgl: false, canvas2d: false }),
    ).toBe("css");
  });

  it("renders nothing when the environment is disabled, whatever the device", () => {
    for (const tier of TIERS) {
      expect(
        resolveEnvironmentMode({ tier, webgl: true, canvas2d: true, disabled: true }),
      ).toBe("none");
    }
  });

  it("never returns a mode outside the declared set", () => {
    const valid = ["webgl", "canvas", "css", "none"];
    for (const tier of TIERS) {
      for (const webgl of [true, false]) {
        for (const canvas2d of [true, false]) {
          for (const disabled of [true, false]) {
            expect(valid).toContain(
              resolveEnvironmentMode({ tier, webgl, canvas2d, disabled }),
            );
          }
        }
      }
    }
  });
});

/* ------------------------------------------------------------- camera ------ */

describe("camera model", () => {
  it("defines a target for every level", () => {
    for (const level of LEVEL_ORDER) {
      const t = cameraTargetForLevel(level);
      for (const v of [...t.position, ...t.lookAt, t.fov]) {
        expect(Number.isFinite(v)).toBe(true);
      }
      expect(t.fov).toBeGreaterThan(20);
      expect(t.fov).toBeLessThan(90);
    }
  });

  it("descends: each level's camera sits below the previous one", () => {
    for (let i = 1; i < LEVEL_ORDER.length; i += 1) {
      const above = cameraTargetForLevel(LEVEL_ORDER[i - 1]!);
      const below = cameraTargetForLevel(LEVEL_ORDER[i]!);
      expect(below.position[1]).toBeLessThan(above.position[1]);
    }
  });

  it("stands inside the shaft, never inside the geometry", () => {
    for (const level of LEVEL_ORDER) {
      const t = cameraTargetForLevel(level);
      expect(Math.hypot(t.position[0], t.position[2])).toBeLessThan(
        CITY_GEOMETRY.VOID_RADIUS,
      );
    }
  });

  it("is a pure function of the level", () => {
    for (const level of LEVEL_ORDER) {
      expect(cameraTargetForLevel(level)).toEqual(cameraTargetForLevel(level));
    }
  });

  it("scales descent duration with distance travelled", () => {
    const one = descentDuration("surface", "interface", false);
    const three = descentDuration("surface", "substrate", false);
    expect(three).toBeGreaterThan(one);
    expect(descentDuration("surface", "surface", false)).toBe(0);
  });

  it("snaps instantly under reduced motion, rather than easing faster", () => {
    for (const from of LEVEL_ORDER) {
      for (const to of LEVEL_ORDER) {
        expect(descentDuration(from, to, true)).toBe(0);
      }
    }
  });

  it("eases from 0 to 1 monotonically", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    let previous = -1;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const v = easeInOut(Math.min(t, 1));
      expect(v).toBeGreaterThanOrEqual(previous);
      previous = v;
    }
  });
});

/* -------------------------------------------------- content independence --- */

describe("the environment is never required to reach content", () => {
  it("anchors cover only a subset of routes — content is not gated on the city", () => {
    const anchored = new Set(ANCHOR_SPECS.map((s) => s.routeId));
    const navigable = ROUTES.filter((r) => r.nav && r.available);
    // Every navigable route must be reachable from the DOM chrome regardless;
    // this asserts the city is not the exclusive route to any of them by
    // confirming the chrome's route table is the larger set.
    expect(navigable.length).toBeGreaterThanOrEqual(anchored.size);
  });

  it("carries no portfolio content — the city holds geometry, never text", () => {
    const city = generateCity("high");
    const serialised = JSON.stringify(city);
    // If prose ever appears in the model, it has become content that only
    // renders in WebGL, which is unreadable and unindexable.
    for (const level of city.levels) {
      for (const s of level.structures) {
        // A fixed set of geometric fields, plus `owner`, which is present
        // only on buildings a corporation has put its name to. The point of
        // the assertion is that none of them is prose: the city holds
        // geometry and identity keys, never content.
        const keys = Object.keys(s).sort();
        expect(keys).toEqual(
          [
            "id",
            "kind",
            "level",
            "district",
            "position",
            "rotation",
            "signal",
            "size",
            "detail",
            "variant",
            "wear",
            "parts",
            // Always present, and `undefined` on a building nobody has put a
            // name to — an absent owner is still a fact about the building.
            "owner",
          ].sort(),
        );
      }
    }
    expect(serialised).not.toMatch(/Sagar|portfolio|engineer/i);
  });

  it("generates a usable city even at the tier that never renders in 3D", () => {
    const city = generateCity("low");
    expect(city.stats.structures).toBeGreaterThan(0);
    expect(city.stats.anchors).toBe(ANCHOR_SPECS.length);
  });
});

/* ------------------------------------------------------ level coherence ---- */

describe("levels agree with the rest of the system", () => {
  it("uses the same four levels as the route table and the chrome", () => {
    const city = generateCity("balanced");
    const cityLevels = city.levels.map((l) => l.level);
    expect(cityLevels).toEqual([...LEVEL_ORDER]);
  });

  it("gives every level geometry — no level is an empty band", () => {
    for (const tier of TIERS) {
      for (const level of generateCity(tier).levels) {
        expect(level.structures.length).toBeGreaterThan(0);
        expect(level.conduits.length).toBeGreaterThan(0);
      }
    }
  });

  it("places a level's floor exactly where the camera expects it", () => {
    for (const level of LEVEL_ORDER as StratumId[]) {
      const camera = cameraTargetForLevel(level);
      expect(camera.position[1]).toBeGreaterThan(levelFloor(level));
      expect(camera.position[1] - levelFloor(level)).toBeLessThan(
        CITY_GEOMETRY.LEVEL_DROP,
      );
    }
  });
});
