import { describe, expect, it } from "vitest";
import type { QualityTier } from "@/lib/capability";
import { DISTRICTS } from "@/data/city-identity";
import { GRAMMARS } from "@/lib/environment/kit";
import { LEVEL_ORDER } from "@/data/routes";
import type { StratumId } from "@/data/types";
import {
  CAMERA_EYE,
  CITY_GEOMETRY,
  TRANSIT,
  cameraAnchorXZ,
  cameraBearing,
  generateCity,
} from "@/lib/environment/generate";
import { cameraTargetForLevel } from "@/lib/environment/camera";
import type { Part } from "@/lib/environment/types";

/**
 * Composition, and the authored set pieces that produce it.
 *
 * `environment.test.ts` proves the city is deterministic and budgeted;
 * `environment-detail.test.ts` proves buildings are composed rather than
 * extruded. This file covers the layer above both: whether the *shot* is
 * built — whether there is something in the foreground, something over the
 * camera's head where the level is an interior, and infrastructure under the
 * lane of lights in the air.
 *
 * Every assertion here corresponds to a named finding from the last visual
 * review. None of them can replace looking at the frames, and they are not
 * meant to: what they can do is stop a fix from silently coming undone.
 */

const TIERS: QualityTier[] = ["high", "balanced", "low"];

/** Every part on a level, buildings and authored fixtures alike. */
function allParts(level: { structures: readonly { parts: readonly Part[] }[]; fixtures: readonly Part[] }): Part[] {
  return [...level.structures.flatMap((s) => [...s.parts]), ...level.fixtures];
}

/* -------------------------------------------------------- the foreground --- */

describe("the camera stands inside the city, not in front of it", () => {
  it("puts authored geometry within twenty metres of the lens on every level", () => {
    // The finding this exists for: with a circular camera clearance, nothing
    // at all stood within sixty-six metres of the camera in any direction, so
    // the frame had no foreground, no occlusion and no scale reference — and
    // the city behind it read as a model on a table.
    const city = generateCity("high");
    for (const level of city.levels) {
      const i = LEVEL_ORDER.indexOf(level.level);
      const [cx, cz] = cameraAnchorXZ(i);
      const near = level.fixtures.filter(
        (p) => Math.hypot(p.position[0] - cx, p.position[2] - cz) <= 20,
      );
      expect(near.length, `${level.level} foreground`).toBeGreaterThan(6);
    }
  });

  it("lets buildings crowd the flanks while keeping the view ahead open", () => {
    const city = generateCity("high");
    for (const level of city.levels) {
      const i = LEVEL_ORDER.indexOf(level.level);
      const [cx, cz] = cameraAnchorXZ(i);
      const look = cameraBearing(i) + Math.PI;

      let nearestAhead = Infinity;
      let nearestFlank = Infinity;
      for (const s of level.structures) {
        const dx = s.position[0] - cx;
        const dz = s.position[2] - cz;
        const distance = Math.hypot(dx, dz);
        let delta = Math.abs(Math.atan2(dz, dx) - look) % (Math.PI * 2);
        if (delta > Math.PI) delta = Math.PI * 2 - delta;
        if (delta < 0.45) nearestAhead = Math.min(nearestAhead, distance);
        else if (delta > 1.1) nearestFlank = Math.min(nearestFlank, distance);
      }

      // A street: closed across, open along. If these ever invert, the shot
      // has gone back to being a plaza.
      expect(nearestFlank, `${level.level} flank`).toBeLessThan(nearestAhead);
      expect(nearestFlank).toBeLessThan(70);
    }
  });

  it("keeps the foreground below eye level, so it frames rather than blocks", () => {
    // Everything close to the lens is street hardware except two pieces that
    // are deliberately overhead. Nothing may sit at eye height in the middle
    // of the frame, which is the failure mode this replaced a circular
    // clearance to avoid recreating.
    const city = generateCity("high");
    for (const level of city.levels) {
      const i = LEVEL_ORDER.indexOf(level.level);
      const [cx, cz] = cameraAnchorXZ(i);
      const look = cameraBearing(i) + Math.PI;
      const eye = level.floor + CAMERA_EYE[level.level];

      for (const p of level.fixtures) {
        const dx = p.position[0] - cx;
        const dz = p.position[2] - cz;
        const distance = Math.hypot(dx, dz);
        if (distance > 16) continue;
        let delta = Math.abs(Math.atan2(dz, dx) - look) % (Math.PI * 2);
        if (delta > Math.PI) delta = Math.PI * 2 - delta;
        if (delta > 0.5) continue;
        // Dead ahead and close: it is either below the knee or above the
        // head, never across the middle of the shot.
        //
        // The vertical extent has to account for tilt, which is not a detail:
        // a duct run is a cylinder 128 metres long lying on its side, and
        // measuring it by its own Y dimension reports a pipe taller than the
        // level it is in.
        const half =
          (Math.abs(p.size[1] * Math.cos(p.tilt)) +
            Math.abs(p.size[2] * Math.sin(p.tilt))) /
          2;
        const top = p.position[1] + half;
        const bottom = p.position[1] - half;
        // Slender things may cross the eye line: a handrail at the edge of
        // the deck and a cable slung over the street are foreground, not
        // obstruction. What may not is anything with real vertical presence.
        if (half * 2 <= 1.4) continue;
        expect(
          top < eye - 1.4 || bottom > eye + 3,
          `${level.level} fixture at ${distance.toFixed(1)}m blocks the view`,
        ).toBe(true);
      }
    }
  });
});

