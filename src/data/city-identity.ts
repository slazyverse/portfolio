import type { StratumId } from "./types";

/* ---------------------------------------------------------------------------
 * Who owns this city, and who lives in it.
 *
 * The brief asks the environment to communicate corporate dominance, extreme
 * inequality, aggressive consumerism and high-tech-over-low-life — without a
 * word of explanation inside the scene. That means those things have to be
 * properties of the generator, not notes in a document: a building has an
 * owner, a district, a maintenance standard and a class of signage, and every
 * visual difference falls out of those.
 *
 * ORIGINAL, AND DELIBERATELY SO. The corporations below are invented for
 * SUBSTRATE. They are not real companies, and they are not the corporations of
 * any published game. Their names are built from the vocabulary this project
 * already uses — allocation, substrate, holdings, interchange — so the world
 * reads as an extension of the portfolio rather than as a pastiche of someone
 * else's setting.
 * ------------------------------------------------------------------------- */

/**
 * A district is a social fact before it is a visual one.
 *
 * Each carries a maintenance standard, a commercial density and a lighting
 * character, and those three produce the inequality the brief asks for without
 * anything in the scene having to say so.
 */
export type DistrictId =
  /** Owned, policed, expensive. Clean surfaces and very large signage. */
  | "corporate"
  /** Saturated with commerce. Dense, cheap, loud, improvised. */
  | "commercial"
  /** Where people actually live. Stacked, patched, laundry-and-cabling. */
  | "residential"
  /** Plant and process. Functional, dirty, exposed. */
  | "industrial"
  /** Beneath the city's own floor. Dark, wet, maintained only when it fails. */
  | "undercity";

export interface DistrictProfile {
  id: DistrictId;
  /** How well kept the fabric is. 0 is pristine, 1 is falling apart. */
  wear: readonly [number, number];
  /** Probability a building carries commercial signage at all. */
  signage: number;
  /** How much of the facade is lit. Corporate towers burn light all night. */
  litShare: number;
  /** Probability of a storefront band at street level. */
  storefront: number;
  /** Probability of exposed service pipework on a flank. */
  exposedServices: number;
  /** Probability of a skybridge to a neighbour, where one is close enough. */
  bridges: number;
  /** Street furniture density: bollards, boxes, railings, vents. */
  clutter: number;
  /** Which signal family dominates this district's light. */
  signal: "amber" | "cold";
}

/**
 * The five districts.
 *
 * The ordering of `wear` across these is the inequality, stated once. Nothing
 * else in the generator has to know about class — it only has to know which
 * district a building stands in.
 */
export const DISTRICTS: Record<DistrictId, DistrictProfile> = {
  corporate: {
    id: "corporate",
    // Kept. Somebody pays for this.
    wear: [0.05, 0.3],
    signage: 0.55,
    // Lit all night, because nobody in this district is paying the bill
    // personally. The gap between this and the residential 0.42 one ring out
    // is the economic hierarchy, stated in the one currency a night city has.
    litShare: 0.88,
    storefront: 0.2,
    exposedServices: 0.05,
    bridges: 0.55,
    clutter: 0.25,
    signal: "cold",
  },
  commercial: {
    id: "commercial",
    wear: [0.35, 0.75],
    // Commercial messaging has occupied the public space here.
    signage: 0.92,
    // The signage is lit; the floors above it mostly are not.
    litShare: 0.5,
    storefront: 0.85,
    exposedServices: 0.45,
    bridges: 0.3,
    clutter: 0.9,
    signal: "amber",
  },
  residential: {
    id: "residential",
    wear: [0.5, 0.95],
    signage: 0.42,
    // Lights on where someone is in, and a great many people are out.
    litShare: 0.42,
    storefront: 0.35,
    exposedServices: 0.8,
    bridges: 0.22,
    clutter: 0.75,
    signal: "amber",
  },
  industrial: {
    id: "industrial",
    wear: [0.6, 1],
    signage: 0.3,
    /*
     * A plant floor has task lighting, not windows — but not *no* light.
     *
     * At 0.22 this compounded with the engine level's own 0.3 share and the
     * balanced tier's smaller structure count into a level with zero lit
     * buildings, which is not a dark level, it is a missing one. The lowest
     * of the five is still the lowest by a wide margin; it is simply above
     * the floor now.
     */
    litShare: 0.34,
    storefront: 0.05,
    exposedServices: 0.95,
    bridges: 0.35,
    clutter: 0.6,
    signal: "amber",
  },
  undercity: {
    id: "undercity",
    // Maintained when it fails, and not before.
    wear: [0.7, 1],
    signage: 0.28,
    litShare: 0.78,
    storefront: 0.1,
    exposedServices: 0.9,
    bridges: 0.15,
    clutter: 0.85,
    signal: "cold",
  },
};

