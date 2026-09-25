import {
  DISTRICTS,
  SIGN_TIERS,
  type Corporation,
  type DistrictId,
  type SignTier,
} from "@/data/city-identity";
import type { StratumId } from "@/data/types";
import type { Rng } from "./seed";
import type { Part, PartKind, Signal, Structure } from "./types";

/* ---------------------------------------------------------------------------
 * The architectural grammar.
 *
 * A building is a podium, a shaft that steps back as it rises, a crown, and
 * the service equipment that keeps it running. The reason a generated city
 * reads as generated is almost never the layout — it is that every mass is a
 * single extruded rectangle with nothing on it.
 *
 * WHAT A BUILDING KNOWS ABOUT ITSELF
 *
 * Every building has a district and, where it matters, an owner. That is what
 * lets the world carry meaning without explaining itself:
 *
 *   corporate    clean surfaces, enormous signage, skybridges, no exposed
 *                services — somebody pays for this
 *   commercial   saturated frontage, storefront bands, clutter, patched fabric
 *   residential  balconies, cabling, service platforms, heavy wear
 *   industrial   plant, pipework, almost no signage, dirtiest fabric
 *   undercity    maintained when it fails and not before
 *
 * FIVE GRAMMARS, NOT ONE
 *
 * The district also picks a *grammar* — a small table of architectural rules
 * about how that class of building is put together. This is the difference
 * between variation and randomness, and it is the fix for the flattest thing
 * about the previous pass: every mass was an axis-aligned box, so the city
 * read as stamped no matter how good the facades were.
 *
 * What the grammars add is angle and accretion. A corporate megastructure is
 * clean, deeply set back and cantilevered; an undercity structure is one
 * original volume with three generations of retrofit bolted onto it at
 * whatever angle the bracket allowed. The same five rules produce both,
 * because the rules are parameterised and not random.
 *
 * PROCEDURAL IS NOT RANDOM. Every choice is bounded by an archetype, a
 * district and a grammar. The generator has latitude inside the rules; it does
 * not get a vote on the rules.
 *
 * Nothing here imports a rendering library. Parts are data, grouped by kind at
 * render time into one instanced mesh each — so a richer building costs
 * instances, which are cheap, and never draw calls, which are not.
 * ------------------------------------------------------------------------- */

export type Archetype = "tower" | "slab" | "stack" | "machine" | "rack";
export type DetailTier = "hero" | "near" | "mid" | "far";

export interface ComposeInput {
  rng: Rng;
  level: StratumId;
  archetype: Archetype;
  detail: DetailTier;
  district: DistrictId;
  /** Set only on buildings an owner has put its name to. */
  owner?: Corporation;
  /** Centre of the footprint, at ground level. */
  position: readonly [number, number, number];
  width: number;
  depth: number;
  height: number;
  rotation: number;
  signal: Signal;
  lit: boolean;
}

/**
 * Builds one kit piece.
 *
 * Exported because the generator authors set pieces of its own — the transit
 * spine, the enclosure, the foreground street — and they are the same kind of
 * data, drawn by the same instanced meshes. Two ways of constructing a part
 * would be two places to forget a field.
 */
export function part(
  kind: PartKind,
  position: readonly [number, number, number],
  size: readonly [number, number, number],
  rotation: number,
  extra: Partial<Part> = {},
): Part {
  return {
    kind,
    position,
    size,
    rotation,
    tilt: extra.tilt ?? 0,
    signal: extra.signal ?? "none",
    ...(extra.source ? { source: extra.source } : {}),
    variant: extra.variant ?? 0,
    wear: extra.wear ?? 0.5,
    emissive: extra.emissive ?? 0,
  };
}

/* ------------------------------------------------------------- grammars --- */

/**
 * How a class of building is put together.
 *
 * Five recognisable grammars, one per district, each a handful of numbers.
 * The point is that the same grammar repeats with controlled variation — a
 * district should read as a district, which means its buildings have to be
 * visibly related to each other and visibly unlike the ones one ring out.
 */
export interface Grammar {
  /** How sharply each tier steps back from the one below. */
  setback: readonly [number, number];
  /** Probability, per tier, of a bolted-on volume from a later retrofit. */
  retrofit: number;
  /** Probability, per tier, of a canted service module hung off a flank. */
  module: number;
  /** Probability, per tier, of diagonal structural bracing across a flank. */
  brace: number;
  /** Probability, per tier, of a platform cantilevered out over the street. */
  cantilever: number;
  /** What sits on top, which is what a skyline is actually read from. */
  crown: "taper" | "plant" | "lattice" | "cap" | "none";
  /** How far a tier may shift sideways from the one below. */
  drift: number;
}

export const GRAMMARS: Record<DistrictId, Grammar> = {
  /**
   * CORPORATE MEGASTRUCTURE. Large uninterrupted floor plates, deep setbacks,
   * a tapered crown, nothing bolted on. The expensive read is *continuity*:
   * one client, one architect, one construction date.
   */
  corporate: {
    setback: [0.74, 0.88],
    retrofit: 0.04,
    module: 0.06,
    brace: 0.22,
    cantilever: 0.4,
    crown: "taper",
    drift: 0,
  },
  /**
   * COMMERCIAL BLOCK. Shallow setbacks so the frontage stays continuous,
   * awnings and modules over the pavement, plant on the roof. Built once and
   * altered constantly.
   */
  commercial: {
    setback: [0.88, 0.97],
    retrofit: 0.45,
    module: 0.5,
    brace: 0.14,
    cantilever: 0.55,
    crown: "plant",
    drift: 0.06,
  },
  /**
   * RESIDENTIAL DENSITY BLOCK. Barely steps back at all — every square metre
   * is floor area — and everything that will not fit inside is hung outside.
   */
  residential: {
    setback: [0.92, 0.99],
    retrofit: 0.62,
    module: 0.68,
    brace: 0.1,
    cantilever: 0.3,
    crown: "plant",
    drift: 0.1,
  },
  /**
   * INDUSTRIAL / SERVICE BLOCK. Low, heavy, externally braced, with a lattice
   * of plant on top. Structure is the finish.
   */
  industrial: {
    setback: [0.9, 1],
    retrofit: 0.3,
    module: 0.62,
    brace: 0.6,
    cantilever: 0.22,
    crown: "lattice",
    drift: 0.04,
  },
  /**
   * PATCHED STRUCTURE. The original volume is somewhere underneath. What you
   * see is three generations of addition at whatever angle the bracket
   * allowed, which is the most expressive grammar of the five and the one
   * that carries the low-life half of the contrast.
   */
  undercity: {
    setback: [0.94, 1],
    retrofit: 0.85,
    module: 0.78,
    brace: 0.5,
    cantilever: 0.18,
    crown: "none",
    drift: 0.14,
  },
};