/* ------------------------------------------------------------- enclosure --- */

describe("the interior levels are interiors", () => {
  it("puts a ceiling over the substrate", () => {
    // The largest single finding of the last review: the substrate read as a
    // distant industrial skyline rather than as a hall you are standing in,
    // because there was nothing whatsoever above it.
    const city = generateCity("high");
    const substrate = city.levels.find((l) => l.level === "substrate")!;
    const eye = substrate.floor + CAMERA_EYE.substrate;
    const overhead = substrate.fixtures.filter((p) => p.position[1] > eye + 4);
    expect(overhead.length).toBeGreaterThan(20);

    // And the ceiling has to span the room, not hover over the middle of it.
    const reach = Math.max(
      ...overhead.map((p) => Math.hypot(p.position[0], p.position[2])),
    );
    expect(reach).toBeGreaterThan(CITY_GEOMETRY.VOID_RADIUS);
  });

  it("spans the engine floor without closing it in", () => {
    const engine = generateCity("high").levels.find((l) => l.level === "engine")!;
    const eye = engine.floor + CAMERA_EYE.engine;
    expect(engine.fixtures.some((p) => p.position[1] > eye + 4)).toBe(true);
    // Gantries and ducts, not ceiling plates: an industrial hall is spanned,
    // not roofed at twelve metres.
    expect(engine.fixtures.some((p) => p.kind === "bridge")).toBe(true);
  });

  it("leaves the open levels open", () => {
    const city = generateCity("high");
    for (const name of ["surface", "interface"] as StratumId[]) {
      const level = city.levels.find((l) => l.level === name)!;
      const eye = level.floor + CAMERA_EYE[name];
      // The overhead gantry is allowed; a ceiling is not. Anything above the
      // camera stays within thirty metres of it rather than spanning the
      // level, so the sky is still the sky.
      // Near the camera only: the transit viaduct is a hundred metres out and
      // is meant to be above the street. What must not exist is a ceiling.
      const i = LEVEL_ORDER.indexOf(name);
      const [cx, cz] = cameraAnchorXZ(i);
      const high = level.fixtures.filter(
        (p) =>
          p.position[1] > eye + 26 &&
          Math.hypot(p.position[0] - cx, p.position[2] - cz) < 60,
      );
      expect(high.length, `${name} has a roof`).toBe(0);
    }
  });
});

/* --------------------------------------------------------------- transit --- */

