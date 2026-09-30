import { describe, expect, it } from "vitest";
import { LEVEL_ORDER } from "@/data/routes";
import { generateCity } from "@/lib/environment/generate";
import {
  FACADE_ROUGHNESS,
  FLOOR_ALBEDO,
  FLOOR_ROUGHNESS,
  FLOOR_ROUGHNESS_SCALAR,
  SPECULAR_FLOOR,
  WET_ORDER,
  WET_RESPONSE,
  effectiveFacadeRoughness,
  floorFor,
  luminance,
} from "@/lib/environment/materials";
import { ENVIRONMENT_BUDGET } from "@/lib/environment/quality";
import {
  DRIP_LENGTH,
  DRIP_SPEED,
  MIN_FALL,
  SHELTER_KEEP,
  lowestCover,
  rainfall,
  shelters,
} from "@/lib/environment/weather";

/**
 * Material and atmosphere.
 *
 * Phase 12 is about whether the world behaves like a place, which is mostly a
 * question of whether surfaces and weather know anything about each other.
 * Three of the four things it changed were invisible until they were wrong:
 *
 *  - rain fell through every viaduct, canopy and skybridge in the city as
 *    though none of them were there. The shelter was modelled, drawn in front
 *    of the reader, and ignored by the water.
 *  - the two deep levels shared one generic grime map, tinted, so "deeper"
 *    was carried entirely by the light rig.
 *  - the facades used that same grime map as a roughness map — a texture with
 *    no relationship to them, tiled at a different rate — so a pane of glass
 *    and the precast panel beside it returned the same reflection.
 *
 * None of those is visible in a diff and all three are one value in a
 * material, which is exactly the class of thing that belongs in a test.
 */

/** A level with a viaduct across it, built by hand so the rule is isolated. */
function levelWithCover() {
  const city = generateCity("high");
  const band = city.levels.find((l) => l.level === "surface")!;
  return { city, band };
}

