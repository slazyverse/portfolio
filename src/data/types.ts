/**
 * Content model for the portfolio.
 *
 * Design rule carried from Phase 1: every assertion the site makes about
 * Sagar's work is a `Claim`, and every `Claim` carries a `Source` pointing at
 * the file or commit that proves it. There is deliberately no way to express a
 * claim without its evidence — the type system enforces the honesty mechanic.
 */

/** The four strata. Descent order is the array order in `STRATA`. */
export type StratumId = "surface" | "interface" | "engine" | "substrate";

export interface Stratum {
  id: StratumId;
  /** Two-digit depth marker, e.g. "00". */
  index: string;
  name: string;
  description: string;
}

/** A link to the exact evidence backing an adjacent statement. */
export interface Source {
  /** Display path, e.g. "engine/banker.go". */
  path: string;
  /** Optional line range, e.g. "L14–L30". */
  lines?: string;
  href: string;
}

export interface Claim {
  statement: string;
  source: Source;
}

export interface CodeLine {
  n: number;
  code: string;
  /** Lines under discussion get the signal treatment. */
  highlight?: boolean;
}

export interface CodeExcerpt {
  file: string;
  range: string;
  href: string;
  language: string;
  lines: CodeLine[];
}

export interface Metric {
  value: string;
  label: string;
  /** Optional provenance for the figure. */
  note?: string;
}

export type ProjectState = "live" | "archived" | "in-progress";

export interface ProjectMeta {
  label: string;
  value: string;
}

export interface Project {
  slug: string;
  name: string;
  /** One line, no marketing. */
  tagline: string;
  state: ProjectState;
  /** Honest one-word ownership signal shown next to the title. */
  ownership: string;
  liveUrl?: string;
  repoUrl: string;
  meta: ProjectMeta[];
  summary: string[];
  claims: Claim[];
  metrics: Metric[];
  excerpt?: CodeExcerpt;
}

export interface Principle {
  index: string;
  title: string;
  body: string;
  source: Source;
}

/** Two honest tiers — shipped in production vs. working knowledge. */
export interface StackGroup {
  tier: "shipped" | "working";
  heading: string;
  note: string;
  items: { name: string; where: string }[];
}

export interface RecordRow {
  project: string;
  tests: string;
  ci: string;
  container: string;
  deploy: string;
}

/** One layer of the VAYU-DRISHTI attribution cross-section. */
export interface AttributionLayer {
  name: string;
  who: string;
  /** True when the layer is Sagar's — rendered solid and signal-keyed. */
  mine: boolean;
  size: string;
}

/* ===========================================================================
 * Phase 3 — routing, contracts, provenance, attribution
 *
 * Everything below extends the model above rather than replacing it. The rule
 * that governs the original types governs these too: a statement about the
 * work cannot be expressed without the evidence for it. `Decision` and
 * `ResultClaim` both require a `Source` for exactly that reason.
 * ========================================================================= */

/**
 * How ready a piece of content is.
 *
 * This exists so that a field can be honestly empty. The alternative — writing
 * plausible prose to fill a slot — is the failure mode this whole site is
 * built to avoid, and it is far easier to do accidentally than it looks.
 */
export type ContentState =
  /** Written, and every claim in it carries a source. */
  | "verified"
  /** Written, but an assertion in it still needs evidence attached. */
  | "needs-source"
  /** Real and known, but not yet written up. */
  | "needs-writing"
  /** No honest content exists yet. Renders as absent, never as filler. */
  | "not-available";

/** The sections a contract dossier can carry, for readiness reporting. */
export type ContractSection =
  | "identification"
  | "objective"
  | "result"
  | "architecture"
  | "decisions"
  | "challenges"
  | "evidence"
  | "attribution"
  | "lessons"
  | "nextIteration";

/**
 * An engineering decision: what was chosen, what was rejected, and why.
 *
 * The source is mandatory. "I chose X over Y for reason Z, and here is the
 * commit" is the most convincing thing an engineer can show, and it is only
 * convincing while it remains checkable.
 */