/* ------------------------------------------------------------- roof kit --- */

/**
 * What sits on top.
 *
 * The highest-value detail in a skyline, because a roofline is what you read
 * at distance. A flat top says "extruded rectangle" no matter how good the
 * facade beneath it is.
 */
function roofKit(
  rng: Rng,
  x: number,
  z: number,
  top: number,
  w: number,
  d: number,
  rotation: number,
  detail: DetailTier,
  district: DistrictId,
  /** Height of the building this roof belongs to. */
  hostHeight: number,
  out: Part[],
): void {
  const profile = DISTRICTS[district];
  const grammar = GRAMMARS[district];
  const units =
    detail === "far" ? 0 : rng.int(detail === "mid" ? 1 : 2, detail === "mid" ? 3 : 6);

  for (let i = 0; i < units; i += 1) {
    const uw = rng.range(w * 0.12, w * 0.3);
    const ud = rng.range(d * 0.12, d * 0.3);
    const uh = Math.min(rng.range(2.2, 6.5), Math.max(w, d) * 0.45);
    out.push(
      part(
        "roofUnit",
        [x + rng.range(-w * 0.32, w * 0.32), top + uh / 2, z + rng.range(-d * 0.32, d * 0.32)],
        [uw, uh, ud],
        rotation + rng.range(-0.05, 0.05),
        { wear: rng.range(profile.wear[0], profile.wear[1]) },
      ),
    );
  }

  if (detail !== "far" && rng.chance(0.42)) {
    const r = Math.min(rng.range(2.6, 5.4), Math.max(w, d) * 0.28);
    const h = Math.min(rng.range(5, 11), Math.max(w, d) * 0.6);
    out.push(
      part(
        "tank",
        [x + rng.range(-w * 0.25, w * 0.25), top + h / 2 + 2.2, z + rng.range(-d * 0.25, d * 0.25)],
        [r, h, r],
        rotation,
        { wear: rng.range(profile.wear[0], profile.wear[1]) },
      ),
    );
  }

  /*
   * A lattice crown: a frame of thin members over the roof rather than a
   * solid cap. Industrial buildings wear their structure on the outside, and
   * at silhouette range a lattice is the most legible roofline there is
   * because you can see the sky through it.
   */
  if (grammar.crown === "lattice" && detail !== "far" && rng.chance(0.7)) {
    const lh = Math.min(rng.range(4, 10), Math.max(w, d) * 0.7);
    for (const side of [-1, 1]) {
      out.push(
        part(
          "fin",
          [
            x + Math.cos(rotation) * (w / 2) * side * 0.82,
            top + lh / 2,
            z + Math.sin(rotation) * (w / 2) * side * 0.82,
          ],
          [0.5, lh, d * 0.9],
          rotation,
          { wear: rng.range(profile.wear[0], profile.wear[1]) },
        ),
      );
    }
    out.push(
      part("platform", [x, top + lh, z], [w * 0.9, 0.5, d * 0.9], rotation, {
        wear: rng.range(profile.wear[0], profile.wear[1]),
      }),
    );
  }

  /*
   * Antenna masts.
   *
   * Sized against the building's *height*, not its footprint. Sizing by
   * footprint looked safe and was not: a server rack is two metres wide and
   * eleven deep, so `max(w, d)` handed the substrate forty-metre masts on
   * five-metre cabinets, and the level rendered as a floor of boxes under a
   * forest of poles.
   *
   * The mast itself is structure, not light. It was emissive, which drew the
   * entire pole as a solid amber bar — an obstruction light is a lamp at the
   * top of a mast, so that is what it is now: one small emissive part, and
   * the mast is metal like everything else up there.
   */
  if (rng.chance(detail === "far" ? 0.18 : 0.46)) {
    const h = Math.min(Math.max(hostHeight * rng.range(0.12, 0.34), 2.5), 40);
    const mx = x + rng.range(-w * 0.2, w * 0.2);
    const mz = z + rng.range(-d * 0.2, d * 0.2);
    // Guyed masts lean. A perfectly vertical pole on every roof is another
    // way of saying "placed by a loop".
    const lean = rng.range(-0.09, 0.09);
    out.push(
      part("mast", [mx, top + h / 2, mz], [0.5, h, 0.5], rotation, {
        tilt: lean,
        wear: rng.range(profile.wear[0], profile.wear[1]),
      }),
    );
    if (rng.chance(0.55)) {
      out.push(
        part("sign", [mx, top + h, mz], [0.9, 0.9, 0.9], rotation, {
          signal: "amber",
          emissive: 1,
        }),
      );
    }
  }
}

/* ------------------------------------------------------- facade detail --- */

/** Vertical structural fins. Only where the camera can resolve them. */
function fins(
  rng: Rng,
  x: number,
  z: number,
  base: number,
  h: number,
  w: number,
  d: number,
  rotation: number,
  wear: number,
  out: Part[],
): void {
  const count = rng.int(4, 9);
  const spacing = w / (count + 1);
  for (let i = 1; i <= count; i += 1) {
    const offset = -w / 2 + spacing * i;
    for (const side of [1, -1]) {
      out.push(
        part(
          "fin",
          [
            x + Math.cos(rotation) * offset,
            base + h / 2,
            z + Math.sin(rotation) * offset + (side * d) / 2,
          ],
          [rng.range(0.7, 1.4), h * rng.range(0.86, 0.995), rng.range(0.8, 1.5)],
          rotation,
          { wear },
        ),
      );
    }
  }
}

/**
 * Horizontal relief: floor bands and setback shelves.
 *
 * A thin slab proud of the facade every few floors. Cheap — one instance —
 * and it does more for how a tower catches light than any amount of extra
 * window detail, because it puts a real horizontal edge where the light can
 * break.
 */
