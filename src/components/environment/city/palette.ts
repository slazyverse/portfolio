import type { StratumId } from "@/data/types";
import type { LightSource } from "@/lib/environment/types";

/**
 * The city's colours, read from the design system rather than chosen here.
 *
 * Every value comes out of the Phase 2 stylesheet at runtime. That is not
 * tidiness — it is what keeps the world and the interface the same product. If
 * the accent token changes, the windows change with it, and nothing has to
 * remember that a city exists.
 *
 * The two signals are load-bearing and non-negotiable:
 *
 *   AMBER  the subject — a person is here, or their work is
 *   COLD   the machine — infrastructure, telemetry, data
 *
 * The city gets no exemption from that. A pipe run glowing amber would read as
 * "someone is here", which is precisely the distinction the palette exists to
 * carry.
 */
export interface Palette {
  /**
   * Concrete reflectance — a physical value, not an interface colour.
   *
   * The interface tokens are near-black because they are backgrounds behind
   * text. Albedo is how much light a surface returns, and concrete returns
   * about a third of it. Using `--color-l3` here rendered every facade as a
   * silhouette regardless of the light on it.
   */
  structure: string;
  /** Bare and galvanised metal: plant, masts, tanks, pipework. */
  metal: string;
  /** Dark recessed glazing. */
  glass: string;
  amber: string;
  cold: string;
  /** The ground plane and the colour everything fades into. */
  ground: string;
  /** Fog at this level. Depth is mostly this one value. */
  fog: string;
  hair: string;
}

function read(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  return styles.getPropertyValue(name).trim() || fallback;
}

/**
 * Per-level atmosphere.
 *
 * Lighting tells the story of the four levels, and the cheapest way to do that
 * is the colour the world dissolves into. Each level's fog is its own ground
 * token, so descending genuinely changes the air — warm and open at the
 * surface, cold and close in the network layer, sooty in the engine floor,
 * near-black in the substrate.
 */
const FOG_BY_LEVEL: Record<StratumId, string> = {
  surface: "#0a1119",
  interface: "#070c14",
  engine: "#0a0a0d",
  substrate: "#04060a",
};

export function readPalette(level: StratumId): Palette {
  const styles = getComputedStyle(document.documentElement);
  return {
    structure: read(styles, "--env-material", "#5d6675"),
    metal: read(styles, "--env-metal", "#6f7988"),
    glass: read(styles, "--env-glass", "#101722"),
    amber: read(styles, "--accent", "#ff9e2c"),
    cold: read(styles, "--cold", "#7fb4cf"),
    ground: read(styles, "--deep", "#05070a"),
    fog: FOG_BY_LEVEL[level],
    hair: read(styles, "--hair-strong", "#222d3d"),
  };
}

/* ------------------------------------------------------------ fixtures --- */

/**
 * What each kind of lamp actually emits.
 *
 * Two of these are design tokens because they carry meaning the interface also
 * carries — the subject and the machine. The other four are not tokens and
 * should not become them: they are lamps, and a lamp's colour is a property of
 * what is burning in it rather than a brand decision. Putting sodium orange in
 * the stylesheet would invite somebody to reuse it as a UI colour, which is
 * exactly the confusion the signal rule exists to prevent.
 *
 * The distances between them are the point. `interior` is a warm *white*, not
 * an amber — that is what keeps `--accent` legible as the subject when both
 * are in frame, and it is why the previous palette read as monochrome: with
 * only saturated amber available, every warm thing in the city was the same
 * colour as the person the city is about.
 */
export function lightSourceColour(source: LightSource, palette: Palette): string {
  switch (source) {
    // Occupied floors and frontage: 3000 K, and most of the city's warmth.
    case "interior":
      return "#ffd9b2";
    // Old high-pressure sodium. Deliberately redder than `--accent` and used
    // sparsely, so it reads as a dated fixture rather than as a signal.
    case "sodium":
      return "#ff7a3c";
    case "warning":
      return "#ff3b30";
    // Always small. A green dot means a thing is powered and fine, which is
    // information the eye should be able to find and then stop looking at.
    case "utility":
      return "#46d17f";
    case "subject":
      return palette.amber;
    case "machine":
    default:
      return palette.cold;
  }
}

/**
 * The light rig for a level.
 *
 * Motivated, not arbitrary. Each level is lit by something that would actually
 * be there: city glow bouncing off cloud at the surface, cold machine light in
 * the network layer, furnace light from below on the engine floor, and almost
 * nothing at all in the substrate, where the only sources are the racks.
 */
