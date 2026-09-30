import type { LevelEnvironment, LightSource, Part } from "./types";

/* ---------------------------------------------------------------------------
 * What the weather is allowed to know about the city.
 *
 * Rain used to fall through the viaducts, the station canopy and every
 * skybridge in the world as though none of them were there — which is the
 * loudest way weather can announce that it is an effect rather than a
 * condition. The shelter is modelled, drawn in front of the reader, and the
 * water ignored it.
 *
 * The rules that fix that are geometry over the level's own parts, so they
 * live here rather than in the renderer: no three.js, no DOM, and therefore
 * assertable in Node like everything else the world is built from. The
 * component is left with the buffers and the shader.
 * ------------------------------------------------------------------------- */

/** A thing rain cannot fall through, as an axis-aligned footprint. */
export interface Cover {
  x: number;
  z: number;
  /** Half-extents, widened to the piece's bounding box. */
  hx: number;
  hz: number;
  /** Height of its underside. */
  soffit: number;
}

/**
 * The minimum height at which something counts as shelter.
 *
 * Below this it is a step, a kerb or a loading platform — something you walk
 * on rather than under.
 */
export const SHELTER_MIN_HEIGHT = 8;

/**
 * One drop in five survives under a span.
 *
 * The dry patch under a bridge is the observation, so most of the drops there
 * are simply not drawn. What is left is the water running off the underside,
 * which is what you actually see standing under one in the rain — and it
 * makes the shelter legible from outside it as well, because the edge of the
 * dry patch is where the rain starts again.
 */
export const SHELTER_KEEP = 5;

/** A drip is slower than rain, because it is falling from far less height. */
export const DRIP_SPEED = 0.55;
/** And shorter, because a streak is a function of how fast it is going. */
export const DRIP_LENGTH = 0.42;

/** Below this much clear air, a drop has nowhere to fall and is not drawn. */
export const MIN_FALL = 4;

/**
 * Everything on this level that spans over open ground.
 *
 * The same rule the contact shadows use, and for the same reason: a shadow
 * and a dry patch are the same fact about the world seen two ways. A viaduct,
 * a skybridge, a station canopy and a cantilever all cast and all shelter; a
 * facade band, a balcony and a ceiling plate do none of it. Long and narrow
 * covers; broad does not, because a roof over the room you are standing in is
 * not a thing you shelter under — it is the room.
 *
 * Footprints are widened to the piece's bounding box rather than rotated,
 * which over-covers by a few percent at the corners of a piece turned three
 * degrees off true. That is the correct error to make: a drop that stops
 * slightly early is invisible, and one that falls through a bridge is not.
 */
export function shelters(band: LevelEnvironment): Cover[] {
  const out: Cover[] = [];
  const consider = (p: Part): void => {
    if (p.kind !== "bridge" && p.kind !== "platform") return;
    if (p.position[1] - band.floor < SHELTER_MIN_HEIGHT) return;
    const span = Math.max(p.size[0], p.size[2]);
    const across = Math.min(p.size[0], p.size[2]);
    if (span < 8 || across > 20) return;
    const c = Math.abs(Math.cos(p.rotation));
    const s = Math.abs(Math.sin(p.rotation));
    out.push({
      x: p.position[0],
      z: p.position[2],
      hx: (p.size[0] * c + p.size[2] * s) / 2,
      hz: (p.size[0] * s + p.size[2] * c) / 2,
      soffit: p.position[1] - p.size[1] / 2,
    });
  };
  for (const p of band.fixtures) consider(p);
  for (const st of band.structures) for (const p of st.parts) consider(p);
  return out;
}

/** The lowest thing spanning over this point, or null if the sky is open. */
export function lowestCover(
  covers: readonly Cover[],
  x: number,
  z: number,
): number | null {
  let best: number | null = null;
  for (const c of covers) {
    if (Math.abs(x - c.x) > c.hx || Math.abs(z - c.z) > c.hz) continue;
    if (best === null || c.soffit < best) best = c.soffit;
  }
  return best;
}

/** A lamp close enough to the ground to colour the water falling past it. */
export interface WeatherLamp {
  x: number;
  z: number;
  emissive: number;
  source: LightSource;
}