function reliefBands(
  rng: Rng,
  x: number,
  z: number,
  base: number,
  h: number,
  w: number,
  d: number,
  rotation: number,
  wear: number,
  out: Part[],
  /** Deep banding is one corporation's architectural signature. */
  deep = false,
): void {
  const bands = deep ? rng.int(3, 6) : rng.int(1, 4);
  for (let i = 1; i <= bands; i += 1) {
    const y = base + (h * i) / (bands + 1) + rng.range(-h * 0.05, h * 0.05);
    out.push(
      part(
        "platform",
        [x, y, z],
        [
          w * rng.range(1.02, deep ? 1.12 : 1.07),
          deep ? rng.range(1.4, 2.8) : rng.range(0.6, 1.6),
          d * rng.range(1.02, deep ? 1.12 : 1.07),
        ],
        rotation,
        { wear },
      ),
    );
  }
}

/**
 * Balconies and service platforms.
 *
 * Residential fabric, and one of the clearest class signals a facade has: a
 * corporate tower is sealed, a residential stack has things bolted to the
 * outside of it.
 */
function balconies(
  rng: Rng,
  x: number,
  z: number,
  base: number,
  h: number,
  w: number,
  d: number,
  rotation: number,
  wear: number,
  out: Part[],
): void {
  const rows = rng.int(3, 7);
  for (let r = 1; r <= rows; r += 1) {
    if (!rng.chance(0.75)) continue;
    const y = base + (h * r) / (rows + 1);
    const side = rng.chance(0.5) ? 1 : -1;
    const width = w * rng.range(0.3, 0.7);
    const offset = rng.range(-w * 0.25, w * 0.25);
    out.push(
      part(
        "platform",
        [
          x + Math.cos(rotation) * offset + Math.sin(rotation) * (side * (d / 2 + 0.9)),
          y,
          z + Math.sin(rotation) * offset - Math.cos(rotation) * (side * (d / 2 + 0.9)),
        ],
        [width, rng.range(0.4, 0.8), rng.range(1.4, 2.6)],
        rotation,
        { wear },
      ),
    );
  }
}

/** Service pipework running up a flank. */
function pipes(
  rng: Rng,
  x: number,
  z: number,
  base: number,
  h: number,
  w: number,
  d: number,
  rotation: number,
  wear: number,
  out: Part[],
): void {
  const count = rng.int(2, 5);
  for (let i = 0; i < count; i += 1) {
    const offset = rng.range(-w * 0.4, w * 0.4);
    out.push(
      part(
        "pipe",
        [
          x + Math.cos(rotation) * offset + Math.sin(rotation) * (d / 2),
          base + h * 0.48,
          z + Math.sin(rotation) * offset - Math.cos(rotation) * (d / 2),
        ],
        [rng.range(0.6, 1.5), h * rng.range(0.7, 0.96), rng.range(0.6, 1.5)],
        rotation,
        { wear },
      ),
    );
  }
}

/* ------------------------------------------------------- irregularity --- */

/**
 * A retrofit: a later volume bolted onto an existing one.
 *
 * The clearest way to say "this building has a history" in one instance. It
 * overlaps the host deliberately — a retrofit is attached to the structure,
 * not parked beside it — sits at its own angle, and carries its own facade
 * variant, because it was built by someone else in a different decade.
 */
function retrofits(
  rng: Rng,
  x: number,
  z: number,
  base: number,
  h: number,
  w: number,
  d: number,
  rotation: number,
  wear: number,
  variant: number,
  out: Part[],
): void {
  const side = rng.chance(0.5) ? 1 : -1;
  const rw = w * rng.range(0.3, 0.62);
  const rh = h * rng.range(0.25, 0.6);
  const rd = d * rng.range(0.35, 0.7);
  const along = rng.range(-w * 0.28, w * 0.28);
  // Half a footprint out, so it visibly grows out of the host rather than
  // floating beside it.
  const outward = (d / 2) * 0.72;

  out.push(
    part(
      "mass",
      [
        x + Math.cos(rotation) * along + Math.sin(rotation) * (side * outward),
        base + rng.range(h * 0.08, h * 0.45) + rh / 2,
        z + Math.sin(rotation) * along - Math.cos(rotation) * (side * outward),
      ],
      [rw, rh, rd],
      // A few degrees off the host, which is what reads as "added later".
      rotation + rng.range(-0.14, 0.14),
      { variant: (variant + rng.int(1, 3)) % 4, wear: Math.min(1, wear + 0.12) },
    ),
  );
}

/**
 * A service module: plant, a lift overrun, a tank house, canted off a flank.
 *
 * Tilted, always. A box at eight degrees next to a box at zero is the
 * cheapest legible statement that a facade is not a single plane, and it is
 * the detail that most reliably kills the "stamped" read at street distance.
 */
function serviceModules(
  rng: Rng,
  x: number,
  z: number,
  base: number,
  h: number,
  w: number,
  d: number,
  rotation: number,
  wear: number,
  out: Part[],
): void {
  const count = rng.int(1, 3);
  for (let i = 0; i < count; i += 1) {
    const side = rng.chance(0.5) ? 1 : -1;
    const along = rng.range(-w * 0.36, w * 0.36);
    const size: [number, number, number] = [
      rng.range(1.8, Math.max(2.2, w * 0.3)),
      rng.range(1.6, 4.2),
      rng.range(1.4, 3.2),
    ];
    out.push(
      part(
        "roofUnit",
        [
          x + Math.cos(rotation) * along + Math.sin(rotation) * (side * (d / 2 + size[2] * 0.4)),
          base + rng.range(h * 0.15, h * 0.88),
          z + Math.sin(rotation) * along - Math.cos(rotation) * (side * (d / 2 + size[2] * 0.4)),
        ],
        size,
        rotation + rng.range(-0.1, 0.1),
        { tilt: rng.range(0.06, 0.2) * (rng.chance(0.5) ? 1 : -1), wear },
      ),
    );
  }
}

/**
 * Diagonal bracing across a flank, and the angled supports under whatever is
 * hanging off it.
 *
 * Two members crossing at forty-odd degrees. In a city of vertical boxes a
 * diagonal is the loudest single line available, and one X on a facade is
 * worth more than a dozen more fins.
 */
