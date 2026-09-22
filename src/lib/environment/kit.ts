import type { StratumId } from "@/data/types";
import type { Rng } from "./seed";
import type { Part, PartKind, Signal, Structure } from "./types";

/* ---------------------------------------------------------------------------
 * The architectural grammar.
 *
 * A building is not a box. It is a podium, a shaft that steps back as it
 * rises, a crown, and the service equipment that keeps it running — and the
 * reason a generated city reads as generated is almost never the layout. It is
 * that every mass is a single extruded rectangle with nothing on top of it.
 *
 * So this file composes each building from a small kit of parts, under rules
 * rather than dice:
 *
 *   PODIUM    wider base, two or three floors, where the street meets it
 *   SHAFT     one to three stacked masses, each stepping back from the last
 *   CROWN     a smaller machine room or cap, never just a flat cut
 *   ROOF KIT  plant units, water tanks, an antenna mast
 *   FINS      vertical structure on the facade, which is what makes a tower
 *             read as built rather than as extruded
 *   SIGNS     emissive panels, placed on frontage rather than at random
 *
 * PROCEDURAL IS NOT RANDOM. Every choice below is bounded by an archetype and
 * by the district the building stands in. The generator has latitude inside
 * the rules; it does not have a vote on the rules.
 *
 * Nothing here imports a rendering library. Parts are data, grouped by kind at
 * render time into one instanced mesh each — so a richer building costs
 * instances, which are cheap, and never draw calls, which are not.
 * ------------------------------------------------------------------------- */

/** What kind of building this is, which decides how it is composed. */
export type Archetype =
  /** Slender, stepped, crowned. The skyline shape. */
  | "tower"
  /** Wide and shallow, horizontal banding. Blocks and plates. */
  | "slab"
  /** Stacked irregular masses. Accretion rather than design. */
  | "stack"
  /** Industrial plant: squat, heavy, equipment-dominant. */
  | "machine"
  /** Server cabinet row. Substrate only. */
  | "rack";

/** How much of the kit a building receives, by how close it is to the camera. */
export type DetailTier = "hero" | "near" | "mid" | "far";

export interface ComposeInput {
  rng: Rng;
  level: StratumId;
  archetype: Archetype;
  detail: DetailTier;
  /** Centre of the footprint, at ground level. */
  position: readonly [number, number, number];
  /** Overall footprint and target height. */
  width: number;
  depth: number;
  height: number;
  rotation: number;
  /** The district's signal family. */
  signal: Signal;
  /** Whether this building carries lit windows at all. */
  lit: boolean;
}

function part(
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
    signal: extra.signal ?? "none",
    variant: extra.variant ?? 0,
    wear: extra.wear ?? 0.5,
    emissive: extra.emissive ?? 0,
  };
}

/* ------------------------------------------------------------- roof kit --- */

/**
 * What sits on top.
 *
 * The single highest-value detail in a city skyline, because a roofline is
 * what you actually read at distance. A flat top says "extruded rectangle" no
 * matter how good the facade underneath it is.
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
  out: Part[],
): void {
  const units = detail === "far" ? 0 : rng.int(detail === "mid" ? 1 : 2, detail === "mid" ? 3 : 6);

  for (let i = 0; i < units; i += 1) {
    const uw = rng.range(w * 0.12, w * 0.3);
    const ud = rng.range(d * 0.12, d * 0.3);
    const uh = Math.min(rng.range(2.2, 6.5), Math.max(w, d) * 0.45);
    out.push(
      part(
        "roofUnit",
        [
          x + rng.range(-w * 0.32, w * 0.32),
          top + uh / 2,
          z + rng.range(-d * 0.32, d * 0.32),
        ],
        [uw, uh, ud],
        rotation + rng.range(-0.05, 0.05),
        { wear: rng.range(0.4, 1) },
      ),
    );
  }

  // Water tanks: cylindrical, raised on a frame. A recognisable rooftop
  // silhouette that costs one instance.
  if (detail !== "far" && rng.chance(0.42)) {
    const r = Math.min(rng.range(2.6, 5.4), Math.max(w, d) * 0.28);
    const h = Math.min(rng.range(5, 11), Math.max(w, d) * 0.6);
    out.push(
      part(
        "tank",
        [x + rng.range(-w * 0.25, w * 0.25), top + h / 2 + 2.2, z + rng.range(-d * 0.25, d * 0.25)],
        [r, h, r],
        rotation,
        { wear: rng.range(0.5, 1) },
      ),
    );
  }

  // Antenna masts. Tall, thin, and the thing that gives a skyline its ragged
  // upper edge — visible from much further away than the equipment below.
  if (rng.chance(detail === "far" ? 0.18 : 0.46)) {
    // Proportional to what it stands on, not an absolute range. A forty-metre
    // mast is right on a tower and absurd on a two-metre server cabinet —
    // which is exactly what the substrate looked like: a floor of small boxes
    // under a forest of enormous poles.
    const h = Math.min(Math.max(top * 0.001 + Math.max(w, d) * rng.range(1.1, 3.4), 3), 46);
    out.push(
      part(
        "mast",
        [x + rng.range(-w * 0.2, w * 0.2), top + h / 2, z + rng.range(-d * 0.2, d * 0.2)],
        [0.5, h, 0.5],
        rotation,
        // A red or amber obstruction light at the top of a mast is a real
        // thing, and reads instantly as "this is a tall structure".
        { signal: "amber", emissive: rng.chance(0.55) ? 1 : 0 },
      ),
    );
  }
}

/* --------------------------------------------------------------- facade --- */

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
          { wear: rng.range(0.3, 0.9) },
        ),
      );
    }
  }
}