describe("rain knows what is above it", () => {
  const { band } = levelWithCover();
  const CLOUD = band.floor + 260;
  const drops = rainfall(band, 900, 160, CLOUD);

  it("finds the things that span and ignores the things that do not", () => {
    // The same rule the contact shadows use: long and narrow covers, broad
    // does not. A roof over the room you are standing in is not shelter — it
    // is the room, and treating it as shelter once emptied a whole level.
    const covers = shelters(band);
    expect(covers.length).toBeGreaterThan(0);
    for (const c of covers) {
      expect(c.soffit).toBeGreaterThan(band.floor);
      expect(Math.max(c.hx, c.hz)).toBeGreaterThan(0);
      expect(Number.isFinite(c.x) && Number.isFinite(c.z)).toBe(true);
    }
  });

  it("starts a sheltered drop at the soffit and not at the cloud", () => {
    // The defect this phase exists to fix, stated as an assertion.
    const covers = shelters(band);
    let sheltered = 0;
    for (const d of drops) {
      const roof = lowestCover(covers, d.x, d.z);
      if (roof === null) {
        expect(d.top, "an open drop should fall from the sky").toBe(CLOUD);
        expect(d.drip).toBe(false);
        continue;
      }
      sheltered += 1;
      expect(d.top, "a sheltered drop should fall from what is above it").toBe(roof);
      expect(d.drip).toBe(true);
      expect(d.top).toBeLessThan(CLOUD);
    }
    expect(sheltered, "no drop landed under any cover").toBeGreaterThan(0);
  });

  it("leaves a dry patch rather than a wet one", () => {
    /*
     * The observation is the dry ground, not the drip. Most of the drops
     * under a span are simply not drawn, which is also what makes the shelter
     * legible from outside it: the edge of the dry patch is where the rain
     * starts again.
     */
    const covers = shelters(band);
    const under = [];
    for (let i = 0; i < 900; i += 1) {
      const a = (i * 2.399963) % (Math.PI * 2);
      const r = 160 * Math.sqrt((i * 0.6180339887) % 1);
      if (lowestCover(covers, Math.cos(a) * r, Math.sin(a) * r) !== null) under.push(i);
    }
    expect(under.length).toBeGreaterThan(0);
    const kept = drops.filter((d) => d.drip).length;
    // One in `SHELTER_KEEP`, give or take the drops whose remaining fall was
    // too short to be worth drawing.
    expect(kept).toBeLessThanOrEqual(Math.ceil(under.length / SHELTER_KEEP));
  });

  it("makes a drip behave like a drip and not like rain", () => {
    // It has a fraction of the height to fall, so it is slower, and a streak
    // is a function of speed, so it is shorter.
    const rain = drops.filter((d) => !d.drip);
    const drip = drops.filter((d) => d.drip);
    if (drip.length === 0) return;
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(drip.map((d) => d.speed))).toBeLessThan(mean(rain.map((d) => d.speed)));
    expect(mean(drip.map((d) => d.length))).toBeLessThan(mean(rain.map((d) => d.length)));
    expect(DRIP_SPEED).toBeLessThan(1);
    expect(DRIP_LENGTH).toBeLessThan(1);
  });

  it("never draws a drop with nowhere to fall", () => {
    // A drop whose remaining height is a metre is a dot that flickers.
    for (const d of drops) {
      expect(d.fall).toBeGreaterThanOrEqual(MIN_FALL);
      expect(d.top - d.fall).toBeCloseTo(band.floor, 6);
    }
  });

  it("falls the same way every time", () => {
    const key = () =>
      rainfall(band, 400, 160, CLOUD)
        .map((d) => `${d.x.toFixed(3)},${d.z.toFixed(3)},${d.top.toFixed(3)},${d.drip}`)
        .join(";");
    expect(key()).toBe(key());
  });

  it("gives some of the rain the colour of what is lighting it", () => {
    // Rain in front of a sodium lamp is orange rain. Not all of it: most of
    // the shaft is nowhere near a lamp, and rain that is uniformly tinted is
    // a colour wash rather than a light.
    const lit = drops.filter((d) => d.source !== null);
    expect(lit.length, "nothing is lighting any of the rain").toBeGreaterThan(0);
    // Measured: at a forty-metre reach this was 85 percent, which is a colour
    // wash rather than a light. Half is the line.
    expect(lit.length / drops.length, "the whole storm is tinted").toBeLessThan(0.5);
    for (const d of lit) expect(d.source).not.toBe("subject");
  });

  it("scales with the tier rather than ignoring it", () => {
    const high = rainfall(band, ENVIRONMENT_BUDGET.high.rain, 160, CLOUD).length;
    const balanced = rainfall(band, ENVIRONMENT_BUDGET.balanced.rain, 160, CLOUD).length;
    expect(balanced).toBeLessThan(high);
    expect(ENVIRONMENT_BUDGET.low.rain).toBe(0);
  });
});

describe("water does not make everything shiny", () => {
  it("orders the five materials the way water actually orders them", () => {
    /*
     * Water fills the pores of whatever it lands on, so how much difference
     * it makes depends on how porous the surface was. Glass barely changes;
     * concrete soaks it up and mostly just goes darker. If this ordering ever
     * inverts, a wet street stops reading as a street.
     */
    for (let i = 1; i < WET_ORDER.length; i += 1) {
      const prev = WET_RESPONSE[WET_ORDER[i - 1]!]!;
      const here = WET_RESPONSE[WET_ORDER[i]!]!;
      expect(
        here.roughness,
        `${WET_ORDER[i]} is smoother than ${WET_ORDER[i - 1]}`,
      ).toBeGreaterThan(prev.roughness);
    }
  });

  it("keeps metalness on its own axis", () => {
    // Steel is a conductor and concrete is not, and no amount of water
    // changes that. Metalness is a fact about the material, not about the
    // weather.
    expect(WET_RESPONSE.steel.metalness).toBeGreaterThan(WET_RESPONSE.painted.metalness);
    expect(WET_RESPONSE.painted.metalness).toBeGreaterThan(WET_RESPONSE.concrete.metalness);
    expect(WET_RESPONSE.glass.metalness).toBeLessThan(0.2);
  });

  it("never makes anything a mirror", () => {
    for (const [name, r] of Object.entries(WET_RESPONSE)) {
      expect(r.roughness, `${name}`).toBeGreaterThan(0.15);
      expect(r.roughness, `${name}`).toBeLessThanOrEqual(1);
    }
  });
});

