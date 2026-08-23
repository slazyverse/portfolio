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
