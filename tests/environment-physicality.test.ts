import { describe, expect, it } from "vitest";
import { LEVEL_ORDER } from "@/data/routes";
import { generateCity } from "@/lib/environment/generate";
import {
  ROAD_ROUGHNESS,
  ROAD_ROUGHNESS_SCALAR,
  SPECULAR_FLOOR,
  effectiveRoughness,
  isPaved,
} from "@/lib/environment/materials";

/**
 * Physical truth, where it can be asserted.
 *
 * Phase 11 is about the difference between a scene and a place, and most of
 * that difference is in pixels no test can read. What a test *can* read is
 * the handful of numbers underneath those pixels that have each been wrong
 * once — and in every case the symptom was mistaken for a lighting problem
 * and the cause was one value in a material.
 *
 *  - a road smooth enough to mirror the key light. Measured twice: at an
 *    effective 0.34 in the material itself, and again at 0.35 in the Phase 11
 *    roughness map, where standing water took blown-out pixels over the road
 *    from 0.018 percent of the frame to 0.416.
 *  - a level that is not a street wearing a street's surface.
 *  - a landmark nobody can find, which is what the anchors were: assemblies
 *    ten metres high standing among buildings of two hundred and eighty.
 */

describe("the road is wet in places, not a mirror anywhere", () => {
  it("keeps every painted roughness clear of the blow-out", () => {
    // The assertion that would have caught the first draft of the Phase 11
    // map before a screenshot did. Standing water is the smoothest thing on
    // the surface and it still has to sit above the floor.
    for (const [name, grey] of Object.entries(ROAD_ROUGHNESS)) {
      const r = effectiveRoughness(grey);
      expect(r, `${name} is ${r.toFixed(3)}, at or under the specular floor`).toBeGreaterThan(
        SPECULAR_FLOOR,
      );
      expect(r, `${name} is not a roughness`).toBeLessThanOrEqual(1);
    }
  });

  it("still averages the value that fixed the blow-out", () => {
    // 0.52 is not a taste decision. It is the number a previous pass arrived
    // at after the key light's own reflection took a fifth of the frame, and
    // turning a constant into a map may not quietly move it.
    const base = effectiveRoughness(ROAD_ROUGHNESS.asphalt);
    expect(base).toBeGreaterThan(0.5);
    expect(base).toBeLessThan(0.56);
  });

  it("makes water smoother than asphalt and sealant rougher", () => {
    // The whole point of the map. If these ever order differently, the road
    // has stopped saying anything about where the water is.
    const water = effectiveRoughness(ROAD_ROUGHNESS.water);
    const track = effectiveRoughness(ROAD_ROUGHNESS.wheelTrack);
    const asphalt = effectiveRoughness(ROAD_ROUGHNESS.asphalt);
    const joint = effectiveRoughness(ROAD_ROUGHNESS.joint);
    expect(water).toBeLessThan(track);
    expect(track).toBeLessThan(asphalt);
    expect(joint).toBeGreaterThan(asphalt);
  });

  it("varies enough to be worth the texture", () => {
    // A map whose values all sit within a few percent of each other is a
    // constant that costs memory.
    const values = Object.values(ROAD_ROUGHNESS).map(effectiveRoughness);
    const spread = Math.max(...values) - Math.min(...values);
    expect(spread).toBeGreaterThan(0.1);
  });

  it("scales the map rather than replacing it", () => {
    expect(ROAD_ROUGHNESS_SCALAR).toBeGreaterThan(0);
    expect(ROAD_ROUGHNESS_SCALAR).toBeLessThanOrEqual(1);
  });
});

describe("a slab is not a street", () => {
  it("lays a road on exactly one level", () => {
    // The first pass painted highway markings across all four, so a server
    // hall two hundred metres underground had a dashed centre line running
    // through it.
    const paved = LEVEL_ORDER.filter(isPaved);
    expect(paved).toEqual(["surface"]);
  });
});

describe("a landmark can be found", () => {
  const anchors = generateCity("high").levels.flatMap((l) => l.anchors);

  /** How far above its own floor this landmark reaches. */
  const reach = (a: (typeof anchors)[number], floor: number): number =>
    Math.max(...a.parts.map((p) => p.position[1] + p.size[1] / 2)) - floor;

  const floors = new Map(generateCity("high").levels.map((l) => [l.level, l.floor]));

  it("gives every landmark something vertical to be seen against the sky by", () => {
    /*
     * The readability problem, stated as a number.
     *
     * Several of these were low assemblies — a drum, a long shed, four
     * tanks — and a low assembly at eighty metres among buildings of two
     * hundred and eighty is a smudge. Every one now carries a mast, a stack
     * or a crown, and twelve metres is the height at which one of them
     * clears the street furniture in front of it.
     */
    for (const a of anchors) {
      const floor = floors.get(a.level)!;
      expect(reach(a, floor), `${a.id} tops out at ${reach(a, floor).toFixed(1)}m`).toBeGreaterThan(
        12,
      );
    }
  });

  it("keeps the hero landmarks taller than the rest", () => {
    // Not every anchor should be huge. The three that organise the world —
    // the tower, the transit terminal, the hub the work is filed in — should
    // be the ones that carry height, and the others should be found by
    // silhouette and by light.
    const byKind = new Map(anchors.map((a) => [a.kind, reach(a, floors.get(a.level)!)]));
    const tower = byKind.get("communication-tower");
    expect(tower, "no communication tower in the world").toBeDefined();
    for (const [kind, height] of byKind) {
      if (kind === "communication-tower") continue;
      expect(height, `${kind} is taller than the tower`).toBeLessThan(tower!);
    }
  });

  it("never lets readability turn into a skyscraper", () => {
    // The other failure mode, and the one the brief names. A landmark that
    // competes with the towers around it stops being a landmark.
    for (const a of anchors) {
      expect(reach(a, floors.get(a.level)!), `${a.id} is a tower`).toBeLessThan(45);
    }
  });

  it("gives every landmark a lit element", () => {
    // Silhouette carries at distance and light carries at night. A landmark
    // with neither is data nobody can act on.
    for (const a of anchors) {
      expect(
        a.parts.some((p) => p.emissive > 0),
        `${a.id} is unlit`,
      ).toBe(true);
    }
  });

  it("builds the same landmarks every time", () => {
    const key = () =>
      generateCity("high")
        .levels.flatMap((l) => l.anchors)
        .map((a) => `${a.id}:${a.parts.length}:${a.position.join(",")}`)
        .join(";");
    expect(key()).toBe(key());
  });
});
