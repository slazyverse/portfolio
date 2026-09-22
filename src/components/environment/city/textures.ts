import * as THREE from "three";
import { createRng, type Rng } from "@/lib/environment/seed";

/* ---------------------------------------------------------------------------
 * Textures, generated rather than downloaded.
 *
 * The brief asks for a world that looks like it has 4K materials without
 * shipping absurd amounts of data. The answer is not compression — it is not
 * shipping the pixels at all. Every texture here is drawn into a canvas at
 * runtime from the same seeded generator that places the city, which means:
 *
 *   - zero network bytes. Not one byte of texture crosses the wire.
 *   - zero licensing surface. Nothing is sourced, so nothing can be
 *     mis-licensed, and the asset manifest has nothing external to record.
 *   - deterministic. The same seed draws the same facade, so a screenshot
 *     taken today is comparable with one taken after a refactor.
 *   - resolution on demand. The quality tier picks the size; a balanced
 *     device gets 512 where a high one gets 1024, from the same code.
 *
 * The cost is GPU memory and a few milliseconds of canvas work at mount, both
 * of which are measured and budgeted rather than assumed.
 *
 * What makes this read as a facade rather than as a pattern: windows are lit
 * in correlated runs rather than independently (offices empty by floor, not by
 * window), the grid is interrupted by structural bands, and every variant gets
 * its own grime pass. Independent per-window randomness is the single most
 * recognisable tell of a generated building.
 * ------------------------------------------------------------------------- */

/**
 * How much of the world one facade tile covers, in metres.
 *
 * The texture repeats up and across a building rather than stretching to fit,
 * which is the whole reason a 512-pixel map can carry a hundred-metre tower:
 * a forty-storey facade shows the tile five times over, so the effective
 * resolution is five times the map. Stretching one tile over the whole
 * building is what makes generated architecture look like wallpaper.
 */
export const FACADE_TILE = { width: 23, height: 62 } as const;

/*
 * Why 30 by 72, and not something rounder.
 *
 * The tile carries six to twelve structural bays and fourteen to twenty-six
 * floors. Thirty metres across nine bays is a 3.3-metre window module, and
 * seventy-two metres over twenty floors is a 3.6-metre floor-to-floor — both
 * of which are what an actual office building uses.
 *
 * The first version used sixty-three metres wide, which made every window
 * about seven metres across. On a fifteen-metre industrial block that is two
 * windows per face, each the size of a garage door, and no amount of lighting
 * rescues a facade at that scale — it reads as a toy immediately.
 */

/** One texture set, owned by the scene and disposed with it. */
export interface CityTextures {
  /**
   * Facade albedo, one per variant — separate textures rather than an atlas.
   *
   * An atlas needs `fract()` in the fragment shader to keep tiling inside its
   * cell, and that breaks the derivatives mipmapping depends on: the result is
   * seams at cell edges and shimmering at distance. Separate textures with
   * `RepeatWrapping` tile correctly for free, and cost three extra draw calls
   * against a city that already shares seven meshes between every building.
   */
  facades: THREE.CanvasTexture[];
  /** Lit windows only, in register with the albedo of the same index. */
  facadeEmissives: THREE.CanvasTexture[];
  /** Roughness variation: grime, streaking, wear. Shared across surfaces. */
  grime: THREE.CanvasTexture;
  /** Wet asphalt with lane markings and worn paint. */
  road: THREE.CanvasTexture;
  dispose(): void;
}

/** Independent facade textures. Four is enough that repetition is not
    readable at city distances, and few enough to stay inside the memory
    budget at 512 each. */
export const FACADE_VARIANTS = 4;

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable while generating textures");
  return [c, ctx];
}

/**
 * Value noise, drawn as soft overlapping blobs.
 *
 * Cheaper than a real Perlin implementation and indistinguishable once it is
 * being used as a grime mask at a quarter opacity, which is the only thing it
 * is used for.
 */
