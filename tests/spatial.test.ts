import { describe, expect, it } from "vitest";
import { ANCHOR_SPECS } from "@/data/environment";
import { LEVEL_ORDER, ROUTES, route } from "@/data/routes";
import { cameraTargetForLevel, cameraTargetForRoute } from "@/lib/environment/camera";
import { cameraBearing, generateCity } from "@/lib/environment/generate";
import type { RouteId } from "@/data/types";

/**
 * The world as a set of places.
 *
 * Before Phase 9 the camera was a function of the *level*, so every route at
 * the same depth produced a byte-identical shot: opening `/dossier` and then
 * `/systems` changed the text and nothing else, and the city was demonstrably
 * a backdrop. The assertions here are about the claim that replaced it — that
 * a route is somewhere, that the somewhere is visible from where the camera
 * stands, and that going there never costs the reader their bearings.
 *
 * The risks:
 *
 *  - **drift back to a backdrop.** If two routes on one level ever return the
 *    same heading again, the spatial idea is gone and nothing else would say
 *    so.
 *  - **disorientation.** A camera free to face anything will eventually face
 *    a wall. The turn is bounded, and the bound is asserted rather than
 *    trusted.
 *  - **landmarks nobody can see.** The anchors were placed on absolute
 *    compass bearings for four phases and every one of them sat behind the
 *    camera, which went unnoticed because nothing drew them.
 */

