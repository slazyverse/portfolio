import { describe, expect, it } from "vitest";
import type { QualityTier } from "@/lib/capability";
import { CITY_GEOMETRY, generateCity } from "@/lib/environment/generate";
import { ENVIRONMENT_BUDGET, environmentBudget } from "@/lib/environment/quality";

/**
 * The architectural layer.
 *
 * `environment.test.ts` proves the city is deterministic, budgeted and wired to
 * the route table. This file covers what the Phase 5 upgrade added on top: the
 * building grammar, the landmark, the horizon, and tiers that differ by
 * fidelity rather than only by count.
 *
 * Every assertion here corresponds to something that was visibly wrong at some
 * point and was fixed — a mast towering over a server cabinet, a horizon that
 * stopped at the edge of the grid, a "landmark" no taller than its neighbours.
 */

const TIERS: QualityTier[] = ["high", "balanced", "low"];
const KIT_KINDS = [
  "mass",
  "fin",
  "roofUnit",
  "tank",
  "mast",
  "sign",
  "pipe",
  // Phase 5B: relief bands and balconies, skybridges, street furniture.
  "platform",
  "bridge",
  "prop",
  // Phase 5C: the one ring in the kit, for the corporation whose mark is one.
  "ring",
];

describe("buildings are composed, not extruded", () => {
  it("assembles every building from kit pieces", () => {
    for (const level of generateCity("high").levels) {
      for (const s of level.structures) {
        expect(s.parts.length).toBeGreaterThan(0);
        // At minimum a mass. A building with no volume is not a building.
        expect(s.parts.some((p) => p.kind === "mass")).toBe(true);
      }
    }
  });

  it("gives near buildings more of the kit than far ones", () => {
    const all = generateCity("high").levels.flatMap((l) => [...l.structures]);
    const near = all.filter((s) => s.detail === "near");
    const far = all.filter((s) => s.detail === "far");
    expect(near.length).toBeGreaterThan(0);
    expect(far.length).toBeGreaterThan(0);

    const mean = (list: typeof all) =>
      list.reduce((n, s) => n + s.parts.length, 0) / list.length;
    // The entire point of detail tiers: a building nobody can resolve does not
    // pay for fins, pipework and signage.
    expect(mean(near)).toBeGreaterThan(mean(far));
  });

  it("only uses kit kinds the renderer knows how to draw", () => {
    for (const level of generateCity("high").levels) {
      for (const s of level.structures) {
        for (const p of s.parts) expect(KIT_KINDS).toContain(p.kind);
      }
    }
  });

  it("keeps every part finite and positively sized", () => {
    for (const tier of TIERS) {
      for (const level of generateCity(tier).levels) {
        for (const s of level.structures) {
          for (const p of s.parts) {
            for (const v of [...p.position, ...p.size, p.rotation]) {
              expect(Number.isFinite(v)).toBe(true);
            }
            for (const v of p.size) expect(v).toBeGreaterThan(0);
            expect(p.wear).toBeGreaterThanOrEqual(0);
            expect(p.wear).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it("scales rooftop equipment to the building it stands on", () => {
    // The substrate once rendered as a floor of small cabinets under a forest
    // of forty-metre poles, because masts had an absolute height range. Roof
    // equipment is sized against its host now.
    for (const level of generateCity("high").levels) {
      for (const s of level.structures) {
        const footprint = Math.max(s.size[0], s.size[2]);
        for (const p of s.parts) {
          if (p.kind !== "mast" && p.kind !== "tank") continue;
          expect(
            p.size[1],
            `${p.kind} of ${p.size[1].toFixed(1)}m on a ${footprint.toFixed(1)}m footprint`,
          ).toBeLessThan(Math.max(footprint * 4, 50));
        }
      }
    }
  });

  it("puts signage only on buildings large enough to carry it", () => {
    // Signage, not every emissive part. Obstruction lamps at the top of a
    // mast share the same instanced mesh — they are a metre of light on a
    // pole, and a server rack is entitled to one. The rule being tested is
    // about things a person is meant to read.
    const isSignage = (p: { kind: string; size: readonly number[] }) =>
      p.kind === "sign" && Math.max(p.size[0]!, p.size[1]!, p.size[2]!) > 1.2;

    for (const level of generateCity("high").levels) {
      for (const s of level.structures) {
        if (!s.parts.some(isSignage)) continue;
        expect(Math.max(s.size[0], s.size[2])).toBeGreaterThanOrEqual(6);
      }
    }
  });

  it("stays within a bounded part count", () => {
    // Parts are instances, which are cheap but not free — and an unbounded
    // grammar is how a generator quietly produces a hundred thousand of them.
    const city = generateCity("high");
    expect(city.stats.parts).toBeGreaterThan(city.stats.structures);
    expect(city.stats.parts).toBeLessThan(12_000);
  });
});

describe("the landmark", () => {
  const heroOf = (tier: QualityTier, seed?: string) =>
    generateCity(tier, seed)
      .levels.flatMap((l) => l.structures)
      .find((s) => s.id.endsWith("-hero"));

  it("stands on the surface and towers over its neighbours", () => {
    const surface = generateCity("high").levels.find((l) => l.level === "surface")!;
    const hero = surface.structures.find((s) => s.id.endsWith("-hero"));
    expect(hero, "the surface should have a landmark").toBeDefined();

    const tallest = Math.max(
      ...surface.structures.filter((s) => s !== hero).map((s) => s.size[1]),
    );
    // A landmark that is merely one of the tall ones is not a landmark. A
    // generated city with no hero is a texture: everything equally
    // interesting, so nothing is.
    expect(hero!.size[1]).toBeGreaterThan(tallest * 1.4);
  });

  it("carries the most detail in the city", () => {
    expect(heroOf("high")!.detail).toBe("hero");
  });

  it("stands inside the city rather than outside it", () => {
    const hero = heroOf("high")!;
    const half = CITY_GEOMETRY.SPAN / 2;
    expect(Math.abs(hero.position[0])).toBeLessThanOrEqual(half);
    expect(Math.abs(hero.position[2])).toBeLessThanOrEqual(half);
  });

  it("is deterministic like everything else", () => {
    expect(heroOf("high", "hero-seed")).toEqual(heroOf("high", "hero-seed"));
  });

  it("appears at every tier, because the landmark is not a luxury", () => {
    for (const tier of TIERS) {
      expect(heroOf(tier), `${tier} should still have its landmark`).toBeDefined();
    }
  });
});

describe("the horizon", () => {
  it("gives every level a skyline so the world does not stop at its edge", () => {
    for (const tier of TIERS) {
      const budget = environmentBudget(tier);
      for (const level of generateCity(tier).levels) {
        expect(level.skyline.length).toBe(budget.skyline);
      }
    }
  });

  it("places the skyline beyond the buildable footprint", () => {
    const half = CITY_GEOMETRY.SPAN / 2;
    for (const level of generateCity("high").levels) {
      for (const s of level.skyline) {
        expect(Math.hypot(s.position[0], s.position[2])).toBeGreaterThan(half);
      }
    }
  });

  it("keeps impostors finite and sized", () => {
    for (const level of generateCity("high").levels) {
      for (const s of level.skyline) {
        for (const v of [...s.position, ...s.size]) {
          expect(Number.isFinite(v)).toBe(true);
        }
        for (const v of s.size) expect(v).toBeGreaterThan(0);
        expect(s.depth).toBeGreaterThanOrEqual(0);
        expect(s.depth).toBeLessThanOrEqual(1);
      }
    }
  });

  it("dims with distance, so the horizon reads as distance", () => {
    const shapes = generateCity("high").levels.flatMap((l) => [...l.skyline]);
    const near = shapes.filter((s) => s.depth < 0.5);
    const far = shapes.filter((s) => s.depth > 0.8);
    expect(near.length).toBeGreaterThan(0);
    expect(far.length).toBeGreaterThan(0);
    const mean = (list: typeof shapes) =>
      list.reduce((n, s) => n + s.lit, 0) / list.length;
    // Atmospheric perspective applies to light as well as to form.
    expect(mean(far)).toBeLessThan(mean(near));
  });
});

describe("tiers differ by fidelity, not only by count", () => {
  it("orders every fidelity control monotonically", () => {
    const { high, balanced, low } = ENVIRONMENT_BUDGET;
    expect(high.textureSize).toBeGreaterThan(balanced.textureSize);
    expect(balanced.textureSize).toBeGreaterThanOrEqual(low.textureSize);
    expect(high.nearRadius).toBeGreaterThan(balanced.nearRadius);
    expect(high.midRadius).toBeGreaterThan(balanced.midRadius);
    expect(high.skyline).toBeGreaterThan(balanced.skyline);
    expect(balanced.skyline).toBeGreaterThan(low.skyline);
  });

  it("spends ground effects at the top tier only", () => {
    // Phase 5B removed the planar reflection entirely: a second full render of
    // the scene, for a blurred grey mirror, while what reads as a wet street
    // is coloured light pooling on it. That is one instanced draw call now and
    // it is not tier-gated, because it costs almost nothing. What remains
    // gated is steam, which animates.
    expect(ENVIRONMENT_BUDGET.high.groundFx).toBe(true);
    expect(ENVIRONMENT_BUDGET.balanced.groundFx).toBe(false);
    expect(ENVIRONMENT_BUDGET.low.groundFx).toBe(false);
  });

  it("keeps generated texture memory inside a stated budget", () => {
    // Four facade albedos, four emissive maps, a grime map and a road, plus
    // mipmaps. The single largest GPU memory decision in the environment, and
    // therefore a number worth knowing rather than discovering on a laptop.
    const megabytes = (size: number) => {
      const per = (size * size * 4 * 1.33) / 1048576;
      const grime = Math.min(size, 512);
      return per * 4 * 2 + (grime * grime * 4 * 1.33) / 1048576 + per;
    };
    // Measured, not aspirational: about 13 MB at HIGH and 7.5 MB at BALANCED.
    // The ceilings exist to catch the case this test already caught once —
    // 1024px maps, which multiply out to 49 MB.
    expect(megabytes(ENVIRONMENT_BUDGET.high.textureSize)).toBeLessThan(16);
    expect(megabytes(ENVIRONMENT_BUDGET.balanced.textureSize)).toBeLessThan(9);
    expect(megabytes(ENVIRONMENT_BUDGET.low.textureSize)).toBeLessThan(4);
  });

  it("never lets a lower tier cost more than a higher one", () => {
    const stats = TIERS.map((t) => generateCity(t).stats);
    for (let i = 1; i < stats.length; i += 1) {
      expect(stats[i]!.parts).toBeLessThanOrEqual(stats[i - 1]!.parts);
      expect(stats[i]!.structures).toBeLessThanOrEqual(stats[i - 1]!.structures);
    }
  });
});
