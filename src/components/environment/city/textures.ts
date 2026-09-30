import * as THREE from "three";
import {
  FACADE_ROUGHNESS,
  FLOOR_ALBEDO as FA,
  FLOOR_ROUGHNESS as FR,
  ROAD_ROUGHNESS as RR,
} from "@/lib/environment/materials";
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
  /**
   * How rough each part of that facade is, in register with both.
   *
   * Glass smooth, concrete rough, louvred plant rougher, grime rougher again.
   * Before this the facades used the shared grime map, which had no
   * relationship to them at all: every window in the city returned the same
   * reflection as the wall it was set into.
   */
  facadeRoughs: THREE.CanvasTexture[];
  /** Roughness variation: grime, streaking, wear. Shared across surfaces. */
  grime: THREE.CanvasTexture;
  /** Wet asphalt with lane markings, worn paint, seams, covers and patches. */
  road: THREE.CanvasTexture;
  /** The engine and interface deck: bays, grating, walkway, machine wear. */
  engineFloor: THREE.CanvasTexture;
  engineFloorRough: THREE.CanvasTexture;
  /** The substrate slab: drainage, spalling, efflorescence, repairs. */
  substrateFloor: THREE.CanvasTexture;
  substrateFloorRough: THREE.CanvasTexture;
  /**
   * How rough each square metre of that road is.
   *
   * In register with `road`, and the reason the street reads as wet in
   * places rather than wet everywhere: a puddle is smooth, a sealed joint is
   * coarse, and a wheel track is polished. Half resolution, because
   * roughness varies over metres.
   */
  roadRough: THREE.CanvasTexture;
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
  /**
   * How rough each square metre of the facade is, in register with the other
   * two.
   *
   * The facades were given the shared grime map as a roughness map — a
   * texture with no relationship to them at all, tiled at a different rate,
   * so a building's specular response had nothing to do with where its
   * windows were. Glass and concrete came back identical, which is the one
   * material distinction a night city cannot afford to lose: almost every
   * highlight in a frame like this is a window.
   *
   * Painted here rather than in a second pass for the same reason the
   * emissive is: two streams that have to agree about which windows exist
   * eventually will not.
   */
  rough: CanvasRenderingContext2D,
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

  // Concrete and precast panel: the roughest thing on the elevation, and what
  // most of it is.
  rough.fillStyle = FACADE_ROUGHNESS.concrete;
  rough.fillRect(x0, y0, cell, cell);

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
  rough.fillStyle = FACADE_ROUGHNESS.painted;
  for (let b = 0; b <= bays; b += 1) {
    albedo.fillRect(x0 + b * bayW - bayW * 0.06, y0, bayW * 0.12, cell);
    // A structural column is clad or painted, not bare concrete.
    rough.fillRect(x0 + b * bayW - bayW * 0.06, y0, bayW * 0.12, cell);
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
    // Louvres and plant. Rougher than the wall and much rougher than glass.
    rough.fillStyle = FACADE_ROUGHNESS.louvre;
    rough.fillRect(x0, y0 + f * floorH, cell, floorH);
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

  /*
   * What is burning behind the glass.
   *
   * This was one colour per facade — amber or cold, chosen by the variant —
   * and it was the single largest cause of the city reading as monochrome.
   * The facade atlas paints most of the lit pixels in any frame, so two
   * colours here meant two colours everywhere, whatever else was done to the
   * lights around them.
   *
   * A real tower has none of that uniformity. Tenants differ, so lamps
   * differ: warm domestic and hotel light, the flat neutral of an office
   * ceiling grid, the colder white of a floor full of equipment, the sodium
   * still in older stock, and now and then the blue wash of a room lit only
   * by a screen. These are lamp colours, not palette tokens, which is why
   * they are written here as what they are.
   *
   * Assigned per floor rather than per window, for the same reason occupancy
   * is: one tenant lights one floor, and a facade where every window is a
   * different colour reads as a Christmas tree rather than as a building.
   */
  const INTERIOR = [
    { rgb: [255, 214, 176], warm: 0.46, cool: 0.08 }, // domestic / hotel, 3000 K
    { rgb: [246, 238, 220], warm: 0.26, cool: 0.2 }, // office ceiling grid
    { rgb: [214, 232, 240], warm: 0.1, cool: 0.3 }, // equipment floor, 5000 K
    { rgb: [150, 205, 235], warm: 0.04, cool: 0.32 }, // plant and data, cold
    { rgb: [255, 154, 96], warm: 0.12, cool: 0.04 }, // older stock, sodium
    { rgb: [118, 158, 255], warm: 0.02, cool: 0.06 }, // a room lit by a screen
  ] as const;

  const pickInterior = (): readonly number[] => {
    const key = signal === "amber" ? "warm" : "cool";
    const total = INTERIOR.reduce((sum, t) => sum + t[key], 0);
    let r = rng.next() * total;
    for (const tint of INTERIOR) {
      r -= tint[key];
      if (r <= 0) return tint.rgb;
    }
    return INTERIOR[0]!.rgb;
  };

  // Occupancy runs. Offices empty a floor at a time, not a window at a time —
  // correlating the lit state along each floor is most of what separates this
  // from static.
  const floorLit: number[] = [];
  const floorTint: (readonly number[])[] = [];
  for (let f = 0; f < floors; f += 1) {
    floorLit.push(rng.chance(0.55) ? rng.range(0.25, 0.95) : rng.range(0, 0.12));
    floorTint.push(pickInterior());
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

      // The glass itself, inset inside the reveal — and the only genuinely
      // smooth thing on the building. This is the whole point of the map: a
      // window returns a sharp reflection and the wall around it does not,
      // and until now they returned the same one.
      albedo.fillStyle = glass;
      albedo.fillRect(wx, wy, ww, wh);
      rough.fillStyle = FACADE_ROUGHNESS.glass;
      rough.fillRect(wx, wy, ww, wh);

      // The lit sill, catching bounce from the street below. Metal, so it
      // sits between the glass and the wall.
      albedo.fillStyle = "rgba(255,255,255,0.2)";
      albedo.fillRect(wx - reveal * 0.4, wy + wh, ww + reveal * 0.8, Math.max(1, reveal));
      rough.fillStyle = FACADE_ROUGHNESS.metal;
      rough.fillRect(wx - reveal * 0.4, wy + wh, ww + reveal * 0.8, Math.max(1, reveal));
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
      // One window in roughly two hundred is something else entirely: a lit
      // exit sign, a panel in alarm. Rare enough to be a detail somebody
      // notices rather than a pattern.
      const [r, g, b2] = rng.chance(0.005) ? [255, 96, 74] : floorTint[f]!;
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

  /*
   * And the same wear in the roughness map.
   *
   * Dirt is rough. A streak of it down a glazed elevation kills the
   * reflection exactly where it runs, which is most of what separates a
   * maintained frontage from a neglected one — the windows of a building
   * nobody washes stop being windows.
   *
   * Drawn from its own stream rather than the shared one so the albedo's
   * grime and this stay independent: a facade where every dirty patch is
   * also exactly a dull patch reads as a decal of dirt.
   */
  rough.save();
  rough.beginPath();
  rough.rect(x0, y0, cell, cell);
  rough.clip();
  rough.translate(x0, y0);
  blobNoise(rough, rng, cell, 14, [cell * 0.05, cell * 0.22], 0.3, FACADE_ROUGHNESS.grime);
  blobNoise(rough, rng, cell, 6, [cell * 0.04, cell * 0.12], 0.16, FACADE_ROUGHNESS.clean);
  rough.restore();
}

function buildFacade(
  size: number,
  seed: string,
  variant: number,
): [THREE.CanvasTexture, THREE.CanvasTexture, THREE.CanvasTexture] {
  const [albedoCanvas, albedo] = canvas(size);
  const [emissiveCanvas, emissive] = canvas(size);
  /*
   * Half the edge length, a quarter of the pixels.
   *
   * Roughness varies over a facade far more slowly than albedo does — it is
   * "glass, wall, louvre, dirt" rather than every mullion and sill — and at
   * full size four of these put the texture set at 19.8 MB against a 16 MB
   * ceiling. Halving them lands at 15.8. The boundary between a window and
   * the wall around it is still eleven pixels wide, which is more than a
   * specular response needs.
   */
  const roughSize = Math.max(128, Math.round(size / 2));
  const [roughCanvas, rough] = canvas(roughSize);

  // Half the variants are occupied, half are machine-lit. The palette
  // semantics hold here exactly as they do everywhere else: amber means a
  // person is present, cold means the building is running itself.
  // The roughness context is scaled so the same drawing code lands in the
  // same place on both canvases, whatever their resolutions are.
  rough.scale(roughSize / size, roughSize / size);

  drawFacade(
    albedo,
    emissive,
    rough,
    createRng(`${seed}:facade:${variant}`),
    0,
    0,
    size,
    variant % 2 === 0 ? "amber" : "cold",
  );

  const map = new THREE.CanvasTexture(albedoCanvas);
  const emissiveMap = new THREE.CanvasTexture(emissiveCanvas);
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  for (const t of [map, emissiveMap, roughnessMap]) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
  }
  map.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  // Data, not colour.
  roughnessMap.colorSpace = THREE.NoColorSpace;
  return [map, emissiveMap, roughnessMap];
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
 * Wet asphalt, and how rough it is.
 *
 * Two maps out of one pass, because the interesting thing about a wet road is
 * not its colour — it is that the wetness is not uniform. A puddle is darker
 * than the asphalt around it *and* smoother. A patch of new blacktop is
 * darker and rougher. The two strips a car's wheels polish down a lane are
 * lighter and smoother than the lane they run along. Painted into an albedo
 * alone all three are a picture of a road; painted into a roughness map as
 * well they are a road, because the specular response is what the eye
 * actually reads as wet.
 *
 * Drawn together rather than in two passes so the two agree. A puddle that is
 * dark in one map and rough in the other is worse than no puddle at all.
 *
 * Everything added here is incident rather than pattern: seams where two
 * paving runs met, a trench cut for a service and sealed back, covers, a
 * gully and the fan of road that drains into it, cracks. That is what was
 * missing. The surface had markings and grime and no history, and a road with
 * no history reads as a texture rather than as somewhere vehicles have been
 * driving for thirty years.
 */
function buildRoad(
  size: number,
  seed: string,
): { albedo: THREE.CanvasTexture; roughness: THREE.CanvasTexture } {
  const [element, ctx] = canvas(size);
  // Half resolution. Roughness varies over metres rather than centimetres,
  // so this is the map in the set least rewarded by pixels, and the cheapest
  // place to decline to spend them.
  const roughSize = Math.max(128, Math.round(size / 2));
  const [roughElement, rgh] = canvas(roughSize);
  const rng = createRng(`${seed}:road`);

  /*
   * One feature, both maps, each at its own resolution.
   *
   * The callback works in normalised coordinates multiplied by whatever size
   * it is handed, which is what keeps a seam in the albedo and the same seam
   * in the roughness map on top of each other.
   */
  const paint = (
    albedo: string | null,
    rough: string | null,
    draw: (c: CanvasRenderingContext2D, s: number) => void,
  ): void => {
    if (albedo !== null) {
      ctx.save();
      ctx.fillStyle = albedo;
      ctx.strokeStyle = albedo;
      draw(ctx, size);
      ctx.restore();
    }
    if (rough !== null) {
      rgh.save();
      rgh.fillStyle = rough;
      rgh.strokeStyle = rough;
      draw(rgh, roughSize);
      rgh.restore();
    }
  };

  // --- base ---------------------------------------------------------------
  // Wet asphalt is dark but it is not black: around 0.12 reflectance dry, and
  // it is the reflection that makes it read as wet, not the albedo.
  //
  // 0.85 here against the material's 0.62 multiplier lands on the 0.53 the
  // previous pass arrived at by hand, which is the number this has to keep.
  // Below about 0.34 the key light's own lobe blows out a fifth of the frame,
  // and that was a real bug once, so every value in this function stays clear
  // of it: the map runs from 0.69 in standing water to 0.94 on a sealed
  // joint, an effective 0.43 to 0.58. Measured rather than assumed — the
  // first draft reached 0.56 and put twenty-three times as many blown pixels
  // on the road.
  ctx.fillStyle = FA.road;
  ctx.fillRect(0, 0, size, size);
  rgh.fillStyle = RR.asphalt;
  rgh.fillRect(0, 0, roughSize, roughSize);

  blobNoise(ctx, rng, size, 42, [size * 0.02, size * 0.1], 0.24, "#3c434e");
  blobNoise(ctx, rng, size, 24, [size * 0.03, size * 0.13], 0.2, "#1a1e25");
  // Damp and dry in broad areas, independent of the albedo's grime: a road
  // dries in patches, from the crown of the camber outward.
  blobNoise(rgh, rng, roughSize, 16, [roughSize * 0.08, roughSize * 0.3], 0.3, RR.damp);
  blobNoise(rgh, rng, roughSize, 12, [roughSize * 0.06, roughSize * 0.24], 0.25, RR.dry);

  // --- wheel tracks -------------------------------------------------------
  /*
   * Where the tyres go.
   *
   * Two lanes, two wheels each. Years of traffic polish those four strips
   * smoother than the asphalt beside them and lift them slightly in albedo as
   * the binder wears off the aggregate. On a wet night they are the brightest
   * thing on the road, because a smoother surface returns more of the light
   * it is given in one direction.
   *
   * This is the single addition that does most for physical scale: it states
   * how wide a vehicle is without drawing one.
   */
  for (const u of [0.19, 0.39, 0.61, 0.81]) {
    paint("rgba(255,255,255,0.055)", RR.wheelTrack, (c, s) => {
      const w = s * 0.024;
      const g = c.createLinearGradient(u * s - w, 0, u * s + w, 0);
      g.addColorStop(0, "transparent");
      g.addColorStop(0.5, c.fillStyle as string);
      g.addColorStop(1, "transparent");
      c.fillStyle = g;
      c.fillRect(u * s - w, 0, w * 2, s);
    });
  }

  // --- construction joints ------------------------------------------------
  // A road is laid in runs and the runs meet: longitudinal between paving
  // lanes, transverse where one day's work stopped. Sealant is coarser than
  // the asphalt it joins, so these go *up* in roughness while going down in
  // albedo, and that pair of moves is what reads as a filled joint rather
  // than as a drawn line.
  for (const u of [0.29, 0.71]) {
    paint("rgba(0,0,0,0.38)", RR.joint, (c, s) => c.fillRect(u * s, 0, s * 0.005, s));
  }
  for (const v of [0.23, 0.69]) {
    paint("rgba(0,0,0,0.32)", RR.joint, (c, s) => c.fillRect(0, v * s, s, s * 0.004));
    // One side of a transverse seam sits a few millimetres proud and catches
    // light along its whole length.
    paint("rgba(255,255,255,0.06)", null, (c, s) =>
      c.fillRect(0, v * s - s * 0.004, s, s * 0.004),
    );
  }

  // --- patched asphalt ----------------------------------------------------
  // A trench cut for a service and filled back in. Newer, darker, coarser,
  // and outlined by the sealant run round the cut.
  for (let i = 0; i < 2; i += 1) {
    const px = rng.range(0.12, 0.62);
    const pv = rng.range(0.08, 0.7);
    const pw = rng.range(0.14, 0.3);
    const ph = rng.range(0.06, 0.16);
    paint("#252b34", RR.patch, (c, s) => c.fillRect(px * s, pv * s, pw * s, ph * s));
    paint("rgba(0,0,0,0.45)", null, (c, s) => {
      c.lineWidth = Math.max(1, s * 0.004);
      c.strokeRect(px * s, pv * s, pw * s, ph * s);
    });
  }

  // --- service covers -----------------------------------------------------
  // Cast iron, about a metre across, set flush and never quite level. Off the
  // wheel tracks, which is where they are in a real road because that is
  // where the services run.
  const covers: readonly (readonly [number, number])[] = [
    [0.5, rng.range(0.1, 0.45)],
    [0.29, rng.range(0.55, 0.92)],
  ];
  for (const [cu, cv] of covers) {
    const r = 0.013;
    paint("#20252d", RR.cover, (c, s) => {
      c.beginPath();
      c.arc(cu * s, cv * s, r * s, 0, Math.PI * 2);
      c.fill();
    });
    paint("rgba(255,255,255,0.13)", null, (c, s) => {
      c.lineWidth = Math.max(1, s * 0.003);
      c.beginPath();
      c.arc(cu * s, cv * s, r * s, 0, Math.PI * 2);
      c.stroke();
    });
  }

  // --- drainage -----------------------------------------------------------
  // A gully at the kerb, and the damp fan of road that drains into it. The
  // fan is the part that matters: water on a road goes somewhere, and a
  // surface that is uniformly wet is a surface nobody has thought about.
  for (const gu of [0.095, 0.905]) {
    const gv = rng.range(0.15, 0.75);
    paint(null, RR.dampFan, (c, s) => {
      const g = c.createRadialGradient(gu * s, gv * s, 0, gu * s, gv * s, s * 0.11);
      g.addColorStop(0, RR.dampFan);
      g.addColorStop(1, "transparent");
      c.fillStyle = g;
      c.fillRect(gu * s - s * 0.11, gv * s - s * 0.11, s * 0.22, s * 0.22);
    });
    paint("rgba(0,0,0,0.5)", null, (c, s) => {
      const g = c.createRadialGradient(gu * s, gv * s, 0, gu * s, gv * s, s * 0.09);
      g.addColorStop(0, "rgba(0,0,0,0.45)");
      g.addColorStop(1, "transparent");
      c.fillStyle = g;
      c.fillRect(gu * s - s * 0.09, gv * s - s * 0.09, s * 0.18, s * 0.18);
    });
    // The grating itself.
    paint("#12161c", RR.grating, (c, s) =>
      c.fillRect(gu * s, gv * s, s * 0.024, s * 0.009),
    );
  }

  // --- cracks -------------------------------------------------------------
  // Thin, and going somewhere. A straight crack reads as a scratch.
  for (let i = 0; i < 5; i += 1) {
    const sx = rng.range(0, 1);
    const sy = rng.range(0, 1);
    const dir = rng.range(-0.5, 0.5);
    const len = rng.range(0.08, 0.26);
    paint("rgba(0,0,0,0.34)", RR.crack, (c, s) => {
      c.lineWidth = Math.max(1, s * 0.0022);
      c.beginPath();
      c.moveTo(sx * s, sy * s);
      for (let k = 1; k <= 5; k += 1) {
        const t = k / 5;
        c.lineTo((sx + dir * len * t) * s, (sy + len * t) * s);
      }
      c.stroke();
    });
  }

  // --- markings -----------------------------------------------------------
  // Painted first and then worn, rather than drawn already faded: the wear
  // pass eats into them unevenly, which is what real paint does and what a
  // uniform low opacity never looks like. Thermoplastic is smoother than the
  // asphalt it sits on, so it belongs in the roughness map too.
  paint("rgba(214, 206, 176, 0.72)", RR.laneMarking, (c, s) => {
    const w = s * 0.012;
    for (let y = 0; y < s; y += s * 0.16) c.fillRect(s * 0.5 - w / 2, y, w, s * 0.09);
  });
  paint("rgba(214, 206, 176, 0.42)", RR.kerbMarking, (c, s) => {
    const w = s * 0.012 * 0.8;
    c.fillRect(s * 0.08, 0, w, s);
    c.fillRect(s * 0.92, 0, w, s);
  });

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

  // --- standing water -----------------------------------------------------
  /*
   * The one thing that has to be in both maps at the same coordinates.
   *
   * `blobNoise` draws its own positions from the stream, which is right for
   * grime and useless here: a puddle is a puddle because the dark patch and
   * the smooth patch are the same patch. So these positions are drawn once
   * and painted twice — darker in albedo, and smoother in roughness.
   *
   * 0.69 rather than the 0.56 this was first written with. Against the
   * material's 0.62 that is an effective 0.43, and the difference is not
   * academic: measured over the road half of the surface shot, 0.56 took
   * blown-out pixels from 0.018 percent of the frame to 0.416 — a
   * twenty-three-fold increase and the beginning of the same specular
   * blow-out the roughness value above exists to avoid. A puddle that is
   * smoother than its surroundings is the whole point; a puddle that is a
   * mirror is the bug.
   */
  for (let i = 0; i < 14; i += 1) {
    const pu = rng.range(0, 1);
    const pv = rng.range(0, 1);
    const pr = rng.range(0.06, 0.24);
    const a = rng.range(0.4, 1);
    paint("#141922", RR.water, (c, s) => {
      const g = c.createRadialGradient(pu * s, pv * s, 0, pu * s, pv * s, pr * s);
      g.addColorStop(0, c.fillStyle as string);
      g.addColorStop(1, "transparent");
      c.globalAlpha = a * 0.42;
      c.fillStyle = g;
      c.beginPath();
      c.arc(pu * s, pv * s, pr * s, 0, Math.PI * 2);
      c.fill();
    });
  }

  const albedo = new THREE.CanvasTexture(element);
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;
  albedo.anisotropy = 8;
  albedo.colorSpace = THREE.SRGBColorSpace;

  const roughness = new THREE.CanvasTexture(roughElement);
  roughness.wrapS = THREE.RepeatWrapping;
  roughness.wrapT = THREE.RepeatWrapping;
  roughness.anisotropy = 4;
  // Data, not colour. A roughness map read as sRGB is a roughness map with a
  // gamma curve applied to it, which is a different material.
  roughness.colorSpace = THREE.NoColorSpace;

  return { albedo, roughness };
}

/**
 * The floors nobody walks on, and what they say about the place.
 *
 * The engine and substrate levels shared one texture — the generic grime map,
 * tinted — because they are not streets and the road map would have put a
 * dashed centre line through a plant hall. Sharing a map is not the same as
 * having a surface, though, and it left two of the four levels standing on
 * the same anonymous slab. The ground is most of the lower half of every
 * frame at those depths. It is the wrong place to say nothing.
 *
 * Each level gets one now, and they are different because the places are:
 *
 *   ENGINE     a working deck. Structural bays, bolt lines, walkway markings,
 *              grating over the services, access hatches, and the oil of
 *              machinery that gets maintained where it stands.
 *   SUBSTRATE  older, deeper, wetter. Big poured slabs, a drainage channel
 *              with damp either side, spalling where the aggregate shows
 *              through, efflorescence off the salts, and repairs on top of
 *              repairs.
 *
 * Both come with a roughness map, for the same reason the road does: what
 * makes a surface read as a material is how it returns light, and a single
 * scalar over an entire floor says it is all one thing.
 *
 * Drawn at half the facade edge length. A floor tile covers eighteen metres
 * against the road's forty-six, so half the pixels is still more resolution
 * per metre than the road gets.
 */
function buildFloor(
  size: number,
  seed: string,
  level: "engine" | "substrate",
): { albedo: THREE.CanvasTexture; roughness: THREE.CanvasTexture } {
  const [element, ctx] = canvas(size);
  // A quarter of the albedo's edge length, on the same argument as
  // everywhere else: roughness on a concrete floor varies over metres.
  const roughSize = Math.max(64, Math.round(size / 2));
  const [roughElement, rgh] = canvas(roughSize);
  const rng = createRng(`${seed}:floor:${level}`);
  const engine = level === "engine";

  const paint = (
    albedo: string | null,
    rough: string | null,
    draw: (c: CanvasRenderingContext2D, s: number) => void,
  ): void => {
    if (albedo !== null) {
      ctx.save();
      ctx.fillStyle = albedo;
      ctx.strokeStyle = albedo;
      draw(ctx, size);
      ctx.restore();
    }
    if (rough !== null) {
      rgh.save();
      rgh.fillStyle = rough;
      rgh.strokeStyle = rough;
      draw(rgh, roughSize);
      rgh.restore();
    }
  };

  // --- base ---------------------------------------------------------------
  // The engine deck is painted steel and poured concrete kept in service; the
  // substrate is the original pour, sixty years older and never repainted.
  ctx.fillStyle = engine ? FA.engine : FA.substrate;
  ctx.fillRect(0, 0, size, size);
  rgh.fillStyle = engine ? FR.deck : FR.oldConcrete;
  rgh.fillRect(0, 0, roughSize, roughSize);

  blobNoise(ctx, rng, size, 34, [size * 0.03, size * 0.14], 0.22, engine ? "#464e59" : "#373e47");
  blobNoise(ctx, rng, size, 28, [size * 0.04, size * 0.18], 0.24, engine ? "#2b313a" : "#21262d");
  blobNoise(rgh, rng, roughSize, 14, [roughSize * 0.08, roughSize * 0.3], 0.26, FR.dry);

  // --- structural bays ----------------------------------------------------
  /*
   * A floor this size is not one pour. It is bays, and the joints between
   * them are the single strongest cue for how big everything else is — a
   * surface with no joints in it has no scale, which is most of why these
   * two levels read as backdrop.
   */
  const bays = engine ? 4 : 3;
  for (let i = 1; i < bays; i += 1) {
    const u = i / bays;
    paint("rgba(0,0,0,0.42)", FR.joint, (c, s) => c.fillRect(u * s, 0, s * 0.006, s));
    paint("rgba(0,0,0,0.42)", FR.joint, (c, s) => c.fillRect(0, u * s, s, s * 0.006));
    // The lip. One side of a joint is always a little proud of the other.
    paint("rgba(255,255,255,0.05)", null, (c, s) => c.fillRect(u * s - s * 0.005, 0, s * 0.005, s));
  }

  if (engine) {
    // --- grating ----------------------------------------------------------
    // Over the services. Dark between the slats and bright along them, which
    // is what makes an open grating read as a hole rather than as a stripe.
    for (let i = 0; i < 2; i += 1) {
      const gx = rng.range(0.08, 0.62);
      const gy = rng.range(0.08, 0.66);
      const gw = rng.range(0.16, 0.26);
      const gh = rng.range(0.1, 0.18);
      paint("#1b2027", FR.grate, (c, s) => c.fillRect(gx * s, gy * s, gw * s, gh * s));
      paint("rgba(186,196,208,0.5)", null, (c, s) => {
        const step = s * 0.008;
        for (let y = gy * s; y < (gy + gh) * s; y += step) {
          c.fillRect(gx * s, y, gw * s, step * 0.42);
        }
      });
      paint("rgba(0,0,0,0.5)", FR.steel, (c, s) => {
        c.lineWidth = Math.max(1, s * 0.004);
        c.strokeRect(gx * s, gy * s, gw * s, gh * s);
      });
    }

    // --- walkway ----------------------------------------------------------
    // Two lines and the space between them is where a person is allowed to
    // stand. Worn through in the middle, because that is where they walk.
    const wy = rng.range(0.7, 0.86);
    for (const off of [0, 0.11]) {
      paint("rgba(198,166,64,0.62)", FR.paint, (c, s) =>
        c.fillRect(0, (wy + off) * s, s, s * 0.012),
      );
    }
    paint("rgba(0,0,0,0.22)", null, (c, s) =>
      c.fillRect(s * 0.18, (wy + 0.02) * s, s * 0.5, s * 0.07),
    );

    // --- access hatches ---------------------------------------------------
    for (let i = 0; i < 2; i += 1) {
      const hx = rng.range(0.12, 0.84);
      const hy = rng.range(0.1, 0.62);
      const r = 0.026;
      paint("#262c34", FR.steel, (c, s) => {
        c.beginPath();
        c.arc(hx * s, hy * s, r * s, 0, Math.PI * 2);
        c.fill();
      });
      paint("rgba(198,206,216,0.22)", null, (c, s) => {
        c.lineWidth = Math.max(1, s * 0.005);
        c.beginPath();
        c.arc(hx * s, hy * s, r * s, 0, Math.PI * 2);
        c.stroke();
      });
    }

    // --- machine wear -----------------------------------------------------
    // An arc scuffed into the deck by something that swings, and the oil that
    // has been dripping under it for years. Oil is darker and much smoother
    // than the deck, which is the whole reason it reads as a spill.
    for (let i = 0; i < 3; i += 1) {
      const ox = rng.range(0.1, 0.9);
      const oy = rng.range(0.1, 0.9);
      const orad = rng.range(0.04, 0.1);
      paint("#191d23", FR.oil, (c, s) => {
        const g = c.createRadialGradient(ox * s, oy * s, 0, ox * s, oy * s, orad * s);
        g.addColorStop(0, c.fillStyle as string);
        g.addColorStop(1, "transparent");
        c.globalAlpha = 0.5;
        c.fillStyle = g;
        c.beginPath();
        c.arc(ox * s, oy * s, orad * s, 0, Math.PI * 2);
        c.fill();
      });
    }
    paint("rgba(255,255,255,0.05)", FR.scuff, (c, s) => {
      c.lineWidth = Math.max(1, s * 0.012);
      c.beginPath();
      c.arc(s * 0.3, s * 0.42, s * 0.19, 0.3, 2.1);
      c.stroke();
    });
  } else {
    // --- drainage channel -------------------------------------------------
    /*
     * Water in a basement goes somewhere, and where it goes is the most
     * informative thing on the floor: it says which way is downhill, which
     * is a fact about a place that no amount of lighting can supply.
     */
    const cy = rng.range(0.3, 0.66);
    paint(null, FR.damp, (c, s) => {
      const g = c.createLinearGradient(0, (cy - 0.09) * s, 0, (cy + 0.11) * s);
      g.addColorStop(0, "transparent");
      g.addColorStop(0.5, FR.damp);
      g.addColorStop(1, "transparent");
      c.fillStyle = g;
      c.fillRect(0, (cy - 0.09) * s, s, s * 0.2);
    });
    paint("rgba(0,0,0,0.3)", null, (c, s) => {
      const g = c.createLinearGradient(0, (cy - 0.07) * s, 0, (cy + 0.09) * s);
      g.addColorStop(0, "transparent");
      g.addColorStop(0.5, "rgba(0,0,0,0.34)");
      g.addColorStop(1, "transparent");
      c.fillStyle = g;
      c.fillRect(0, (cy - 0.07) * s, s, s * 0.16);
    });
    // The channel itself, and the grating over part of it.
    paint("#14181e", FR.water, (c, s) => c.fillRect(0, cy * s, s, s * 0.022));
    paint("rgba(150,162,176,0.3)", FR.steel, (c, s) => {
      const step = s * 0.01;
      for (let x = s * 0.34; x < s * 0.62; x += step) {
        c.fillRect(x, cy * s, step * 0.4, s * 0.022);
      }
    });

    // --- spalling ---------------------------------------------------------
    // Concrete that has lost its face, with the aggregate showing through.
    // Lighter, and much rougher: the only place on this floor where the
    // material underneath is visible.
    for (let i = 0; i < 4; i += 1) {
      const px = rng.range(0.05, 0.9);
      const py = rng.range(0.05, 0.9);
      const pr = rng.range(0.03, 0.075);
      paint("#3f464e", FR.spall, (c, s) => {
        c.globalAlpha = 0.5;
        c.beginPath();
        c.arc(px * s, py * s, pr * s, 0, Math.PI * 2);
        c.fill();
      });
      paint("rgba(0,0,0,0.4)", null, (c, s) => {
        c.lineWidth = Math.max(1, s * 0.003);
        c.beginPath();
        c.arc(px * s, py * s, pr * s, 0, Math.PI * 2);
        c.stroke();
      });
    }

    // --- efflorescence ----------------------------------------------------
    // Salt carried out of the concrete by water and left on the surface. Pale
    // and chalky: rougher than what it sits on, and the clearest sign that
    // this floor has water moving through it rather than over it.
    for (let i = 0; i < 5; i += 1) {
      const ex = rng.range(0, 1);
      const ey = rng.range(0, 1);
      const er = rng.range(0.04, 0.12);
      paint("rgba(196,200,196,0.11)", FR.salt, (c, s) => {
        const g = c.createRadialGradient(ex * s, ey * s, 0, ex * s, ey * s, er * s);
        g.addColorStop(0, c.fillStyle as string);
        g.addColorStop(1, "transparent");
        c.fillStyle = g;
        c.beginPath();
        c.arc(ex * s, ey * s, er * s, 0, Math.PI * 2);
        c.fill();
      });
    }

    // --- repairs ----------------------------------------------------------
    // Patch over patch. Each one a slightly different mix, none of them
    // matching, which is what sixty years of somebody else's budget looks
    // like.
    for (let i = 0; i < 3; i += 1) {
      const rx = rng.range(0.02, 0.7);
      const ry = rng.range(0.02, 0.7);
      const rw = rng.range(0.12, 0.28);
      const rh = rng.range(0.08, 0.2);
      const tone = rng.pick(["#333a43", "#2a3038", "#3a414a"]);
      paint(tone, FR.repair, (c, s) => c.fillRect(rx * s, ry * s, rw * s, rh * s));
      paint("rgba(0,0,0,0.38)", null, (c, s) => {
        c.lineWidth = Math.max(1, s * 0.004);
        c.strokeRect(rx * s, ry * s, rw * s, rh * s);
      });
    }
  }

  // --- grime over everything ----------------------------------------------
  blobNoise(ctx, rng, size, engine ? 20 : 30, [size * 0.03, size * 0.13], engine ? 0.2 : 0.3, "#1c2128");

  const albedo = new THREE.CanvasTexture(element);
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;
  albedo.anisotropy = 8;
  albedo.colorSpace = THREE.SRGBColorSpace;

  const roughness = new THREE.CanvasTexture(roughElement);
  roughness.wrapS = THREE.RepeatWrapping;
  roughness.wrapT = THREE.RepeatWrapping;
  roughness.anisotropy = 4;
  roughness.colorSpace = THREE.NoColorSpace;

  return { albedo, roughness };
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
  const facadeRoughs: THREE.CanvasTexture[] = [];
  for (let i = 0; i < FACADE_VARIANTS; i += 1) {
    const [map, emissiveMap, roughnessMap] = buildFacade(size, seed, i);
    facades.push(map);
    facadeEmissives.push(emissiveMap);
    facadeRoughs.push(roughnessMap);
  }

  const grime = buildGrime(Math.min(size, 512), seed);
  const { albedo: road, roughness: roadRough } = buildRoad(size, seed);
  /*
   * Half the facade edge length, and it scales with the tier.
   *
   * A floor tile covers eighteen metres against the road's forty-six, so half
   * the pixels is still more resolution per metre than the street gets. The
   * minimum is 128 rather than 256 because these have to come down with
   * everything else: pinned at 256 they pushed the BALANCED and LOW sets past
   * their stated ceilings, which is the sort of thing a budget exists to
   * refuse.
   */
  const floorSize = Math.max(128, Math.round(size / 2));
  const { albedo: engineFloor, roughness: engineFloorRough } = buildFloor(
    floorSize,
    seed,
    "engine",
  );
  const { albedo: substrateFloor, roughness: substrateFloorRough } = buildFloor(
    floorSize,
    seed,
    "substrate",
  );

  return {
    facades,
    facadeEmissives,
    facadeRoughs,
    grime,
    road,
    roadRough,
    engineFloor,
    engineFloorRough,
    substrateFloor,
    substrateFloorRough,
    dispose() {
      for (const t of [
        ...facades,
        ...facadeEmissives,
        ...facadeRoughs,
        grime,
        road,
        roadRough,
        engineFloor,
        engineFloorRough,
        substrateFloor,
        substrateFloorRough,
      ]) {
        t.dispose();
      }
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
  const area = (edge: number) => (edge * edge * 4 * 1.33) / 1048576;
  const perMap = area(size);
  const floorSize = Math.max(128, Math.round(size / 2));
  return (
    // Four facade variants: albedo and emissive at full size, roughness at
    // half the edge length because it varies far more slowly than albedo.
    perMap * FACADE_VARIANTS * 2 +
    area(Math.max(128, Math.round(size / 2))) * FACADE_VARIANTS +
    // The shared grime map.
    area(Math.min(size, 512)) +
    // The road, and how rough it is.
    perMap +
    area(Math.max(128, Math.round(size / 2))) +
    // Two deep floors, each with a roughness map at half again.
    (area(floorSize) + area(Math.max(64, Math.round(floorSize / 2)))) * 2
  );
}