function braces(
  rng: Rng,
  x: number,
  z: number,
  base: number,
  h: number,
  w: number,
  d: number,
  rotation: number,
  wear: number,
  out: Part[],
): void {
  const side = rng.chance(0.5) ? 1 : -1;
  const bays = rng.int(1, 3);
  const bayH = (h * rng.range(0.4, 0.85)) / bays;
  const span = Math.hypot(w * 0.7, bayH);
  const angle = Math.atan2(w * 0.7, bayH);

  for (let b = 0; b < bays; b += 1) {
    const y = base + bayH * (b + 0.5) + h * 0.08;
    for (const lean of [1, -1]) {
      out.push(
        part(
          "fin",
          [
            x + Math.sin(rotation) * (side * (d / 2 + 0.5)),
            y,
            z - Math.cos(rotation) * (side * (d / 2 + 0.5)),
          ],
          [0.55, span * 0.94, 0.55],
          rotation,
          { tilt: angle * lean, wear },
        ),
      );
    }
  }
}

/**
 * A platform cantilevered out over the street, with the strut that holds it.
 *
 * Overhead geometry is what makes a street feel like a canyon rather than a
 * corridor between two walls — it closes the top of the frame, and it is the
 * only thing at this scale that the camera looks *up* at.
 */
function cantilever(
  rng: Rng,
  x: number,
  z: number,
  base: number,
  h: number,
  w: number,
  d: number,
  rotation: number,
  wear: number,
  out: Part[],
): void {
  const side = rng.chance(0.5) ? 1 : -1;
  const reach = rng.range(3.5, 9);
  const y = base + rng.range(h * 0.2, h * 0.7);
  const along = rng.range(-w * 0.2, w * 0.2);
  const cx = x + Math.cos(rotation) * along + Math.sin(rotation) * (side * (d / 2 + reach / 2));
  const cz = z + Math.sin(rotation) * along - Math.cos(rotation) * (side * (d / 2 + reach / 2));

  out.push(
    part("platform", [cx, y, cz], [w * rng.range(0.3, 0.6), rng.range(0.6, 1.2), reach], rotation, {
      wear,
    }),
  );
  // The strut. A slab hanging in the air with nothing holding it is worse
  // than no slab at all.
  out.push(
    part(
      "fin",
      [
        x + Math.cos(rotation) * along + Math.sin(rotation) * (side * (d / 2 + reach * 0.25)),
        y - reach * 0.45,
        z + Math.sin(rotation) * along - Math.cos(rotation) * (side * (d / 2 + reach * 0.25)),
      ],
      [0.5, reach * 1.15, 0.5],
      rotation,
      { tilt: 0.62 * side, wear },
    ),
  );
}

/* -------------------------------------------------------- corporations --- */

/**
 * A corporate mark, drawn as geometry.
 *
 * The previous pass declared five corporations and then rendered each one as a
 * coloured rectangle, which is a colour scheme rather than an identity. These
 * are shapes: three stacked bars, a chevron, a ring, a lattice, a wedge —
 * assembled from the emissive parts the kit already instances, plus one torus.
 *
 * Geometry rather than a texture on purpose. A logo texture needs a per-
 * instance UV region, which needs a shader injection into three's UV chunks,
 * which breaks silently the next time those chunks are reorganised. A mark
 * made of four tilted boxes is five instances, no new material, no new memory,
 * and it reads at any distance because a silhouette survives what a 32-pixel
 * logo does not.
 *
 * No text, ever — which is both the accessibility rule and the reason none of
 * these can be mistaken for a real brand.
 */
export function corporateMark(
  corp: Corporation,
  cx: number,
  cy: number,
  cz: number,
  /** Overall width of the mark. Height follows from the family. */
  scale: number,
  rotation: number,
  emissive: number,
  out: Part[],
): void {
  const s = corp.signal;
  const depth = Math.max(0.4, scale * 0.06);
  const push = (
    dx: number,
    dy: number,
    size: readonly [number, number, number],
    tilt = 0,
    kind: PartKind = "sign",
  ) => {
    out.push(
      part(
        kind,
        [
          // Along the wall the mark is mounted on. A rotation about Y sends
          // local +X to (cos, -sin), so the lateral axis of a sign at this
          // yaw is (cos, -sin) and not (cos, +sin) — with the wrong sign the
          // mark's members drift off the face they belong to.
          cx + Math.cos(rotation) * dx,
          cy + dy,
          cz - Math.sin(rotation) * dx,
        ],
        size,
        rotation,
        { tilt, signal: s, emissive, wear: 0.2 },
      ),
    );
  };

  switch (corp.mark) {
    case "bars":
      // Three stacked bars of decreasing length. An allocation, drawn.
      for (let i = 0; i < 3; i += 1) {
        const width = scale * (1 - i * 0.26);
        push(-(scale - width) / 2, (i - 1) * scale * 0.26, [width, scale * 0.13, depth]);
      }
      break;
    case "chevron": {
      // Two members meeting at an apex: an interchange.
      const arm = scale * 0.62;
      for (const side of [-1, 1]) {
        push(side * scale * 0.24, 0, [arm, scale * 0.15, depth], side * 0.62);
      }
      break;
    }
    case "ring":
      // Power and cooling: a closed loop.
      out.push(
        part("ring", [cx, cy, cz], [scale, scale, depth], rotation, {
          signal: s,
          emissive,
          wear: 0.2,
        }),
      );
      break;
    case "grid": {
      // A lattice: the substrate group's mark is the thing it builds.
      const bar = scale * 0.09;
      for (const u of [-0.28, 0.28]) {
        push(u * scale, 0, [bar, scale * 0.82, depth]);
        push(0, u * scale * 0.82, [scale * 0.82, bar, depth]);
      }
      break;
    }
    case "wedge":
    default:
      // A single canted plane over a base: shelter, which is what a housing
      // trust sells.
      push(0, scale * 0.16, [scale * 0.86, scale * 0.16, depth], 0.42);
      push(0, -scale * 0.2, [scale * 0.5, scale * 0.13, depth]);
      break;
  }
}

/**
 * A corporation's architectural signature, applied to a building it owns.
 *
 * Signage says who owns a building. This says who *built* it, which is the
 * more convincing of the two, because it is in the structure rather than
 * stuck to it. Five owners, five moves, each one already in the kit.
 */
