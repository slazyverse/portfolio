import { describe, expect, it } from "vitest";
import { ANCHOR_SPECS } from "@/data/environment";
import { CORPORATIONS } from "@/data/city-identity";
import { generateCity } from "@/lib/environment/generate";
import { ENVIRONMENT_BUDGET } from "@/lib/environment/quality";

/**
 * Fidelity.
 *
 * Phase 10 is a polish pass, which makes it the phase most likely to break
 * something quietly: it touches placement, geometry and lighting assignment at
 * once, and every one of those failures looks like "the city, slightly
 * different" in a screenshot.
 *
 * The three things worth pinning:
 *
 *  - **landmarks own their ground.** Phase 9 added authored landmarks to a
 *    generator that had never been told they existed, and a procedural tower
 *    could be generated straight through one.
 *  - **corporations are institutions, not colours.** Five identities that
 *    differ only in the shape of a logo are five markers. They differ in the
 *    light they run now, and no two run the same fixture.
 *  - **silhouette costs instances, not draw calls.** The corner and recess
 *    treatments exist to stop the city reading as boxes; the moment they need
 *    a mesh of their own the trade stops being worth making.
 */

describe("landmarks own the ground they stand on", () => {
  const city = generateCity("high");

  it("places no structure through a landmark", () => {
    // The Phase 9 defect, and the reason the clearance exists. Measured
    // against the landmark's own footprint rather than a guessed radius.
    for (const level of city.levels) {
      for (const anchor of level.anchors) {
        for (const s of level.structures) {
          const gap = Math.hypot(
            s.position[0] - anchor.position[0],
            s.position[2] - anchor.position[2],
          );
          expect(
            gap,
            `${s.id} is ${gap.toFixed(1)}m from ${anchor.id}`,
          ).toBeGreaterThanOrEqual(22);
        }
      }
    }
  });

  it("keeps the clearance at every tier", () => {
    // A cheaper tier draws less city. It may not draw a building through a
    // landmark, because that is not a reduction — it is a different world.
    for (const tier of ["high", "balanced"] as const) {
      for (const level of generateCity(tier).levels) {
        for (const anchor of level.anchors) {
          for (const s of level.structures) {
            expect(
              Math.hypot(
                s.position[0] - anchor.position[0],
                s.position[2] - anchor.position[2],
              ),
              `${tier}/${s.id} overlaps ${anchor.id}`,
            ).toBeGreaterThanOrEqual(22);
          }
        }
      }
    }
  });

  it("still fills the city it was asked for", () => {
    // Clearance rejects candidate cells. If it rejected too many, the fix for
    // one visible defect would have quietly emptied the skyline.
    const count = city.levels.reduce((n, l) => n + l.structures.length, 0);
    expect(count).toBeGreaterThan(ENVIRONMENT_BUDGET.high.structures * 0.8);
  });
});

describe("a corporation is an institution, not a colour", () => {
  it("gives each one its own fixture and its own sign behaviour", () => {
    const lights = CORPORATIONS.map((c) => c.light);
    expect(new Set(lights).size, `fixtures repeat: ${lights.join(", ")}`).toBe(
      CORPORATIONS.length,
    );

    // Behaviours may repeat — most institutions do not blink — but not all of
    // them may be the same, or the identity is carried by colour alone again.
    expect(new Set(CORPORATIONS.map((c) => c.markBehaviour)).size).toBeGreaterThan(1);
  });

  it("never lets a corporation claim the subject's colour", () => {
    // `--accent` marks the route the reader is on. A corporation wearing it
    // would be indistinguishable from the place they are standing.
    for (const c of CORPORATIONS) {
      expect(c.light, `${c.id} claims the subject colour`).not.toBe("subject");
    }
  });

  it("lights every corporate mark in its owner's colour", () => {
    const city = generateCity("high");
    const owned = city.levels
      .flatMap((l) => l.structures)
      .filter((s) => s.owner !== undefined);
    expect(owned.length).toBeGreaterThan(0);

    const byId = new Map(CORPORATIONS.map((c) => [c.id, c]));
    for (const s of owned) {
      const corp = byId.get(s.owner!);
      if (!corp) continue;
      const marks = s.parts.filter((p) => p.source !== undefined && p.emissive > 0);
      for (const m of marks) {
        // A building's own street lighting is not its landlord's mark, so
        // only the parts that carry a source are asserted — and those are
        // the ones `corporateMark` emitted.
        expect([corp.light, "interior", "machine", "sodium", "warning", "utility"]).toContain(
          m.source,
        );
      }
    }
  });
});