function blobNoise(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  size: number,
  count: number,
  radius: [number, number],
  alpha: number,
  colour: string,
): void {
  for (let i = 0; i < count; i += 1) {
    const x = rng.range(0, size);
    const y = rng.range(0, size);
    const r = rng.range(radius[0], radius[1]);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, colour);
    g.addColorStop(1, "transparent");
    ctx.globalAlpha = alpha * rng.range(0.4, 1);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Vertical streaking, as rain pulls dirt down a facade. */
function weatherStreaks(
  ctx: CanvasRenderingContext2D,
  rng: Rng,
  size: number,
  count: number,
): void {
  for (let i = 0; i < count; i += 1) {
    const x = rng.range(0, size);
    const w = rng.range(1, size * 0.012);
    const top = rng.range(0, size * 0.6);
    const h = rng.range(size * 0.1, size * 0.55);
    const g = ctx.createLinearGradient(0, top, 0, top + h);
    g.addColorStop(0, "rgba(0,0,0,0.30)");
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(x, top, w, h);
  }
}

/**
 * One facade variant: albedo and emissive drawn in the same pass.
 *
 * Drawing both together is what keeps a lit window and its frame in register.
 * Generating them independently would mean two RNG streams that must agree
 * about which windows are lit, and they eventually would not.
 */
function drawFacade(
  albedo: CanvasRenderingContext2D,
  emissive: CanvasRenderingContext2D,
  rng: Rng,
  x0: number,
  y0: number,
  cell: number,
  signal: "amber" | "cold",
): void {
  // --- base material ------------------------------------------------------
  // Reflectance, not a background colour. Concrete and painted panel return a
  // third to a half of the light that hits them; the night comes from the
  // lighting rig, not from pre-darkened texture.
  const base = rng.pick(["#5d6675", "#525b69", "#68707e", "#4b5462"]);
  albedo.fillStyle = base;
  albedo.fillRect(x0, y0, cell, cell);

  emissive.fillStyle = "#000000";
  emissive.fillRect(x0, y0, cell, cell);

  // --- structural rhythm --------------------------------------------------
  // Floors and columns. A facade is a structure before it is a grid of holes,
  // and drawing the structure first is what stops the windows reading as a
  // checkerboard pasted onto a box.
  // Fine enough to read as a building rather than as a grid of hatches. The
  // first pass used six to twelve bays over a thirty-metre tile, which put
  // four-metre windows on a fifteen-metre facade — the single most reliable
  // way to make architecture look like a toy.
  const floors = rng.int(22, 34);
  const bays = rng.int(11, 19);
  const floorH = cell / floors;
  const bayW = cell / bays;

  albedo.strokeStyle = "rgba(0,0,0,0.32)";
  albedo.lineWidth = Math.max(1, cell * 0.0025);
  for (let f = 0; f <= floors; f += 1) {
    albedo.beginPath();
    albedo.moveTo(x0, y0 + f * floorH);
    albedo.lineTo(x0 + cell, y0 + f * floorH);
    albedo.stroke();
  }

  // Structural columns, lighter than the infill: they catch the light and
  // they are what gives a facade its vertical rhythm.
  albedo.fillStyle = "rgba(255,255,255,0.12)";
  for (let b = 0; b <= bays; b += 1) {
    albedo.fillRect(x0 + b * bayW - bayW * 0.06, y0, bayW * 0.12, cell);
  }

  // --- service bands ------------------------------------------------------
  // Plant floors: solid, louvred, unlit. Real towers have them every so often
  // and they break the window grid into legible blocks.
  const serviceFloors = new Set<number>();
  for (let f = rng.int(3, 7); f < floors; f += rng.int(5, 9)) {
    serviceFloors.add(f);
  }
  for (const f of serviceFloors) {
    albedo.fillStyle = "rgba(0,0,0,0.3)";
    albedo.fillRect(x0, y0 + f * floorH, cell, floorH);
    albedo.strokeStyle = "rgba(255,255,255,0.09)";
    albedo.lineWidth = 1;
    for (let l = 1; l < 4; l += 1) {
      const ly = y0 + f * floorH + (floorH * l) / 4;
      albedo.beginPath();
      albedo.moveTo(x0, ly);
      albedo.lineTo(x0 + cell, ly);
      albedo.stroke();
    }
  }

  // --- glazing ------------------------------------------------------------
  // Glazing is genuinely dark — it is a hole looking into an unlit room, and
  // it is the one surface here that should be near-black.
  const glass = rng.pick(["#141b26", "#101722", "#182030"]);
  const lightColour = signal === "amber" ? [255, 176, 92] : [150, 205, 235];

  // Occupancy runs. Offices empty a floor at a time, not a window at a time —
  // correlating the lit state along each floor is most of what separates this
  // from static.
  const floorLit: number[] = [];
  for (let f = 0; f < floors; f += 1) {
    floorLit.push(rng.chance(0.55) ? rng.range(0.25, 0.95) : rng.range(0, 0.12));
  }

  for (let f = 0; f < floors; f += 1) {
    if (serviceFloors.has(f)) continue;
    const density = floorLit[f]!;
    for (let b = 0; b < bays; b += 1) {
      const wx = x0 + b * bayW + bayW * 0.18;
      const wy = y0 + f * floorH + floorH * 0.2;
      const ww = bayW * 0.64;
      const wh = floorH * 0.6;

      /*
       * A window is a hole, not a rectangle.
       *
       * The previous pass painted flat dark glass with one highlight, and the
       * facades read as printed. A real opening has a reveal — the wall is
       * thick, so the head and one jamb fall into shadow while the sill
       * catches light from below. Four fills per window buys a depth cue that
       * no amount of lighting on a flat surface can produce.
       */
      const reveal = Math.max(1, Math.min(ww, wh) * 0.16);

      // The shadowed reveal: head and the jamb away from the key.
      albedo.fillStyle = "rgba(0,0,0,0.55)";
      albedo.fillRect(wx - reveal * 0.5, wy - reveal * 0.5, ww + reveal, wh + reveal);

      // The glass itself, inset inside the reveal.
      albedo.fillStyle = glass;
      albedo.fillRect(wx, wy, ww, wh);

      // The lit sill, catching bounce from the street below.
      albedo.fillStyle = "rgba(255,255,255,0.2)";
      albedo.fillRect(wx - reveal * 0.4, wy + wh, ww + reveal * 0.8, Math.max(1, reveal));
      // And a thin bright mullion down one side.
      albedo.fillStyle = "rgba(255,255,255,0.1)";
      albedo.fillRect(wx + ww, wy, Math.max(1, reveal * 0.5), wh);

      if (!rng.chance(density)) continue;

      /*
       * Lit windows, with a room behind them.
       *
       * Emissive only — the albedo keeps its glass, so a lit and an unlit
       * window are the same material under the same light. What varies is the
       * *shape* of the light: a full pane, a strip under a half-drawn blind,
       * or a dim glow from somewhere deeper in the room. Uniform rectangles
       * are the single most recognisable tell of a generated facade, and the
       * fix costs one extra branch.
       */
      const warmth = rng.skewed(0.35, 1, 1.4);
      const [r, g, b2] = lightColour;
      const paint = (scale: number) => {
        emissive.fillStyle = `rgb(${Math.round(r! * warmth * scale)},${Math.round(
          g! * warmth * scale,
        )},${Math.round(b2! * warmth * scale)})`;
      };

      const style = rng.next();
      if (style < 0.42) {
        // Fully lit pane.
        paint(1);
        emissive.fillRect(wx, wy, ww, wh);
      } else if (style < 0.72) {
        // Blind down to part of the opening.
        const inset = rng.range(0.2, 0.62);
        paint(1);
        emissive.fillRect(wx, wy + wh * inset, ww, wh * (1 - inset));
      } else if (style < 0.9) {
        // Light from deeper in the room: dimmer, and not reaching the edges.
        paint(0.45);
        emissive.fillRect(wx + ww * 0.12, wy + wh * 0.1, ww * 0.76, wh * 0.8);
      } else {
        // A partition splitting the opening — two offices, one lit.
        paint(1);
        emissive.fillRect(wx, wy, ww * rng.range(0.35, 0.6), wh);
      }
    }
  }

  // --- wear ---------------------------------------------------------------
  albedo.save();
  albedo.beginPath();
  albedo.rect(x0, y0, cell, cell);
  albedo.clip();
  albedo.translate(x0, y0);
  weatherStreaks(albedo, rng, cell, Math.round(cell / 48));
  blobNoise(albedo, rng, cell, 12, [cell * 0.06, cell * 0.2], 0.18, "#000000");
  blobNoise(albedo, rng, cell, 5, [cell * 0.05, cell * 0.14], 0.06, "#5a6273");
  albedo.restore();
}

function buildFacade(
  size: number,
  seed: string,
  variant: number,
): [THREE.CanvasTexture, THREE.CanvasTexture] {
  const [albedoCanvas, albedo] = canvas(size);
  const [emissiveCanvas, emissive] = canvas(size);

  // Half the variants are occupied, half are machine-lit. The palette
  // semantics hold here exactly as they do everywhere else: amber means a
  // person is present, cold means the building is running itself.
  drawFacade(
    albedo,
    emissive,
    createRng(`${seed}:facade:${variant}`),
    0,
    0,
    size,
    variant % 2 === 0 ? "amber" : "cold",
  );

  const map = new THREE.CanvasTexture(albedoCanvas);
  const emissiveMap = new THREE.CanvasTexture(emissiveCanvas);
  for (const t of [map, emissiveMap]) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
  }
  map.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  return [map, emissiveMap];
}