function ownerMotif(
  rng: Rng,
  corp: Corporation,
  x: number,
  z: number,
  base: number,
  h: number,
  w: number,
  d: number,
  rotation: number,
  wear: number,
  out: Part[],
): void {
  switch (corp.mark) {
    case "bars":
      // Allocation Holdings: deep horizontal banding, every few floors.
      reliefBands(rng, x, z, base, h, w, d, rotation, wear, out, true);
      break;
    case "chevron":
      // Meridian Interchange: canted bracing, as on its own viaducts.
      braces(rng, x, z, base, h, w, d, rotation, wear, out);
      break;
    case "ring":
      // Corrigan Power & Cooling: plant on the roof and a lit ring above it.
      out.push(
        part("tank", [x, base + h + 3.4, z], [w * 0.3, 6.4, w * 0.3], rotation, { wear }),
      );
      out.push(
        part("ring", [x, base + h + 8.2, z], [w * 0.5, w * 0.5, 0.6], rotation, {
          signal: "amber",
          emissive: 0.8,
          wear: 0.3,
        }),
      );
      break;
    case "grid": {
      /*
       * Vantage Substrate Group: an exoskeleton. Verticals on all four
       * flanks, tied horizontally — the mark at building scale.
       *
       * Over the lower half of the building only. The ties are sized to the
       * footprint at the base, and a tower steps back as it rises: carried
       * to full height they ended up as slabs hanging forty metres clear of
       * a facade that had long since narrowed away from them.
       */
      const reach = h * 0.5;
      const ties = rng.int(3, 5);
      for (const side of [1, -1]) {
        for (const axis of [0, 1]) {
          const ox = axis === 0 ? Math.sin(rotation) * (side * (d / 2 + 0.6)) : Math.cos(rotation) * (side * (w / 2 + 0.6));
          const oz = axis === 0 ? -Math.cos(rotation) * (side * (d / 2 + 0.6)) : Math.sin(rotation) * (side * (w / 2 + 0.6));
          out.push(
            part("fin", [x + ox, base + reach / 2, z + oz], [0.8, reach, 0.8], rotation, {
              wear,
            }),
          );
        }
      }
      for (let i = 1; i <= ties; i += 1) {
        out.push(
          part(
            "platform",
            [x, base + (reach * i) / (ties + 1), z],
            [w * 1.09, 0.7, d * 1.09],
            rotation,
            { wear },
          ),
        );
      }
      break;
    }
    case "wedge":
    default:
      // Keelson Residential Trust: balconies all the way up, and a canted
      // canopy over the entrance.
      balconies(rng, x, z, base, h, w, d, rotation, wear, out);
      out.push(
        part(
          "platform",
          [
            x + Math.sin(rotation) * (d / 2 + 2.2),
            base + 5.4,
            z - Math.cos(rotation) * (d / 2 + 2.2),
          ],
          [w * 0.7, 0.5, 4.4],
          rotation,
          { tilt: 0.2, wear },
        ),
      );
      break;
  }
}

/* -------------------------------------------------------------- signage --- */

/**
 * Signage, in a hierarchy.
 *
 * Four scales, each with a spatial reason: a skyline sign is readable across
 * the district and only something enormous can carry one; a micro label is a
 * hazard plate next to a door. Scattering neon at random is the difference
 * between a city that has been advertised at and a city that has had lights
 * put on it.
 *
 * Where a building has an owner, the sign carries that owner's mark as
 * geometry rather than being a lit rectangle in the owner's colour.
 */