describe("a floor says where you are", () => {
  it("gives each level the surface it actually has", () => {
    expect(LEVEL_ORDER.map(floorFor)).toEqual(["road", "engine", "engine", "substrate"]);
  });

  it("makes deeper darker", () => {
    // Lost for six phases: the two deep levels shared one map tinted by a
    // single near-black token, so depth was carried entirely by the lighting
    // and the floors themselves said nothing.
    expect(luminance(FLOOR_ALBEDO.substrate)).toBeLessThan(luminance(FLOOR_ALBEDO.engine));
    expect(luminance(FLOOR_ALBEDO.road)).toBeLessThan(luminance(FLOOR_ALBEDO.engine));
  });

  it("keeps every floor value clear of the blow-out", () => {
    // The same floor the road has, for the same reason. A slab with a mirror
    // finish under a low directional light is one enormous specular lobe.
    for (const [name, grey] of Object.entries(FLOOR_ROUGHNESS)) {
      const r = (Number.parseInt(grey.slice(1, 3), 16) / 255) * FLOOR_ROUGHNESS_SCALAR;
      expect(r, `${name} is ${r.toFixed(3)}`).toBeGreaterThan(SPECULAR_FLOOR);
      expect(r, `${name}`).toBeLessThanOrEqual(1);
    }
  });

  it("puts a highlight only where water and oil are", () => {
    // Which is the whole content of the table: those two are the smoothest
    // things down there, and spalled concrete and efflorescence the roughest,
    // because both are a surface that has lost its face.
    const v = (g: string) => Number.parseInt(g.slice(1, 3), 16);
    expect(v(FLOOR_ROUGHNESS.oil)).toBeLessThan(v(FLOOR_ROUGHNESS.deck));
    expect(v(FLOOR_ROUGHNESS.water)).toBeLessThan(v(FLOOR_ROUGHNESS.oldConcrete));
    expect(v(FLOOR_ROUGHNESS.spall)).toBeGreaterThan(v(FLOOR_ROUGHNESS.oldConcrete));
    expect(v(FLOOR_ROUGHNESS.salt)).toBeGreaterThan(v(FLOOR_ROUGHNESS.oldConcrete));
  });
});

describe("a window is not the wall it is set into", () => {
  it("makes glass the only smooth thing on an elevation", () => {
    // Almost every highlight in a night city is a window. Before this the
    // facades took the shared grime map — a map of nothing in particular,
    // tiled at its own rate — so glass and precast returned the same
    // reflection.
    const glass = effectiveFacadeRoughness(FACADE_ROUGHNESS.glass);
    for (const [name, grey] of Object.entries(FACADE_ROUGHNESS)) {
      if (name === "glass") continue;
      expect(
        effectiveFacadeRoughness(grey),
        `${name} is as smooth as glass`,
      ).toBeGreaterThan(glass);
    }
  });

  it("orders the elevation from glass to plant", () => {
    const r = (k: keyof typeof FACADE_ROUGHNESS) =>
      effectiveFacadeRoughness(FACADE_ROUGHNESS[k]);
    expect(r("glass")).toBeLessThan(r("metal"));
    expect(r("metal")).toBeLessThan(r("painted"));
    expect(r("painted")).toBeLessThan(r("concrete"));
    expect(r("concrete")).toBeLessThan(r("louvre"));
  });

  it("makes dirt rough and washed stone less so", () => {
    // The windows of a building nobody washes stop being windows, which is
    // most of what separates a maintained frontage from a neglected one.
    expect(effectiveFacadeRoughness(FACADE_ROUGHNESS.grime)).toBeGreaterThan(
      effectiveFacadeRoughness(FACADE_ROUGHNESS.concrete),
    );
    expect(effectiveFacadeRoughness(FACADE_ROUGHNESS.clean)).toBeLessThan(
      effectiveFacadeRoughness(FACADE_ROUGHNESS.concrete),
    );
  });
});