function buildGrime(size: number, seed: string): THREE.CanvasTexture {
  const [element, ctx] = canvas(size);
  const rng = createRng(`${seed}:grime`);
  ctx.fillStyle = "#8a8a8a";
  ctx.fillRect(0, 0, size, size);
  blobNoise(ctx, rng, size, 34, [size * 0.04, size * 0.24], 0.32, "#ffffff");
  blobNoise(ctx, rng, size, 26, [size * 0.05, size * 0.26], 0.32, "#000000");
  weatherStreaks(ctx, rng, size, Math.round(size / 36));
  const t = new THREE.CanvasTexture(element);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

/**
 * Wet asphalt.
 *
 * Markings are painted first and then worn, rather than drawn already faded:
 * the wear pass eats into them unevenly, which is what real paint does and
 * what a uniform low opacity never looks like.
 */
function buildRoad(size: number, seed: string): THREE.CanvasTexture {
  const [element, ctx] = canvas(size);
  const rng = createRng(`${seed}:road`);

  // Wet asphalt is dark but it is not black: around 0.12 reflectance dry,
  // and it is the reflection that makes it read as wet, not the albedo.
  ctx.fillStyle = "#2b3038";
  ctx.fillRect(0, 0, size, size);
  blobNoise(ctx, rng, size, 42, [size * 0.02, size * 0.1], 0.24, "#3c434e");
  blobNoise(ctx, rng, size, 24, [size * 0.03, size * 0.13], 0.2, "#1a1e25");

  // Lane markings down the centre of the tile.
  ctx.fillStyle = "rgba(214, 206, 176, 0.72)";
  const laneW = size * 0.012;
  for (let y = 0; y < size; y += size * 0.16) {
    ctx.fillRect(size * 0.5 - laneW / 2, y, laneW, size * 0.09);
  }
  // Kerb-side continuous line.
  ctx.fillStyle = "rgba(214, 206, 176, 0.42)";
  ctx.fillRect(size * 0.08, 0, laneW * 0.8, size);
  ctx.fillRect(size * 0.92, 0, laneW * 0.8, size);

  // Hazard hatching near the edge: infrastructure, not decoration.
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = "#c9a227";
  ctx.lineWidth = size * 0.008;
  for (let i = -1; i < 8; i += 1) {
    ctx.beginPath();
    ctx.moveTo(size * 0.02 + i * size * 0.03, size);
    ctx.lineTo(size * 0.02 + i * size * 0.03 + size * 0.05, size * 0.88);
    ctx.stroke();
  }
  ctx.restore();

  // Wear over the paint.
  blobNoise(ctx, rng, size, 28, [size * 0.025, size * 0.11], 0.28, "#232830");
  // Standing water: darker and smoother than the asphalt around it.
  blobNoise(ctx, rng, size, 14, [size * 0.06, size * 0.24], 0.42, "#141922");

  const t = new THREE.CanvasTexture(element);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Builds every texture the city needs.
 *
 * `size` comes from the quality tier. Memory is (size² × 4 bytes × 1.33 for
 * mipmaps) per texture, which at 1024 is about 5.6 MB each — a figure worth
 * knowing rather than discovering.
 */
/**
 * Built once per document.
 *
 * Generating ten textures is a few hundred canvas gradient fills, which is
 * cheap once and not cheap on every remount — and the inputs never change
 * within a page, because the palette is immutable and the seed is fixed. The
 * cache is keyed on both anyway, so a tier change still regenerates.
 *
 * Deliberately not disposed on unmount: the entry is shared, and a remount
 * that disposed it would leave the next one with dead GPU handles. It dies
 * with the document, which is the correct lifetime for something this
 * inexpensive to hold and this expensive to rebuild.
 */
const cache = new Map<string, CityTextures>();

export function createCityTextures(size: number, seed: string): CityTextures {
  const key = `${size}:${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const built = buildCityTextures(size, seed);
  cache.set(key, built);
  return built;
}

function buildCityTextures(size: number, seed: string): CityTextures {
  const facades: THREE.CanvasTexture[] = [];
  const facadeEmissives: THREE.CanvasTexture[] = [];
  for (let i = 0; i < FACADE_VARIANTS; i += 1) {
    const [map, emissiveMap] = buildFacade(size, seed, i);
    facades.push(map);
    facadeEmissives.push(emissiveMap);
  }

  const grime = buildGrime(Math.min(size, 512), seed);
  const road = buildRoad(size, seed);

  return {
    facades,
    facadeEmissives,
    grime,
    road,
    dispose() {
      for (const t of [...facades, ...facadeEmissives, grime, road]) t.dispose();
    },
  };
}

/**
 * Approximate GPU memory held by a texture set, in megabytes.
 *
 * Reported in the development diagnostics and in the lab rather than
 * estimated in prose. Mipmaps add about a third on top of the base level.
 */
export function textureMemoryMB(size: number): number {
  const perMap = (size * size * 4 * 1.33) / 1048576;
  const grimeSize = Math.min(size, 512);
  return (
    perMap * FACADE_VARIANTS * 2 +
    (grimeSize * grimeSize * 4 * 1.33) / 1048576 +
    perMap
  );
}