function signage(
  rng: Rng,
  x: number,
  z: number,
  base: number,
  h: number,
  w: number,
  d: number,
  rotation: number,
  district: DistrictId,
  owner: Corporation | undefined,
  detail: DetailTier,
  out: Part[],
): void {
  if (detail === "far") return;
  const profile = DISTRICTS[district];
  const footprint = Math.max(w, d);
  if (footprint < 6) return;

  const place = (tier: SignTier, signal: "amber" | "cold", vertical: boolean) => {
    const spec = SIGN_TIERS[tier];
    if (footprint < spec.minHost && h < spec.minHost) return;
    const sh = h * rng.range(spec.heightShare[0], spec.heightShare[1]);
    const emissive = rng.range(spec.emissive[0], spec.emissive[1]);

    if (vertical) {
      // A blade sign on a corner: the classic dense-city silhouette. Kept low
      // on the building, because the shaft steps back as it rises and a sign
      // sized to the podium ends up hanging in mid-air forty storeys up.
      const sy = base + rng.range(h * 0.12, h * 0.42);
      out.push(
        part(
          "sign",
          [
            x + Math.cos(rotation) * (w / 2) + Math.sin(rotation) * (d / 2) * 0.9,
            sy + sh / 2,
            z + Math.sin(rotation) * (w / 2) - Math.cos(rotation) * (d / 2) * 0.9,
          ],
          [0.5, sh, rng.range(2.6, 6.5)],
          rotation,
          { signal, emissive, wear: rng.range(profile.wear[0], profile.wear[1]) },
        ),
      );
    } else {
      const sy = base + rng.range(h * 0.1, h * 0.38);
      out.push(
        part(
          "sign",
          [
            x + Math.sin(rotation) * (d / 2 + 0.4),
            sy,
            z - Math.cos(rotation) * (d / 2 + 0.4),
          ],
          [w * rng.range(0.4, 0.72), sh, 0.6],
          rotation,
          { signal, emissive, wear: rng.range(profile.wear[0], profile.wear[1]) },
        ),
      );
    }
  };

  // SKYLINE — a corporation's mark across the top of its own tower. The mark
  // itself, in geometry, mounted on a dark backing plate.
  if (owner && h >= SIGN_TIERS.skyline.minHost && rng.chance(owner.presence)) {
    // Eleven metres, not sixteen. An emissive panel is unlit by the scene
    // and unaffected by fog, so a mark sized generously reads as a flat
    // bright shape pasted over the skyline rather than as a sign on a wall.
    const markScale = Math.min(w * 0.32, 11);
    const y = base + h * rng.range(0.74, 0.88);
    corporateMark(
      owner,
      x + Math.sin(rotation) * (d / 2 + 0.9),
      y,
      z - Math.cos(rotation) * (d / 2 + 0.9),
      markScale,
      rotation,
      rng.range(SIGN_TIERS.skyline.emissive[0], SIGN_TIERS.skyline.emissive[1]),
      out,
    );
  }

  // DISTRICT — frontage bands. This is where consumerism is loudest.
  if (rng.chance(profile.signage)) {
    place("district", profile.signal, rng.chance(0.45));
  }
  if (district === "commercial" && rng.chance(0.55)) {
    place("district", rng.chance(0.5) ? "amber" : "cold", true);
  }
  // A smaller owner mark at district scale, on buildings too short to carry a
  // skyline one — which is how a corporation's presence reaches down the
  // hierarchy instead of only appearing on its headquarters.
  if (owner && h < SIGN_TIERS.skyline.minHost && h >= 30 && rng.chance(owner.presence * 0.6)) {
    corporateMark(
      owner,
      x + Math.sin(rotation) * (d / 2 + 0.7),
      base + h * rng.range(0.45, 0.7),
      z - Math.cos(rotation) * (d / 2 + 0.7),
      Math.min(w * 0.26, 5),
      rotation,
      rng.range(SIGN_TIERS.district.emissive[0], SIGN_TIERS.district.emissive[1]),
      out,
    );
  }

  // LOCAL — the storefront band. A continuous lit strip at street level is
  // the single strongest cue that a street has businesses on it.
  if (rng.chance(profile.storefront)) {
    const bh = rng.range(2.4, 4.2);
    out.push(
      part(
        "sign",
        [x + Math.sin(rotation) * (d / 2 + 0.5), base + bh / 2 + 1.2, z - Math.cos(rotation) * (d / 2 + 0.5)],
        [w * rng.range(0.85, 1.05), bh, 0.7],
        rotation,
        {
          signal: profile.signal,
          emissive: rng.range(0.45, 0.85),
          wear: rng.range(profile.wear[0], profile.wear[1]),
        },
      ),
    );
    // An awning over it. Canted, because an awning is, and because it puts
    // one more non-vertical edge at eye level where it will be seen.
    if (rng.chance(0.7)) {
      out.push(
        part(
          "platform",
          [
            x + Math.sin(rotation) * (d / 2 + 1.9),
            base + rng.range(4.4, 6.2),
            z - Math.cos(rotation) * (d / 2 + 1.9),
          ],
          [w * rng.range(0.55, 0.95), 0.35, rng.range(2.4, 4)],
          rotation,
          { tilt: rng.range(0.16, 0.3), wear: rng.range(profile.wear[0], profile.wear[1]) },
        ),
      );
    }
    // And a scatter of smaller shop signs above it.
    const shops = rng.int(1, 4);
    for (let i = 0; i < shops; i += 1) {
      const sh = rng.range(1.2, 2.6);
      out.push(
        part(
          "sign",
          [
            x + Math.cos(rotation) * rng.range(-w * 0.4, w * 0.4) + Math.sin(rotation) * (d / 2 + 0.8),
            base + rng.range(6, 18),
            z + Math.sin(rotation) * rng.range(-w * 0.4, w * 0.4) - Math.cos(rotation) * (d / 2 + 0.8),
          ],
          [rng.range(1.4, 4), sh, 0.5],
          rotation,
          {
            signal: rng.chance(0.62) ? "amber" : "cold",
            emissive: rng.range(0.4, 0.9),
            wear: rng.range(profile.wear[0], profile.wear[1]),
          },
        ),
      );
    }
  }

  // MICRO — maintenance plates. Dim, small, and the reason a wall looks used.
  if (detail === "near" || detail === "hero") {
    const plates = rng.int(1, 3);
    for (let i = 0; i < plates; i += 1) {
      out.push(
        part(
          "sign",
          [
            x + Math.cos(rotation) * rng.range(-w * 0.45, w * 0.45) + Math.sin(rotation) * (d / 2 + 0.3),
            base + rng.range(2, 7),
            z + Math.sin(rotation) * rng.range(-w * 0.45, w * 0.45) - Math.cos(rotation) * (d / 2 + 0.3),
          ],
          [rng.range(0.6, 1.4), rng.range(0.4, 0.9), 0.25],
          rotation,
          { signal: "cold", emissive: rng.range(0.2, 0.45), wear: 1 },
        ),
      );
    }
  }
}

/* ----------------------------------------------------- street furniture --- */

/**
 * What kind of activity a patch of pavement is used for.
 *
 * Clusters, not scatter. Scattering props evenly along a frontage produces
 * decoration; grouping them answers the question the brief actually asks of a
 * street — *who uses this place, and what do they do here* — because a
 * dumpster beside a roller door and a barrier around an open service panel
 * are each a small legible story, and three bollards a metre apart are not.
 */
type ClusterKind = "loading" | "utility" | "vendor" | "repair" | "parking";

const CLUSTERS_BY_DISTRICT: Record<DistrictId, readonly ClusterKind[]> = {
  corporate: ["utility", "parking"],
  commercial: ["vendor", "loading", "parking", "utility"],
  residential: ["utility", "repair", "vendor", "parking"],
  industrial: ["loading", "repair", "utility"],
  undercity: ["repair", "utility", "loading"],
};

/**
 * Human-scale clutter at the base of a building, in clusters.
 *
 * None of it is individually interesting, and collectively it is most of what
 * makes a street read as a place people use rather than as a ground plane with
 * towers on it. It is also the scale reference that makes the towers feel
 * enormous — a 200-metre building only reads as 200 metres if there is
 * something 1-metre next to it.
 */