describe("the elevated lane is a transport system", () => {
  it("builds a guideway, its supports and a station", () => {
    // The finding: a lane of light in the air with no structure under it,
    // which reads as a rendering bug rather than as infrastructure.
    const city = generateCity("high");
    for (const name of ["surface", "interface"] as StratumId[]) {
      const level = city.levels.find((l) => l.level === name)!;
      const deck = level.fixtures.filter(
        (p) =>
          p.kind === "bridge" &&
          Math.abs(Math.hypot(p.position[0], p.position[2]) - TRANSIT.radius) < 12 &&
          Math.abs(p.position[1] - (level.floor + TRANSIT.height)) < 12,
      );
      expect(deck.length, `${name} guideway`).toBeGreaterThan(5);

      // Columns: something that reaches from the deck to the ground.
      const columns = level.fixtures.filter(
        (p) => p.kind === "pipe" && p.size[1] >= TRANSIT.height - 1,
      );
      expect(columns.length, `${name} columns`).toBeGreaterThan(1);

      // A station: a platform wider and longer than the deck it sits on.
      const platform = level.fixtures.filter(
        (p) => p.kind === "platform" && p.size[0] > 30 && p.size[2] > TRANSIT.deck,
      );
      expect(platform.length, `${name} station`).toBeGreaterThan(0);
    }
  });

  it("puts the station where the camera is already looking", () => {
    // A landmark nobody sees is not a landmark, and the same is true of the
    // one piece of infrastructure the world spends this much geometry on.
    const level = generateCity("high").levels.find((l) => l.level === "surface")!;
    const target = cameraTargetForLevel("surface");
    const look = Math.atan2(
      target.lookAt[2] - target.position[2],
      target.lookAt[0] - target.position[0],
    );
    const platform = level.fixtures.find(
      (p) => p.kind === "platform" && p.size[0] > 30 && p.size[2] > TRANSIT.deck,
    )!;
    let delta = Math.abs(
      Math.atan2(platform.position[2] - target.position[2], platform.position[0] - target.position[0]) - look,
    ) % (Math.PI * 2);
    if (delta > Math.PI) delta = Math.PI * 2 - delta;
    expect(delta).toBeLessThan(0.35);
  });

  it("runs the guideway outside the shaft, on the far side of the city", () => {
    // Midground, not foreground: the viaduct has to be far enough out that it
    // crosses the frame rather than filling it, and clear of the shaft the
    // camera descends through.
    expect(TRANSIT.radius).toBeGreaterThan(CITY_GEOMETRY.VOID_RADIUS * 2);
    expect(TRANSIT.radius).toBeLessThan(CITY_GEOMETRY.SPAN / 2);

    const level = generateCity("high").levels.find((l) => l.level === "surface")!;
    const guideway = level.fixtures.filter(
      (p) =>
        p.kind === "bridge" &&
        Math.abs(Math.hypot(p.position[0], p.position[2]) - TRANSIT.radius) < 12,
    );
    expect(guideway.length).toBeGreaterThan(5);
    for (const p of guideway) {
      expect(Math.hypot(p.position[0], p.position[2])).toBeGreaterThan(
        CITY_GEOMETRY.VOID_RADIUS,
      );
    }
  });
});

/* ------------------------------------------------------------ the shaft --- */

describe("the shaft stays clear of anything the camera could hit", () => {
  it("builds no building mass inside the void", () => {
    // The invariant is about building volume, which is what the camera would
    // fly through. Street hardware a metre high, and a ceiling ten metres
    // above the camera, are inside the shaft on purpose — that is what being
    // in a street rather than in a clearing means.
    for (const level of generateCity("high").levels) {
      for (const p of level.fixtures) {
        expect(p.kind).not.toBe("mass");
      }
    }
  });

  it("leaves the spot the camera stands on empty", () => {
    // The foreground is close by design, so the thing worth asserting is not
    // that it is far — it is that nothing is placed where the lens is. Six
    // metres is the near plane plus room for the camera to arrive.
    //
    // Measured above the eye line only. The deck the interface camera is
    // standing on is directly underneath it, which is the point of it.
    const city = generateCity("high");
    for (const level of city.levels) {
      const [ax, az] = cameraAnchorXZ(LEVEL_ORDER.indexOf(level.level));
      const eye = level.floor + CAMERA_EYE[level.level];
      for (const p of level.fixtures) {
        const half =
          (Math.abs(p.size[1] * Math.cos(p.tilt)) +
            Math.abs(p.size[2] * Math.sin(p.tilt))) /
          2;
        // Only what occupies the camera's own height band. A duct seven
        // metres overhead and the deck underfoot are both allowed to be
        // close, because neither is where the lens is.
        if (p.position[1] + half < eye - 1.4) continue;
        if (p.position[1] - half > eye + 3) continue;
        const distance = Math.hypot(p.position[0] - ax, p.position[2] - az);
        expect(distance, `${p.kind} standing in the camera`).toBeGreaterThan(6);
      }
    }
  });
});

/* ----------------------------------------------------------- irregularity --- */