/**
 * Which districts a level is made of.
 *
 * `core` is what stands near the central shaft — the expensive, controlled
 * ground — and `edge` is everything further out. That single split is what
 * puts a premium tower and a patched residential stack in the same frame,
 * which is the high-tech-over-low-life contrast the brief is asking for.
 */
export const LEVEL_DISTRICTS: Record<StratumId, { core: DistrictId; edge: DistrictId }> = {
  // Street level: corporate towers around the core, commerce everywhere else.
  surface: { core: "corporate", edge: "commercial" },
  // The network layer is almost entirely owned.
  interface: { core: "corporate", edge: "residential" },
  // Plant and process, with company offices attached to it.
  engine: { core: "industrial", edge: "industrial" },
  // Beneath the floor. Nobody's frontage.
  substrate: { core: "undercity", edge: "undercity" },
};

/* -------------------------------------------------------- corporations --- */

/**
 * A corporation is a visual identity, not a story.
 *
 * Phase 5B needs exactly enough for the world to feel owned: a name, a mark
 * that can be drawn as a shape rather than as text, and a signal. The lore
 * stays unbuilt on purpose — an environment that needs a paragraph to be
 * understood has failed at the thing environments are for.
 *
 * `mark` is a geometric identity, not a glyph: signage in this city is drawn
 * as shapes, so the mark is a shape family. No text is ever rendered in the
 * scene, which is both an accessibility rule and the reason these can never be
 * mistaken for a real brand.
 */
export interface Corporation {
  id: string;
  /** Used in documentation and diagnostics, never rendered in the world. */
  name: string;
  /** Shape family for signage: bars, a chevron, a ring, a grid, a wedge. */
  mark: "bars" | "chevron" | "ring" | "grid" | "wedge";
  signal: "amber" | "cold";
  /** How aggressively this corporation signs its buildings. */
  presence: number;
}

export const CORPORATIONS: readonly Corporation[] = [
  {
    id: "allocation",
    name: "Allocation Holdings",
    mark: "bars",
    signal: "cold",
    presence: 0.95,
  },
  {
    id: "meridian",
    name: "Meridian Interchange",
    mark: "chevron",
    signal: "amber",
    presence: 0.8,
  },
  {
    id: "corrigan",
    name: "Corrigan Power & Cooling",
    mark: "ring",
    signal: "amber",
    presence: 0.65,
  },
  {
    id: "vantage",
    name: "Vantage Substrate Group",
    mark: "grid",
    signal: "cold",
    presence: 0.9,
  },
  {
    id: "keelson",
    name: "Keelson Residential Trust",
    mark: "wedge",
    signal: "amber",
    presence: 0.45,
  },
] as const;

/**
 * Signage hierarchy.
 *
 * Four scales, each with a spatial reason to exist. Scattering neon at random
 * is the difference between a city that has been advertised at and a city that
 * has had lights put on it.
 */
export type SignTier =
  /** City-scale: readable from the far side of the district. Corporate only. */
  | "skyline"
  /** A building's own frontage band. */
  | "district"
  /** Shopfronts and transit at street level. */
  | "local"
  /** Maintenance labels, utility markings, hazard plates. */
  | "micro";

export const SIGN_TIERS: Record<
  SignTier,
  { minHost: number; heightShare: readonly [number, number]; emissive: readonly [number, number] }
> = {
  // Only something very large can carry one, which is itself the message.
  skyline: { minHost: 90, heightShare: [0.1, 0.2], emissive: [0.85, 1] },
  district: { minHost: 28, heightShare: [0.08, 0.16], emissive: [0.6, 0.95] },
  local: { minHost: 10, heightShare: [0.02, 0.05], emissive: [0.5, 0.9] },
  micro: { minHost: 4, heightShare: [0.004, 0.012], emissive: [0.25, 0.5] },
};