function streetFurniture(
  rng: Rng,
  x: number,
  z: number,
  base: number,
  w: number,
  d: number,
  rotation: number,
  district: DistrictId,
  detail: DetailTier,
  out: Part[],
): void {
  if (detail === "far" || detail === "mid") return;
  const profile = DISTRICTS[district];
  const kinds = CLUSTERS_BY_DISTRICT[district];
  const clusters = Math.max(1, Math.round(rng.range(1, 3.4) * profile.clutter));

  const place = (
    along: number,
    outward: number,
    size: readonly [number, number, number],
    yaw: number,
    extra: Partial<Part> = {},
  ) => {
    out.push(
      part(
        "prop",
        [
          x + Math.cos(rotation) * along + Math.sin(rotation) * outward,
          base + size[1] / 2,
          z + Math.sin(rotation) * along - Math.cos(rotation) * outward,
        ],
        size,
        rotation + yaw,
        { wear: rng.range(profile.wear[0], profile.wear[1]), ...extra },
      ),
    );
  };

  for (let c = 0; c < clusters; c += 1) {
    const centre = rng.range(-w * 0.5, w * 0.5);
    const kerb = d / 2 + rng.range(2.2, 4.4);
    const kind = rng.pick(kinds);

    switch (kind) {
      case "loading": {
        // A roller door with its apron: a skip, a pallet stack, and the
        // barrier keeping the pavement clear of both.
        place(centre, kerb - 1.2, [rng.range(2.6, 4), rng.range(1.5, 2.1), rng.range(1.6, 2.4)], rng.range(-0.1, 0.1));
        place(centre + rng.range(2.5, 4.5), kerb - 0.6, [rng.range(1, 1.8), rng.range(0.7, 1.2), rng.range(1, 1.6)], rng.range(-0.4, 0.4));
        for (let i = 0; i < 3; i += 1) {
          place(centre - 3 + i * 1.6, kerb + 0.8, [1.5, 1.05, 0.22], rng.range(-0.08, 0.08));
        }
        break;
      }
      case "utility": {
        // Cabinets, a conduit riser, and the bollards that stop a vehicle
        // reversing into them.
        place(centre, kerb - 0.8, [rng.range(1.2, 2.2), rng.range(1.4, 2.4), rng.range(0.7, 1.2)], rng.range(-0.08, 0.08));
        place(centre + rng.range(1.6, 2.8), kerb - 0.8, [rng.range(0.6, 1.1), rng.range(1.1, 1.9), rng.range(0.6, 1)], rng.range(-0.2, 0.2));
        for (let i = 0; i < rng.int(2, 4); i += 1) {
          place(centre - 1.4 + i * 1.3, kerb + 0.6, [0.32, 1.05, 0.32], 0);
        }
        // A cable drop from the facade to the cabinet, canted.
        place(centre, d / 2 + 0.5, [0.22, rng.range(3, 6), 0.22], 0, { tilt: rng.range(0.1, 0.24) });
        break;
      }
      case "vendor": {
        // A kiosk with a lit head and a crate stack beside it. The one
        // cluster that is lit, because selling is.
        const kw = rng.range(1.8, 2.8);
        place(centre, kerb, [kw, rng.range(2, 2.6), rng.range(1.4, 2)], rng.range(-0.3, 0.3));
        out.push(
          part(
            "sign",
            [
              x + Math.cos(rotation) * centre + Math.sin(rotation) * kerb,
              base + rng.range(2.6, 3.2),
              z + Math.sin(rotation) * centre - Math.cos(rotation) * kerb,
            ],
            [kw * 0.9, 0.5, 0.3],
            rotation,
            { signal: profile.signal, emissive: rng.range(0.5, 0.85), wear: 0.6 },
          ),
        );
        place(centre + rng.range(2, 3.4), kerb - 0.4, [1.1, rng.range(0.8, 1.6), 1.1], rng.range(-0.5, 0.5));
        break;
      }
      case "repair": {
        // An open service pit: barriers round it, a cart, a warning lamp.
        for (let i = 0; i < 4; i += 1) {
          const a = (i / 4) * Math.PI * 2;
          place(centre + Math.cos(a) * 1.9, kerb + Math.sin(a) * 1.9, [1.4, 0.95, 0.2], a);
        }
        place(centre, kerb, [1, 1.1, 1.4], rng.range(-0.3, 0.3));
        out.push(
          part(
            "sign",
            [
              x + Math.cos(rotation) * centre + Math.sin(rotation) * kerb,
              base + 1.5,
              z + Math.sin(rotation) * centre - Math.cos(rotation) * kerb,
            ],
            [0.35, 0.35, 0.35],
            rotation,
            { signal: "amber", emissive: 0.9, wear: 0.8 },
          ),
        );
        break;
      }
      case "parking":
      default: {
        // Parked vehicles at the kerb. Low, long, slightly out of line —
        // parking is the most ordinary evidence of occupation there is.
        const cars = rng.int(1, 3);
        for (let i = 0; i < cars; i += 1) {
          place(
            centre + i * rng.range(5, 6.4),
            kerb + rng.range(1.4, 2.4),
            [rng.range(4.2, 5.2), rng.range(1.2, 1.6), rng.range(1.8, 2.2)],
            rng.range(-0.06, 0.06),
          );
        }
        break;
      }
    }
  }

  // Pedestrian-scale lighting: a post with a small lit head. Cheap, and it is
  // what puts pools of light on the pavement between the shopfronts.
  const lamps = rng.int(1, 3);
  for (let i = 0; i < lamps; i += 1) {
    const along = rng.range(-w * 0.5, w * 0.5);
    const outward = d / 2 + rng.range(3, 5.5);
    place(along, outward, [0.24, rng.range(4, 5.4), 0.24], 0);
    out.push(
      part(
        "sign",
        [
          x + Math.cos(rotation) * along + Math.sin(rotation) * outward,
          base + 5.2,
          z + Math.sin(rotation) * along - Math.cos(rotation) * outward,
        ],
        [0.8, 0.3, 0.8],
        rotation,
        { signal: "amber", emissive: 0.72, wear: 0.4 },
      ),
    );
  }

  // A vent stack breathing at street level. Steam is drawn by the renderer;
  // this is the thing it comes out of.
  if (rng.chance(profile.exposedServices * 0.6)) {
    place(
      rng.range(-w * 0.4, w * 0.4),
      d / 2 + 2.4,
      [rng.range(1.4, 2.6), 0.8, rng.range(1.4, 2.6)],
      0,
      { wear: 1, signal: "cold", emissive: 0 },
    );
  }
}

/* ------------------------------------------------------------- compose --- */