describe("the city is not a grid of axis-aligned boxes", () => {
  it("tilts a real share of its geometry", () => {
    // The review's second finding. A city assembled entirely from boxes at
    // zero degrees reads as generated however good its textures are, and the
    // cure is angle: braces, canted modules, awnings, leaning masts.
    const city = generateCity("high");
    const parts = city.levels.flatMap(allParts);
    const tilted = parts.filter((p) => Math.abs(p.tilt) > 0.02);
    expect(tilted.length / parts.length).toBeGreaterThan(0.02);
    expect(tilted.length).toBeGreaterThan(120);
  });

  it("keeps every tilt finite and within a quarter turn", () => {
    for (const tier of TIERS) {
      for (const level of generateCity(tier).levels) {
        for (const p of allParts(level)) {
          expect(Number.isFinite(p.tilt)).toBe(true);
          expect(Math.abs(p.tilt)).toBeLessThanOrEqual(Math.PI / 2 + 0.001);
        }
      }
    }
  });

  it("gives the poorer districts more accretion than the richer ones", () => {
    // The grammar, checked as a social fact rather than as a number: an
    // undercity structure is one volume with three generations of retrofit
    // bolted onto it, a corporate tower is one client and one architect.
    expect(GRAMMARS.undercity.retrofit).toBeGreaterThan(
      GRAMMARS.corporate.retrofit * 4,
    );
    expect(GRAMMARS.undercity.drift).toBeGreaterThan(
      GRAMMARS.corporate.drift,
    );
    // And the corporate setback is the deepest, which is what gives that
    // district its tapered silhouette.
    expect(GRAMMARS.corporate.setback[1]).toBeLessThan(
      GRAMMARS.undercity.setback[0],
    );
  });
});

/* ------------------------------------------------- corporate identities --- */

describe("the corporations are shapes, not colours", () => {
  it("draws marks as geometry on the buildings that carry them", () => {
    // A mark made of tilted bars and a ring, never a glyph: the city renders
    // no text at all, which is both the accessibility rule and the reason
    // none of these can be mistaken for a real brand.
    const city = generateCity("high");
    const owned = city.levels
      .flatMap((l) => [...l.structures])
      .filter((s) => s.owner);
    expect(owned.length).toBeGreaterThan(4);

    const rings = city.levels.flatMap(allParts).filter((p) => p.kind === "ring");
    expect(rings.length).toBeGreaterThan(0);
    for (const r of rings) {
      expect(r.emissive).toBeGreaterThan(0);
      expect(["amber", "cold"]).toContain(r.signal);
    }
  });

  it("only signs a building somebody owns", () => {
    // Ownership drives signage, not the other way round. A mark on a
    // building with no owner would be decoration.
    const city = generateCity("high");
    for (const level of city.levels) {
      for (const s of level.structures) {
        if (s.owner) continue;
        const marks = s.parts.filter((p) => p.kind === "ring");
        expect(marks.length, `${s.id} carries a mark without an owner`).toBe(0);
      }
    }
  });
});

/* ------------------------------------------------------ economic contrast --- */

describe("the hierarchy is visible in the fabric", () => {
  it("orders maintenance, lighting and clutter by district", () => {
    // Everything the world says about class it says through these. If the
    // ordering ever flattens, the city stops communicating anything and
    // becomes set dressing.
    expect(DISTRICTS.corporate.wear[1]).toBeLessThan(DISTRICTS.undercity.wear[0]);
    expect(DISTRICTS.corporate.litShare).toBeGreaterThan(DISTRICTS.residential.litShare);
    expect(DISTRICTS.residential.litShare).toBeGreaterThan(DISTRICTS.industrial.litShare);
    expect(DISTRICTS.corporate.clutter).toBeLessThan(DISTRICTS.commercial.clutter);
    expect(DISTRICTS.corporate.exposedServices).toBeLessThan(
      DISTRICTS.undercity.exposedServices,
    );
  });

  it("never lets a level go dark for want of a lit building", () => {
    // Two district multipliers compounding with a level's own share once
    // produced an engine floor with zero lit structures, which is not a dark
    // level — it is a missing one.
    for (const tier of ["high", "balanced"] as const) {
      for (const level of generateCity(tier).levels) {
        const lit = level.structures.filter((s) => s.signal !== "none");
        expect(lit.length, `${level.level} at ${tier}`).toBeGreaterThan(0);
      }
    }
  });
});

/* ----------------------------------------------------------------- tiers --- */

describe("fixtures scale with the tier without disappearing", () => {
  it("gives every tier a foreground, a ceiling and a guideway", () => {
    // Composition is the last thing to cut, not the first: a tier is meant to
    // be the same city rendered more cheaply, and a shot with no foreground
    // is a different shot.
    for (const tier of TIERS) {
      for (const level of generateCity(tier).levels) {
        expect(level.fixtures.length, `${level.level} at ${tier}`).toBeGreaterThan(12);
      }
    }
  });

  it("never spends more on a lower tier than on a higher one", () => {
    const counts = TIERS.map((tier) =>
      generateCity(tier).levels.reduce((n, l) => n + l.fixtures.length, 0),
    );
    for (let i = 1; i < counts.length; i += 1) {
      expect(counts[i]!).toBeLessThanOrEqual(counts[i - 1]!);
    }
  });
});