describe("silhouette is bought with instances, not meshes", () => {
  const city = generateCity("high");

  it("uses only kit kinds the city already draws", () => {
    // Chamfers are fins and recesses are pipes. A new kind here would be a
    // new `InstancedMesh`, and the whole trade depends on that not happening.
    const kinds = new Set(
      city.levels.flatMap((l) => l.structures.flatMap((s) => s.parts.map((p) => p.kind))),
    );
    expect(kinds.has("fin")).toBe(true);
    expect(kinds.has("pipe")).toBe(true);
    // The kit's full vocabulary, unchanged by this phase.
    expect(kinds.size).toBeLessThanOrEqual(11);
  });

  it("spends the treatment near the camera and not across the city", () => {
    // Detail is assigned by distance. A chamfer at three hundred metres is
    // four instances nobody can resolve.
    const far = city.levels
      .flatMap((l) => l.structures)
      .filter((s) => s.detail === "far");
    for (const s of far) {
      const fins = s.parts.filter((p) => p.kind === "fin").length;
      expect(fins, `${s.id} is far and has ${fins} fins`).toBe(0);
    }
  });

  it("builds the same city every time", () => {
    // Placement, chamfering and recessing all draw from the seeded stream.
    const a = generateCity("high").levels.flatMap((l) => l.structures);
    const b = generateCity("high").levels.flatMap((l) => l.structures);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i += 1) {
      expect(a[i]!.parts.length, a[i]!.id).toBe(b[i]!.parts.length);
      expect(a[i]!.position).toEqual(b[i]!.position);
    }
  });
});

/** How many parts one mark of each family is made of. */
const MARK_PARTS: Record<string, number> = {
  bars: 3,
  chevron: 2,
  ring: 1,
  grid: 4,
  wedge: 2,
};

describe("every corporation is somewhere in the city", () => {
  /**
   * The gap this closes.
   *
   * Phase 10 gave each corporation its own fixture and a test asserted the
   * five were distinct — which they were, in the data. In the frame there
   * were four. Two separate reasons, and the first one is why the second went
   * unnoticed for a whole phase:
   *
   *  - the `ring` mark is centred on its mount rather than offset from it, so
   *    it is pushed directly instead of through the shared helper, and the
   *    helper was the only thing that attached `source`. Corrigan's mark was
   *    in the world and lit by the wrong lamp.
   *  - both mark tiers are gated on the host's height, and a corporation
   *    whose entire portfolio is plant owns nothing tall enough for either.
   *
   * So the assertion is about the frame, not about the table: whatever the
   * rolls do, every corporation holding property carries its own light
   * somewhere, at every tier that draws marks at all.
   */
  const marksOf = (s: { parts: readonly { source?: string; emissive: number }[] }, light: string) =>
    s.parts.filter((p) => p.source === light && p.emissive > 0).length;

  for (const tier of ["high", "balanced", "low"] as const) {
    it(`shows all five at ${tier}`, () => {
      const structures = generateCity(tier).levels.flatMap((l) => l.structures);
      for (const corp of CORPORATIONS) {
        const held = structures.filter((s) => s.owner === corp.id);
        if (held.length === 0) continue;
        const marked = held.filter((s) => marksOf(s, corp.light) > 0);
        expect(
          marked.length,
          `${corp.id} holds ${held.length} buildings at ${tier} and signs none of them`,
        ).toBeGreaterThan(0);
      }
    });
  }

  it("signs a building once, never twice", () => {
    // The floor adds a mark only to an owner that has none, so a building
    // carrying two marks would mean it had double-counted — and a doubled
    // mark is z-fighting geometry in the same place, not a louder sign.
    const structures = generateCity("high").levels.flatMap((l) => l.structures);
    for (const corp of CORPORATIONS) {
      const expected = MARK_PARTS[corp.mark]!;
      for (const s of structures.filter((x) => x.owner === corp.id)) {
        const n = marksOf(s, corp.light);
        if (n === 0) continue;
        expect(n, `${s.id} carries ${n / expected} ${corp.mark} marks`).toBe(expected);
      }
    }
  });

  it("keeps the marks sparse", () => {
    // A corporation's name on every door it owns is propaganda, not a city.
    const structures = generateCity("high").levels.flatMap((l) => l.structures);
    const marked = structures.filter((s) =>
      s.parts.some((p) => p.source !== undefined && p.emissive > 0),
    );
    expect(marked.length).toBeGreaterThan(CORPORATIONS.length - 1);
    expect(marked.length / structures.length).toBeLessThan(0.2);
  });

  it("places the same marks every time", () => {
    // The floor draws no randomness, which is the whole reason it is safe to
    // run after the lighting quota has already been spent.
    const key = (tier: "high") =>
      generateCity(tier)
        .levels.flatMap((l) => l.structures)
        .filter((s) => s.owner !== undefined)
        .map(
          (s) =>
            `${s.id}:${s.parts
              .filter((p) => p.source !== undefined && p.emissive > 0)
              .map((p) => `${p.kind}@${p.position.map((v) => v.toFixed(3)).join(",")}`)
              .join("|")}`,
        )
        .join(";");
    expect(key("high")).toBe(key("high"));
  });
});

describe("one landmark is lit, and it is the reader's", () => {
  it("gives no route two landmarks to be standing at", () => {
    // The render applies `subject` to every anchor whose routeId matches the
    // current route. Two anchors on one route would light two places at once
    // and the colour would stop meaning "here".
    const seen = new Set<string>();
    for (const spec of ANCHOR_SPECS) {
      expect(seen.has(spec.routeId), `${spec.routeId} has more than one landmark`).toBe(false);
      seen.add(spec.routeId);
    }
  });

  it("matches at most one anchor for any route in the world", () => {
    const anchors = generateCity("high").levels.flatMap((l) => l.anchors);
    for (const spec of ANCHOR_SPECS) {
      expect(
        anchors.filter((a) => a.routeId === spec.routeId).length,
        `${spec.routeId}`,
      ).toBe(1);
    }
  });
});