/** Shortest signed angle between two bearings. */
function delta(a: number, b: number): number {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

/** The heading a camera target is looking along. */
function heading(t: ReturnType<typeof cameraTargetForLevel>): number {
  return Math.atan2(t.lookAt[2] - t.position[2], t.lookAt[0] - t.position[0]);
}

const ANCHORED = ANCHOR_SPECS.map((s) => s.routeId);

describe("a route is a place, not only a depth", () => {
  it("stands where the level stands, and only turns", () => {
    for (const spec of ANCHOR_SPECS) {
      const level = route(spec.routeId).level;
      const byRoute = cameraTargetForRoute(spec.routeId);
      const byLevel = cameraTargetForLevel(level);
      // Position, eye height and lens are the level's composition. Moving the
      // camera per route as well would make navigation something that happens
      // to the reader rather than for them.
      expect(byRoute.position, spec.routeId).toEqual(byLevel.position);
      expect(byRoute.fov, spec.routeId).toBe(byLevel.fov);
      expect(byRoute.lookAt[1], spec.routeId).toBe(byLevel.lookAt[1]);
    }
  });

  it("gives two routes on the same level two different views", () => {
    // The whole point. Interface carries both the terminal and the node
    // array; substrate carries four destinations. If these ever collapse back
    // to one heading, the city has gone back to being a backdrop.
    const byLevel = new Map<string, RouteId[]>();
    for (const spec of ANCHOR_SPECS) {
      const level = route(spec.routeId).level;
      byLevel.set(level, [...(byLevel.get(level) ?? []), spec.routeId]);
    }

    for (const [level, routeIds] of byLevel) {
      if (routeIds.length < 2) continue;
      const headings = routeIds.map((id) => heading(cameraTargetForRoute(id)));
      for (let i = 0; i < headings.length; i += 1) {
        for (let j = i + 1; j < headings.length; j += 1) {
          expect(
            Math.abs(delta(headings[i]!, headings[j]!)),
            `${level}: ${routeIds[i]} and ${routeIds[j]} look the same way`,
          ).toBeGreaterThan(0.02);
        }
      }
    }
  });

  it("never turns far enough to lose the level's composition", () => {
    // Thirty degrees, and the bound is the assertion: beyond about this the
    // camera starts facing a wall instead of the shaft.
    for (const spec of ANCHOR_SPECS) {
      const level = route(spec.routeId).level;
      const base = cameraBearing(LEVEL_ORDER.indexOf(level)) + Math.PI;
      const turned = heading(cameraTargetForRoute(spec.routeId));
      expect(
        Math.abs(delta(base, turned)),
        `${spec.routeId} turns too far`,
      ).toBeLessThanOrEqual(Math.PI / 6 + 1e-9);
    }
  });

  it("gives a route with no landmark the level's own shot", () => {
    // Not every page needs a place. Inventing one for each would make none of
    // them mean anything.
    const unanchored = ROUTES.filter(
      (r) => !ANCHORED.includes(r.id) && r.id !== "contract",
    );
    expect(unanchored.length).toBeGreaterThan(0);
    for (const r of unanchored) {
      expect(cameraTargetForRoute(r.id), r.id).toEqual(cameraTargetForLevel(r.level));
    }
  });

  it("stands a contract at its own depth, not at the route table's", () => {
    // Contracts share one route record and genuinely sit at different depths.
    // deadlockd is substrate work; the camera has to agree with the chrome.
    for (const level of LEVEL_ORDER) {
      const target = cameraTargetForRoute("contract", level);
      expect(target.position, level).toEqual(cameraTargetForLevel(level).position);
    }
    expect(cameraTargetForRoute("contract", "substrate")).not.toEqual(
      cameraTargetForRoute("contract", "engine"),
    );
  });

  it("is a pure function of the route and the level", () => {
    for (const spec of ANCHOR_SPECS) {
      expect(cameraTargetForRoute(spec.routeId)).toEqual(
        cameraTargetForRoute(spec.routeId),
      );
    }
  });
});

describe("landmarks are in the world and in shot", () => {
  const city = generateCity("high");
  const anchors = city.levels.flatMap((l) => l.anchors);

  it("places every anchor in front of the camera that has to see it", () => {
    // The failure this replaces: absolute compass bearings put every single
    // landmark behind the only viewpoint in the world, and nothing noticed
    // because nothing drew them.
    for (const anchor of anchors) {
      const level = anchor.level;
      const cam = cameraTargetForLevel(level);
      const look = cameraBearing(LEVEL_ORDER.indexOf(level)) + Math.PI;
      const toAnchor = Math.atan2(
        anchor.position[2] - cam.position[2],
        anchor.position[0] - cam.position[0],
      );
      expect(
        Math.abs(delta(look, toAnchor)),
        `${anchor.id} sits ${Math.round((delta(look, toAnchor) * 180) / Math.PI)}° off the view`,
      ).toBeLessThan(Math.PI / 2);
    }
  });

  it("gives every anchor a body made of kit the city already draws", () => {
    // Landmarks join meshes that exist, which is why the whole set costs no
    // draw call. A new part kind here would be a new mesh.
    const known = new Set(
      city.levels.flatMap((l) => l.structures.flatMap((s) => s.parts.map((p) => p.kind))),
    );
    expect(anchors.length).toBeGreaterThan(4);
    for (const anchor of anchors) {
      expect(anchor.parts.length, `${anchor.id} has no body`).toBeGreaterThan(2);
      for (const p of anchor.parts) {
        expect(known, `${anchor.id} uses an unrendered kind: ${p.kind}`).toContain(p.kind);
        for (const v of [...p.position, ...p.size]) expect(Number.isFinite(v)).toBe(true);
        for (const v of p.size) expect(v).toBeGreaterThan(0);
      }
    }
  });

  it("gives each kind of landmark its own silhouette", () => {
    // Recognisable by shape rather than by colour, because at two hundred
    // metres through fog a silhouette is all that survives.
    const shapes = new Map<string, string>();
    for (const anchor of anchors) {
      const shape = anchor.parts
        .map((p) => p.kind)
        .sort()
        .join(",");
      const seen = shapes.get(shape);
      if (seen && seen !== anchor.kind) {
        throw new Error(`${anchor.kind} and ${seen} have the same silhouette`);
      }
      shapes.set(shape, anchor.kind);
    }
    expect(shapes.size).toBeGreaterThan(4);
  });

  it("never bakes the subject's colour into a landmark", () => {
    // Emphasis is applied at render time from the current route, so it is
    // reversible by construction — there is no state to put back. A landmark
    // that was born `subject` would be lit for a page nobody is on.
    for (const anchor of anchors) {
      for (const p of anchor.parts) {
        expect(p.source, `${anchor.id} is permanently lit`).not.toBe("subject");
      }
    }
  });

  it("joins every landmark to a real route at its own level", () => {
    for (const anchor of anchors) {
      const meta = route(anchor.routeId);
      expect(meta.level, `${anchor.id} is at the wrong depth`).toBe(anchor.level);
      expect(meta.available, `${anchor.id} points at an unavailable route`).toBe(true);
    }
  });

  it("builds the same landmarks every time", () => {
    const a = generateCity("high").levels.flatMap((l) => l.anchors);
    const b = generateCity("high").levels.flatMap((l) => l.anchors);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i += 1) {
      expect(a[i]!.position).toEqual(b[i]!.position);
      expect(a[i]!.parts.length).toBe(b[i]!.parts.length);
    }
  });

  it("keeps landmarks at every tier, because a place is not a detail", () => {
    // Tiers reduce how much city is drawn. They may not remove the things the
    // routes correspond to, or the middle tier would be a different world.
    for (const tier of ["high", "balanced", "low"] as const) {
      const count = generateCity(tier).levels.flatMap((l) => l.anchors).length;
      expect(count, tier).toBe(ANCHOR_SPECS.length);
    }
  });
});