/** Service pipework running up a flank. Industrial districts only. */
function pipes(
  rng: Rng,
  x: number,
  z: number,
  base: number,
  h: number,
  w: number,
  d: number,
  rotation: number,
  out: Part[],
): void {
  const count = rng.int(2, 4);
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
        { wear: rng.range(0.6, 1) },
      ),
    );
  }
}

/**
 * Signage.
 *
 * Placed on frontage and at readable heights, never scattered. A sign exists
 * to be read from somewhere, and putting one on the back of a building at the
 * fortieth floor is the kind of detail that makes a world feel assembled by a
 * script instead of inhabited.
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
  signal: Signal,
  detail: DetailTier,
  out: Part[],
): void {
  // Racks do not carry shopfront signage. Nor does anything too small to
  // hold a sign a person could read.
  if (signal === "none" || detail === "far" || Math.max(w, d) < 6) return;

  // A vertical blade sign on a corner: the classic dense-city silhouette.
  if (rng.chance(0.42)) {
    const sh = rng.range(h * 0.14, h * 0.34);
    const sy = base + rng.range(h * 0.3, h * 0.72);
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
        { signal, emissive: rng.range(0.55, 1), wear: rng.range(0.2, 0.7) },
      ),
    );
  }

  // A horizontal band above the entrance. Low, wide, and the main source of
  // light at street level.
  if (rng.chance(0.55)) {
    const bh = rng.range(1.6, 4.2);
    out.push(
      part(
        "sign",
        [
          x + Math.sin(rotation) * (d / 2 + 0.35),
          base + rng.range(6, 16),
          z - Math.cos(rotation) * (d / 2 + 0.35),
        ],
        [w * rng.range(0.4, 0.82), bh, 0.5],
        rotation,
        { signal, emissive: rng.range(0.5, 1), wear: rng.range(0.2, 0.8) },
      ),
    );
  }
}

/* ------------------------------------------------------------- compose --- */

/**
 * Composes one building from the kit.
 *
 * Returns a `Structure` whose `size` is still the overall bounding mass — so
 * everything that reasoned about buildings before this existed still works —
 * plus the parts that make it look like a building.
 */
export function composeBuilding(input: ComposeInput): Structure {
  const { rng, level, archetype, detail, position, rotation, signal, lit } = input;
  const [x, base, z] = position;
  const parts: Part[] = [];

  let w = input.width;
  let d = input.depth;
  const totalHeight = input.height;
  const variant = rng.int(0, 3);
  const wear = rng.skewed(0.15, 1, 1.4);

  // --- podium -------------------------------------------------------------
  // Where the building meets the ground. Wider than the shaft, which is what
  // gives a street its continuous wall and stops towers looking like posts
  // stuck into a plane.
  const hasPodium = archetype !== "rack" && rng.chance(archetype === "tower" ? 0.8 : 0.5);
  let shaftBase = base;
  if (hasPodium) {
    const ph = Math.min(totalHeight * 0.2, rng.range(9, 24));
    parts.push(
      part("mass", [x, base + ph / 2, z], [w * rng.range(1.1, 1.35), ph, d * rng.range(1.1, 1.35)], rotation, {
        variant,
        wear,
        signal: lit ? signal : "none",
      }),
    );
    shaftBase = base + ph;
  }

  // --- shaft, stepping back ----------------------------------------------
  const tiers =
    archetype === "tower"
      ? rng.int(2, 3)
      : archetype === "stack"
        ? rng.int(2, 4)
        : archetype === "rack"
          ? 1
          : rng.int(1, 2);

  let y = shaftBase;
  let remaining = Math.max(totalHeight - (shaftBase - base), totalHeight * 0.5);

  for (let t = 0; t < tiers; t += 1) {
    const last = t === tiers - 1;
    const th = last ? remaining : remaining * rng.range(0.4, 0.68);
    if (th <= 0.4) break;

    // A stack is irregular by definition: its masses shift as well as shrink.
    const jitterX = archetype === "stack" ? rng.range(-w * 0.18, w * 0.18) : 0;
    const jitterZ = archetype === "stack" ? rng.range(-d * 0.18, d * 0.18) : 0;

    parts.push(
      part("mass", [x + jitterX, y + th / 2, z + jitterZ], [w, th, d], rotation, {
        variant: archetype === "stack" ? rng.int(0, 3) : variant,
        wear,
        signal: lit ? signal : "none",
      }),
    );

    if (detail === "near" || detail === "hero") {
      if (t === 0) fins(rng, x + jitterX, z + jitterZ, y, th, w, d, rotation, parts);
      if (level === "engine") pipes(rng, x + jitterX, z + jitterZ, y, th, w, d, rotation, parts);
    }

    y += th;
    remaining -= th;
    // Setback. The proportion is what makes a tower read as tapered rather
    // than as three boxes of decreasing size.
    const setback = archetype === "tower" ? rng.range(0.7, 0.86) : rng.range(0.78, 0.94);
    w *= setback;
    d *= setback;
  }

  // --- crown --------------------------------------------------------------
  if (archetype === "tower" || (archetype === "stack" && rng.chance(0.6))) {
    const ch = rng.range(5, 15);
    parts.push(
      part("mass", [x, y + ch / 2, z], [w * 0.7, ch, d * 0.7], rotation, {
        variant,
        wear,
        signal: "none",
      }),
    );
    y += ch;
  }

  roofKit(rng, x, z, y, w, d, rotation, detail, parts);
  signage(rng, x, z, base, totalHeight, input.width, input.depth, rotation, lit ? signal : "none", detail, parts);

  return {
    id: `${level}-${Math.round(x)}-${Math.round(z)}`,
    level,
    kind: archetype,
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
