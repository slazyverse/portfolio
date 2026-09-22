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
 * WHAT A BUILDING NOW KNOWS ABOUT ITSELF
 *
 * Phase 5B gave every building a district and, where it matters, an owner.
 * That is what lets the world carry meaning without explaining itself:
 *
 *   corporate    clean surfaces, enormous signage, skybridges, no exposed
 *                services — somebody pays for this
 *   commercial   saturated frontage, storefront bands, clutter, patched fabric
 *   residential  balconies, cabling, service platforms, heavy wear
 *   industrial   plant, pipework, almost no signage, dirtiest fabric
 *   undercity    maintained when it fails and not before
 *
 * Nothing below decides what class a building belongs to. It reads the
 * district profile and spends accordingly, which is how inequality ends up in
 * the geometry rather than in a comment.
 *
 * PROCEDURAL IS NOT RANDOM. Every choice is bounded by an archetype and a
 * district. The generator has latitude inside the rules; it does not get a
 * vote on the rules.
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
    out.push(
      part("mast", [mx, top + h / 2, mz], [0.5, h, 0.5], rotation, {
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
): void {
  const bands = rng.int(1, 4);
  for (let i = 1; i <= bands; i += 1) {
    const y = base + (h * i) / (bands + 1) + rng.range(-h * 0.05, h * 0.05);
    out.push(
      part(
        "platform",
        [x, y, z],
        [w * rng.range(1.02, 1.07), rng.range(0.6, 1.6), d * rng.range(1.02, 1.07)],
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

/* -------------------------------------------------------------- signage --- */

/**
 * Signage, in a hierarchy.
 *
 * Four scales, each with a spatial reason: a skyline sign is readable across
 * the district and only something enormous can carry one; a micro label is a
 * hazard plate next to a door. Scattering neon at random is the difference
 * between a city that has been advertised at and a city that has had lights
 * put on it.
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

  // SKYLINE — a corporation's name across the top of its own tower.
  if (owner && h >= SIGN_TIERS.skyline.minHost && rng.chance(owner.presence)) {
    place("skyline", owner.signal, false);
  }

  // DISTRICT — frontage bands. This is where consumerism is loudest.
  if (rng.chance(profile.signage)) {
    place("district", profile.signal, rng.chance(0.45));
  }
  if (district === "commercial" && rng.chance(0.55)) {
    place("district", rng.chance(0.5) ? "amber" : "cold", true);
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
 * Human-scale clutter at the base of a building.
 *
 * Bollards, utility cabinets, railings, vents. None of it is individually
 * interesting, and collectively it is most of what makes a street read as a
 * place people use rather than as a ground plane with towers on it. It is also
 * the scale reference that makes the towers feel enormous — a 200-metre
 * building only reads as 200 metres if there is something 1-metre next to it.
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
  const count = Math.round(rng.range(2, 9) * profile.clutter);

  for (let i = 0; i < count; i += 1) {
    // Ranged along the frontage, just off the face — where a pavement is.
    const along = rng.range(-w * 0.55, w * 0.55);
    const out_ = d / 2 + rng.range(1.6, 5);
    const kind = rng.next();

    // Cabinet, bollard or railing run — the same instanced box at three very
    // different scales, which is all this needs to be.
    const size: [number, number, number] = kind < 0.4
      ? [rng.range(0.9, 1.8), rng.range(1.2, 2.2), rng.range(0.7, 1.4)]
      : kind < 0.75
        ? [rng.range(0.25, 0.45), rng.range(0.9, 1.3), rng.range(0.25, 0.45)]
        : [rng.range(3, 7), rng.range(0.9, 1.2), rng.range(0.2, 0.35)];

    out.push(
      part(
        "prop",
        [
          x + Math.cos(rotation) * along + Math.sin(rotation) * out_,
          base + size[1] / 2,
          z + Math.sin(rotation) * along - Math.cos(rotation) * out_,
        ],
        size,
        rotation + rng.range(-0.25, 0.25),
        { wear: rng.range(profile.wear[0], profile.wear[1]) },
      ),
    );
  }

  // A vent stack breathing at street level. Steam is drawn by the renderer;
  // this is the thing it comes out of.
  if (rng.chance(profile.exposedServices * 0.6)) {
    out.push(
      part(
        "prop",
        [
          x + Math.cos(rotation) * rng.range(-w * 0.4, w * 0.4) + Math.sin(rotation) * (d / 2 + 2.4),
          base + 0.4,
          z + Math.sin(rotation) * rng.range(-w * 0.4, w * 0.4) - Math.cos(rotation) * (d / 2 + 2.4),
        ],
        [rng.range(1.4, 2.6), 0.8, rng.range(1.4, 2.6)],
        rotation,
        { wear: 1, signal: "cold", emissive: 0 },
      ),
    );
  }
}

/* ------------------------------------------------------------- compose --- */

export function composeBuilding(input: ComposeInput): Structure {
  const { rng, level, archetype, detail, district, owner, position, rotation, signal, lit } = input;
  const [x, base, z] = position;
  const profile = DISTRICTS[district];
  const parts: Part[] = [];

  let w = input.width;
  let d = input.depth;
  const totalHeight = input.height;
  const variant = rng.int(0, 3);
  const wear = rng.range(profile.wear[0], profile.wear[1]);

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

    // A stack is irregular by definition: its masses shift as well as shrink.
    const jitterX = archetype === "stack" ? rng.range(-w * 0.2, w * 0.2) : 0;
    const jitterZ = archetype === "stack" ? rng.range(-d * 0.2, d * 0.2) : 0;

    parts.push(
      part("mass", [x + jitterX, y + th / 2, z + jitterZ], [w, th, d], rotation, {
        variant: archetype === "stack" ? rng.int(0, 3) : variant,
        wear,
        signal: lit ? signal : "none",
      }),
    );

    if (detail === "near" || detail === "hero") {
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
    } else if (detail === "mid" && rng.chance(0.5)) {
      reliefBands(rng, x + jitterX, z + jitterZ, y, th, w, d, rotation, wear, parts);
    }

    y += th;
    remaining -= th;
    const setback = archetype === "tower" ? rng.range(0.7, 0.88) : rng.range(0.78, 0.94);
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

  roofKit(rng, x, z, y, w, d, rotation, detail, district, totalHeight, parts);
  signage(
    rng, x, z, base, totalHeight, input.width, input.depth, rotation,
    district, lit ? owner : undefined, detail, parts,
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
