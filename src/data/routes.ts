import type { RouteId, RouteMeta, StratumId } from "./types";

/**
 * The canonical route table. One source of truth.
 *
 * Every consumer reads from here: navigation, `document.title`, metadata,
 * route announcements, the level rail, and — later — whatever object in a
 * generated environment stands for a given place. Duplicating a route
 * definition anywhere else is how those drift apart, so nothing else may
 * declare one.
 *
 * `id` is the stable join key. Paths can be restyled; ids must not churn,
 * because other systems will be keyed off them.
 *
 * Dual register is a permanent design rule. `display` carries the in-world
 * name and `conventional` carries what everyone else calls the thing. The
 * accessible name, the document title and the meta description are all built
 * from `conventional`, so a reader never has to decode the theme to find the
 * projects. The theme is atmosphere; it is never a lock on the content.
 */
export const ROUTES: readonly RouteMeta[] = [
  {
    id: "signal",
    path: "/",
    level: "surface",
    display: "SIGNAL",
    conventional: "home",
    title: "Sagar Tailor — Backend & systems engineer",
    description:
      "Backend and systems engineer. Go concurrency, async Python, and the platform layers other work runs on.",
    nav: true,
    index: true,
    available: true,
  },
  {
    id: "dossier",
    path: "/dossier",
    level: "interface",
    display: "DOSSIER",
    conventional: "profile",
    title: "Profile",
    description:
      "Who Sagar Tailor is, how he works, and the four habits each piece of committed code earned.",
    nav: true,
    index: true,
    available: true,
  },
  {
    id: "systems",
    path: "/systems",
    level: "interface",
    display: "SYSTEMS",
    conventional: "skills & stack",
    title: "Systems",
    description:
      "Technical capabilities, split honestly: what has shipped to production, and what is working knowledge.",
    nav: true,
    index: true,
    available: true,
  },
  {
    id: "contracts",
    path: "/contracts",
    level: "engine",
    display: "CONTRACTS",
    conventional: "projects",
    title: "Projects",
    description:
      "Engineering projects in depth — the problem, the decisions, the evidence, and an honest account of who built what.",
    nav: true,
    index: true,
    available: true,
  },
  {
    // The dynamic route. `path` is the collection it lives under; individual
    // contracts resolve through `contractPath()` below.
    id: "contract",
    path: "/contracts",
    level: "engine",
    display: "CONTRACT",
    conventional: "project",
    title: "Project",
    description: "An engineering project in depth.",
    nav: false,
    index: true,
    available: true,
  },
  {
    id: "record",
    path: "/record",
    level: "substrate",
    display: "RECORD",
    conventional: "engineering record",
    title: "Engineering record",
    description:
      "Tests, continuous integration, containers and deployment — measured per project, not asserted.",
    nav: true,
    index: true,
    available: true,
  },
  {
    id: "colophon",
    path: "/colophon",
    level: "substrate",
    display: "COLOPHON",
    conventional: "how this site is built",
    title: "Colophon",
    description:
      "How this site is engineered: architecture, performance budget, accessibility, testing, and what was deliberately not used.",
    nav: true,
    index: true,
    available: true,
  },
  {
    id: "verify",
    path: "/verify",
    level: "substrate",
    display: "VERIFY",
    conventional: "evidence index",
    title: "Evidence index",
    description:
      "Every claim this site makes about the work, and the file or commit that proves it.",
    nav: true,
    index: true,
    available: true,
  },
  {
    id: "contact",
    path: "/contact",
    level: "substrate",
    display: "COMMS",
    conventional: "contact",
    title: "Contact",
    description: "How to reach Sagar Tailor, and the professional links worth checking first.",
    nav: true,
    index: true,
    available: true,
  },
  {
    // Not available, and deliberately marked so rather than quietly omitted.
    //
    // There is no CV file in this repository. Linking to one that does not
    // exist would be both a broken link and, on a site whose entire premise is
    // that every statement is checkable, exactly the wrong kind of lie.
    // `available: false` keeps it out of navigation and out of the sitemap
    // until a real document exists.
    id: "cv",
    path: "/cv.pdf",
    level: "substrate",
    display: "DOSSIER EXPORT",
    conventional: "CV",
    title: "CV",
    description:
      "Downloadable résumé. No document exists yet, so this route is reserved and marked unavailable rather than linked.",
    nav: false,
    index: false,
    available: false,
  },
  {
    // The design-system laboratory. Internal: reviewed, not read.
    id: "system-reference",
    path: "/system",
    level: "substrate",
    display: "SYSTEM REFERENCE",
    conventional: "design system",
    title: "System reference",
    description: "Internal design-system reference.",
    nav: false,
    index: false,
    available: true,
  },
] as const;

const BY_ID = new Map<RouteId, RouteMeta>(ROUTES.map((r) => [r.id, r]));

export function route(id: RouteId): RouteMeta {
  const r = BY_ID.get(id);
  // Throwing rather than returning undefined: an unknown route id is a
  // programming error, and it should fail at the call site during the build
  // rather than render a page with no title.
  if (!r) throw new Error(`Unknown route id: ${id}`);
  return r;
}

/** Routes that appear in primary navigation, in descent order. */
export const NAV_ROUTES: readonly RouteMeta[] = ROUTES.filter(
  (r) => r.nav && r.available,
);

/** Routes eligible for the sitemap. */
export const INDEXABLE_ROUTES: readonly RouteMeta[] = ROUTES.filter(
  (r) => r.index && r.available && r.id !== "contract",
);

/** Canonical path for a single contract. */
export function contractPath(slug: string): string {
  return `/contracts/${slug}`;
}

/** The four levels, shallow to deep. Ordering is meaningful. */
export const LEVEL_ORDER: readonly StratumId[] = [
  "surface",
  "interface",
  "engine",
  "substrate",
];

/** Depth marker for a level: "00".."03". */
export function levelIndex(level: StratumId): string {
  return String(LEVEL_ORDER.indexOf(level)).padStart(2, "0");
}

/** Human name for a level, for readouts and labels. */
export const LEVEL_NAME: Record<StratumId, string> = {
  surface: "Surface",
  interface: "Interface",
  engine: "Engine",
  substrate: "Substrate",
};

/**
 * The route a level takes you to.
 *
 * Derived from the route table rather than hard-coded, so adding a route at a
 * level cannot leave the rail pointing somewhere stale. The first navigable
 * route at a level is its entry point.
 */
export function routeForLevel(level: StratumId): RouteMeta {
  const match = NAV_ROUTES.find((r) => r.level === level);
  if (!match) {
    throw new Error(`No navigable route exists at level: ${level}`);
  }
  return match;
}

/**
 * Resolves a pathname to its route record.
 *
 * Contract pages resolve to the dynamic `contract` route, because that is what
 * they are — the chrome gets the level from the contract itself.
 */
export function routeForPath(pathname: string): RouteMeta | undefined {
  if (pathname.startsWith("/contracts/")) {
    return ROUTES.find((r) => r.id === "contract");
  }
  return ROUTES.find((r) => r.path === pathname);
}