export function composeBuilding(input: ComposeInput): Structure {
  const { rng, level, archetype, detail, district, owner, position, rotation, signal, lit } = input;
  const [x, base, z] = position;
  const profile = DISTRICTS[district];
  const grammar = GRAMMARS[district];
  const parts: Part[] = [];

  let w = input.width;
  let d = input.depth;
  const totalHeight = input.height;
  const variant = rng.int(0, 3);
  const wear = rng.range(profile.wear[0], profile.wear[1]);
  const resolved = detail === "near" || detail === "hero";

  // --- podium -------------------------------------------------------------
  // Where the building meets the ground. Wider than the shaft, which is what
  // gives a street its continuous wall.
  const hasPodium = archetype !== "rack" && rng.chance(archetype === "tower" ? 0.85 : 0.55);
  let shaftBase = base;
  if (hasPodium) {
    const ph = Math.min(totalHeight * 0.2, rng.range(9, 24));
    parts.push(
      part(
        "mass",
        [x, base + ph / 2, z],
        [w * rng.range(1.12, 1.4), ph, d * rng.range(1.12, 1.4)],
        rotation,
        { variant, wear, signal: lit ? signal : "none" },
      ),
    );
    shaftBase = base + ph;
  }

  // --- shaft, stepping back ----------------------------------------------
  const tiers =
    archetype === "tower"
      ? rng.int(2, 4)
      : archetype === "stack"
        ? rng.int(3, 5)
        : archetype === "rack"
          ? 1
          : rng.int(1, 2);

  let y = shaftBase;
  let remaining = Math.max(totalHeight - (shaftBase - base), totalHeight * 0.5);

  for (let t = 0; t < tiers; t += 1) {
    const last = t === tiers - 1;
    const th = last ? remaining : remaining * rng.range(0.38, 0.66);
    if (th <= 0.4) break;

    /*
     * Lateral drift, by grammar rather than by archetype.
     *
     * A corporate tower's tiers are concentric — one client, one architect.
     * A residential stack's are not, because each one was added when it was
     * needed and had to miss whatever was already there. `drift` is that
     * difference expressed as a number, and it is most of why the two read as
     * different kinds of building rather than as the same building at two
     * sizes.
     */
    const drift = grammar.drift + (archetype === "stack" ? 0.12 : 0);
    const jitterX = drift > 0 ? rng.range(-w * drift, w * drift) : 0;
    const jitterZ = drift > 0 ? rng.range(-d * drift, d * drift) : 0;

    parts.push(
      part("mass", [x + jitterX, y + th / 2, z + jitterZ], [w, th, d], rotation, {
        variant: drift > 0.08 ? rng.int(0, 3) : variant,
        wear,
        signal: lit ? signal : "none",
      }),
    );

    if (resolved) {
      if (t === 0) fins(rng, x + jitterX, z + jitterZ, y, th, w, d, rotation, wear, parts);
      if (rng.chance(0.7)) {
        reliefBands(rng, x + jitterX, z + jitterZ, y, th, w, d, rotation, wear, parts);
      }
      if (rng.chance(profile.exposedServices)) {
        pipes(rng, x + jitterX, z + jitterZ, y, th, w, d, rotation, wear, parts);
      }
      if (district === "residential" || district === "undercity") {
        balconies(rng, x + jitterX, z + jitterZ, y, th, w, d, rotation, wear, parts);
      }
      // The grammar's own moves. Each one is a rule about this class of
      // building, not a dice roll about this building.
      if (rng.chance(grammar.retrofit)) {
        retrofits(rng, x + jitterX, z + jitterZ, y, th, w, d, rotation, wear, variant, parts);
      }
      if (rng.chance(grammar.module)) {
        serviceModules(rng, x + jitterX, z + jitterZ, y, th, w, d, rotation, wear, parts);
      }
      if (rng.chance(grammar.brace)) {
        braces(rng, x + jitterX, z + jitterZ, y, th, w, d, rotation, wear, parts);
      }
      if (t === 0 && rng.chance(grammar.cantilever)) {
        cantilever(rng, x + jitterX, z + jitterZ, y, th, w, d, rotation, wear, parts);
      }
    } else if (detail === "mid") {
      // Mid buildings get silhouette only — the two moves that change an
      // outline rather than a surface, because an outline is all that
      // survives at that distance.
      if (rng.chance(0.5)) {
        reliefBands(rng, x + jitterX, z + jitterZ, y, th, w, d, rotation, wear, parts);
      }
      if (rng.chance(grammar.retrofit * 0.5)) {
        retrofits(rng, x + jitterX, z + jitterZ, y, th, w, d, rotation, wear, variant, parts);
      }
    }

    y += th;
    remaining -= th;
    const setback =
      archetype === "tower"
        ? rng.range(grammar.setback[0], grammar.setback[1])
        : rng.range(Math.min(grammar.setback[0] + 0.06, 0.99), Math.min(grammar.setback[1] + 0.04, 1));
    w *= setback;
    d *= setback;
  }

  // --- crown --------------------------------------------------------------
  if (archetype === "tower" || (archetype === "stack" && rng.chance(0.6))) {
    const ch = rng.range(5, 15);
    // A tapered crown is narrower at the top than at the bottom, which no
    // single box can be — so it is two, the upper one inset. Two instances
    // for a silhouette that stops reading as a stack of blocks.
    parts.push(
      part("mass", [x, y + ch / 2, z], [w * 0.7, ch, d * 0.7], rotation, {
        variant,
        wear,
        signal: "none",
      }),
    );
    y += ch;
    if (grammar.crown === "taper") {
      const th = ch * rng.range(0.45, 0.8);
      parts.push(
        part("mass", [x, y + th / 2, z], [w * 0.42, th, d * 0.42], rotation, {
          variant,
          wear,
          signal: "none",
        }),
      );
      y += th;
    }
  }

  roofKit(rng, x, z, y, w, d, rotation, detail, district, totalHeight, parts);
  // Ownership is structural: a company's architectural signature is in the
  // building whether or not its windows happen to be lit tonight.
  if (owner && resolved) {
    ownerMotif(rng, owner, x, z, base, totalHeight, input.width, input.depth, rotation, wear, parts);
  }
  // The owner's mark goes up whether or not the windows are lit, for the
  // same reason its architecture does: a company signs a building it owns.
  // Gating this on occupancy meant the two corporations that own mostly
  // unlit industrial fabric never appeared in the city at all.
  signage(
    rng, x, z, base, totalHeight, input.width, input.depth, rotation,
    district, owner, detail, parts,
  );
  streetFurniture(rng, x, z, base, input.width, input.depth, rotation, district, detail, parts);

  return {
    id: `${level}-${Math.round(x)}-${Math.round(z)}`,
    level,
    kind: archetype,
    district,
    owner: owner?.id,
    position,
    size: [input.width, Math.max(y - base, totalHeight), input.depth] as const,
    rotation,
    signal: lit ? signal : "none",
    detail,
    variant,
    wear,
    parts,
  };
}