export interface LightRig {
  /** Sky/ambient fill. */
  ambient: { colour: string; intensity: number };
  /** The key light, and where it comes from. */
  key: { colour: string; intensity: number; position: readonly [number, number, number] };
  /** A cool rim from the opposite side, to separate silhouettes from the fog. */
  rim: { colour: string; intensity: number; position: readonly [number, number, number] };
  /** How far the fog reaches. Near, far. */
  fog: readonly [number, number];
}

export function lightRig(level: StratumId, palette: Palette): LightRig {
  /*
   * Why these colours are bright and these intensities are not small.
   *
   * Two mistakes were made here in sequence, and both are worth recording
   * because they look like the opposite of what they are.
   *
   * First, this rig used mood colours — dark browns and navies — as the light
   * colours themselves. A light whose colour is `#2a221c` emits almost
   * nothing, so the scene rendered black at any intensity. A light's colour is
   * its *hue*; its intensity is how much of it there is.
   *
   * Then, with the hues fixed, the intensities were still set by eye at around
   * 0.5 to 0.85 — and the city was *still* black. The arithmetic says why.
   * Three's Lambert term is `albedo × irradiance / π`, and concrete's albedo is
   * about 0.11 in linear space, so an irradiance of 0.4 returns roughly 0.014 —
   * which is #21 in sRGB, indistinguishable from the fog behind it.
   *
   * Reading a night city on screen wants an outgoing radiance nearer 0.02–0.06
   * linear, so the irradiance has to land around 1.1 to 1.5. These values are
   * derived from that, not guessed, and the scene is still unmistakably night:
   * the darkness comes from a dim, cold, motivated rig and from fog, which is
   * where night actually comes from.
   */
  switch (level) {
    case "surface":
      // Overcast night. The sky is the brightest thing in frame, lit from
      // beneath by the city's own glow, and that bounce is most of what makes
      // a rainy street read as rainy.
      return {
        ambient: { colour: "#5c7f9e", intensity: 2.6 },
        key: { colour: "#cfe2f2", intensity: 3.1, position: [180, 320, 120] },
        // Amber, but restrained. At 1.5 this washed whole facades warm and the
        // concrete came out brown — the rim is meant to separate a silhouette
        // from the fog, not to recolour the building.
        rim: { colour: palette.amber, intensity: 0.7, position: [-220, 90, -180] },
        fog: [45, 430],
      };
    case "interface":
      // Above the cloud deck: colder, cleaner, and further to the horizon.
      return {
        ambient: { colour: "#5d86a6", intensity: 2.3 },
        key: { colour: "#d8ecf8", intensity: 3.3, position: [-160, 300, 200] },
        rim: { colour: "#9fd0e8", intensity: 1.3, position: [240, 120, -160] },
        fog: [60, 520],
      };
    case "engine":
      // Lit from below by whatever is burning down there. The key sits under
      // the floor plates, which is why this level reads as heavy — everything
      // is underlit, and underlighting is what makes mass feel like mass.
      return {
        /*
         * Warm, but barely, and weak.
         *
         * Corrected twice. The first pass ran a strongly saturated amber key
         * and every concrete surface came out terracotta. The second toned
         * the hue down but left the intensity at 1.9, and with a roughness
         * map on the kit the whole level went sepia — the same mistake one
         * step quieter, the light doing the palette's job for it.
         *
         * The furnace is underneath and it is what motivates the warmth; the
         * machine above it is separated by a cold rim carrying most of the
         * energy in the rig.
         */
        ambient: { colour: "#6d6d74", intensity: 1.7 },
        key: { colour: "#ffd6bc", intensity: 1.55, position: [60, -40, 90] },
        rim: { colour: "#a6cce4", intensity: 2.6, position: [-180, 220, -120] },
        fog: [30, 330],
      };
    case "substrate":
    default:
      // Bedrock. The racks light themselves and everything between them is
      // dark — the one level where brightness would be the mistake.
      return {
        // Still the darkest level by a wide margin, but enough to read the
        // racks as forms. Below this the hall was a black band with a few
        // indicator dots in it, which is not "dark" so much as "absent".
        ambient: { colour: "#4e7183", intensity: 1.5 },
        key: { colour: "#a9cfe2", intensity: 1.75, position: [40, 120, 60] },
        rim: { colour: "#6f9fb8", intensity: 0.9, position: [-120, 40, -80] },
        fog: [12, 120],
      };
  }
}