export interface Decision {
  choice: string;
  /** The alternative that was not taken. The rejection is the informative half. */
  rejected: string;
  why: string;
  source: Source;
}

/** Something that fought back, and what was done about it. */
export interface Challenge {
  problem: string;
  resolution: string;
  source?: Source;
}

/** A statement about what the system does now, with its proof. */
export type ResultClaim = Claim;

/** A person who worked on something. */
export interface Contributor {
  name: string;
  /** Platform handle, where one exists and is public. */
  handle?: string;
  href?: string;
}

/**
 * One row of an attribution breakdown.
 *
 * `size` is deliberately a string rather than a number: "16 of 29 commits" and
 * "6,731 lines" are different units and should not be forced into a shared
 * scale that implies a comparison nobody measured.
 */
export interface AttributionEntry {
  area: string;
  who: string;
  /** True when this is Sagar's work. Rendered solid; others are hatched. */
  mine: boolean;
  size: string;
  source?: Source;
}

/**
 * Honest ownership of a piece of work.
 *
 * `notClaimed` is the important field. On a team project, stating plainly what
 * is *not* yours reads as confidence; a vague "collaborated on" reads as
 * hedging, and an unqualified claim is simply false.
 */
export interface Attribution {
  model: "sole" | "team";
  /** One sentence a reader can take at face value. */
  summary: string;
  entries: AttributionEntry[];
  /** For team work: what is explicitly not being claimed. */
  notClaimed?: string;
  collaborators?: Contributor[];
  /** Where the contribution split can be checked. */
  evidence?: Source;
}

/** Why a project existed, and why that mattered. */
export interface Objective {
  problem: string;
  whyItMatters: string;
}

export interface ArchitectureNote {
  summary: string;
  /** Ordered layers, shallow to deep, mirroring the site's own model. */
  layers?: { name: string; detail: string }[];
  source?: Source;
}

/**
 * A project, as the site presents it.
 *
 * Extends `Project` so the existing sections keep rendering unchanged while
 * the deeper dossier fields are filled in over time. Everything new is
 * optional precisely so that a half-written contract is a smaller contract,
 * not a contract padded out with invention.
 */
export interface Contract extends Project {
  /** "CONTRACT 01". Stable; the future environment may key objects off it. */
  designation: string;
  /** Which level of the system this work belongs to. */
  level: StratumId;
  objective?: Objective;
  role?: string;
  architecture?: ArchitectureNote;
  decisions?: Decision[];
  challenges?: Challenge[];
  result?: ResultClaim[];
  attribution: Attribution;
  lessons?: string[];
  nextIteration?: string[];
  /** Per-section honesty ledger. Drives the internal content-gap report. */
  readiness: Partial<Record<ContractSection, ContentState>>;
}

/* --- Routing ------------------------------------------------------------ */

/**
 * Stable route identifiers.
 *
 * These are the join key between the content architecture and anything that
 * navigates it later — chrome, a level rail, breadcrumbs, or eventually a
 * location in a generated environment. Paths may be restyled; these must not
 * churn, because other systems will be keyed off them.
 */
export type RouteId =
  | "signal"
  | "dossier"
  | "systems"
  | "contracts"
  | "contract"
  | "record"
  | "colophon"
  | "verify"
  | "contact"
  | "cv"
  | "system-reference";

/**
 * Canonical metadata for one route.
 *
 * Dual register is a permanent rule, not a flourish. `display` is the in-world
 * name and `conventional` is what everyone else calls it; the accessible name
 * and the document title are built from the conventional one, so nobody has to
 * decode the theme to find the projects.
 */
export interface RouteMeta {
  id: RouteId;
  path: string;
  level: StratumId;
  /** In-world name: CONTRACTS, DOSSIER, RECORD. */
  display: string;
  /** What it plainly is: projects, profile, engineering record. */
  conventional: string;
  /** `document.title`, built from the conventional name. */
  title: string;
  description: string;
  /** Appears in primary navigation. */
  nav: boolean;
  /** Indexable by search engines. */
  index: boolean;
  /** False for routes that are not yet real, e.g. a CV that does not exist. */
  available: boolean;
}