/**
 * The lamps on this level low enough to light rain.
 *
 * Thirty metres, which is about where a street lamp stops reaching and well
 * under the height at which a lit office window is lighting nothing but
 * itself.
 */
export const LAMP_MAX_HEIGHT = 30;

/**
 * How far a lamp's colour carries, squared.
 *
 * Eighteen metres, and the number is measured rather than picked. At forty —
 * which is roughly how far a street lamp throws enough light to read by — 85
 * percent of the drops on the surface level came back carrying a lamp's
 * colour, and rain that is almost entirely tinted is not lit rain, it is a
 * colour wash over the whole frame. At eighteen it is closer to a quarter,
 * which reads as what it is: the rain near a lamp goes orange and the rain
 * between lamps stays the colour of the sky.
 */
export const LAMP_REACH_SQ = 324;

export function weatherLamps(band: LevelEnvironment): WeatherLamp[] {
  const out: WeatherLamp[] = [];
  const consider = (p: Part): void => {
    if (p.emissive <= 0.5) return;
    if (p.position[1] - band.floor > LAMP_MAX_HEIGHT) return;
    out.push({
      x: p.position[0],
      z: p.position[2],
      emissive: p.emissive,
      source: p.source ?? (p.signal === "cold" ? "machine" : "interior"),
    });
  };
  for (const p of band.fixtures) consider(p);
  for (const st of band.structures) for (const p of st.parts) consider(p);
  return out;
}

/**
 * Which lamp is lighting this point.
 *
 * Brightness over distance, which is how anything gets its colour: a dim lamp
 * three metres away beats a bright one at twenty-five.
 */
export function nearestLamp(
  lamps: readonly WeatherLamp[],
  x: number,
  z: number,
): LightSource | null {
  let best: LightSource | null = null;
  let score = 0;
  for (const l of lamps) {
    const d2 = (l.x - x) ** 2 + (l.z - z) ** 2;
    if (d2 > LAMP_REACH_SQ) continue;
    const s = l.emissive / (1 + d2 * 0.012);
    if (s > score) {
      score = s;
      best = l.source;
    }
  }
  return best;
}

/** One drop, resolved against the world it is falling through. */
export interface Drop {
  x: number;
  z: number;
  /** Where it starts: the cloud base, or the underside of what is above it. */
  top: number;
  /** How far it falls before it lands. */
  fall: number;
  phase: number;
  speed: number;
  length: number;
  /** True when it is running off a structure rather than falling from the sky. */
  drip: boolean;
  /** What is lighting it, if anything is. */
  source: LightSource | null;
}

/**
 * The whole storm, as data.
 *
 * Derived from the drop index rather than from a clock or a generator, so the
 * weather is as reproducible as the city it falls on — and so this can be
 * asserted without rendering anything.
 */
export function rainfall(
  band: LevelEnvironment,
  count: number,
  radius: number,
  cloud: number,
): Drop[] {
  const covers = shelters(band);
  const lamps = weatherLamps(band);
  const out: Drop[] = [];

  for (let i = 0; i < count; i += 1) {
    const a = (i * 2.399963) % (Math.PI * 2);
    // Square root keeps the areal density even; without it every drop crowds
    // the centre of the shaft.
    const r = radius * Math.sqrt((i * 0.6180339887) % 1);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    let speed = 0.1 + ((i * 0.5698402909) % 1) * 0.12;
    let length = 3.5 + ((i * 0.3247179572) % 1) * 9;

    const roof = lowestCover(covers, x, z);
    let top = cloud;
    let drip = false;
    if (roof !== null) {
      if (i % SHELTER_KEEP !== 0) continue;
      top = roof;
      speed *= DRIP_SPEED;
      length *= DRIP_LENGTH;
      drip = true;
    }

    const fall = top - band.floor;
    if (fall < MIN_FALL) continue;

    out.push({
      x,
      z,
      top,
      fall,
      phase: (i * 0.7548776662) % 1,
      speed,
      length,
      drip,
      source: nearestLamp(lamps, x, z),
    });
  }

  return out;
}
