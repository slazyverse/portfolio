import { CONTRACTS } from "@/data/contracts";
import { contractPath } from "@/data/routes";
import type { Contract, ContractSection } from "@/data/types";

/* ---------------------------------------------------------------------------
 * What a dossier is made of, derived rather than declared.
 *
 * Every question this module answers — which sections a contract actually has,
 * how much of it is evidenced, what comes before and after it — is a function
 * of the contract record. None of it is a second list to keep in step, because
 * a second list would be wrong the first time a section was written and would
 * stay wrong quietly.
 *
 * It imports the full `CONTRACTS` array, so it belongs on the server side of
 * the boundary. The chrome uses `contract-index.ts` for the same reason it
 * always has.
 * ------------------------------------------------------------------------- */

/**
 * The order a dossier is read in.
 *
 * Deliberately not the order the fields appear in the type. A reader decides
 * whether to keep going in the first screen, so what the thing is and the
 * proof that it does it come before any account of process. Architecture,
 * decisions and challenges are the depth someone opts into; attribution and
 * evidence are what they check before believing any of it.
 */
export interface DossierSection {
  id: ContractSection | "summary" | "results";
  /** Two-digit marker, assigned after empty sections are dropped. */
  index: string;
  /** In-page heading and nav label. */
  title: string;
  /** Anchor target. */
  anchor: string;
}

const SECTION_ORDER: {
  id: DossierSection["id"];
  title: string;
  anchor: string;
  present: (c: Contract) => boolean;
}[] = [
  {
    id: "identification",
    title: "Identification",
    anchor: "identification",
    present: () => true,
  },
  {
    id: "objective",
    title: "Context",
    anchor: "context",
    present: (c) => Boolean(c.objective),
  },
  {
    id: "summary",
    title: "What it does",
    anchor: "what-it-does",
    present: (c) => c.summary.length > 0,
  },
  {
    id: "architecture",
    title: "Architecture",
    anchor: "architecture",
    present: (c) => Boolean(c.architecture),
  },
  {
    id: "decisions",
    title: "Decisions",
    anchor: "decisions",
    present: (c) => (c.decisions?.length ?? 0) > 0,
  },
  {
    id: "challenges",
    title: "Challenges",
    anchor: "challenges",
    present: (c) => (c.challenges?.length ?? 0) > 0,
  },
  {
    id: "results",
    title: "Results",
    anchor: "results",
    present: (c) => c.metrics.length > 0 || (c.result?.length ?? 0) > 0,
  },
  {
    id: "attribution",
    title: "Attribution",
    anchor: "attribution",
    present: () => true,
  },
  {
    id: "evidence",
    title: "Evidence",
    anchor: "evidence",
    present: (c) => Boolean(c.excerpt),
  },
  {
    id: "lessons",
    title: "Lessons",
    anchor: "lessons",
    present: (c) => (c.lessons?.length ?? 0) > 0,
  },
  {
    id: "nextIteration",
    title: "Next iteration",
    anchor: "next-iteration",
    present: (c) => (c.nextIteration?.length ?? 0) > 0,
  },
];

/**
 * The sections this contract actually has, numbered in sequence.
 *
 * Numbering after filtering rather than before is the whole reason this is a
 * function. A dossier that runs 01, 02, 05, 09 announces its own gaps in the
 * one place they are least useful — the margin — while the readiness ledger
 * states them properly at the end.
 */
export function dossierSections(contract: Contract): DossierSection[] {
  return SECTION_ORDER.filter((s) => s.present(contract)).map((s, i) => ({
    id: s.id,
    index: String(i + 1).padStart(2, "0"),
    title: s.title,
    anchor: s.anchor,
  }));
}

/**
 * How many statements about this project carry a source.
 *
 * Counted, not asserted. It is the one number on the index that cannot be
 * inflated by writing more prose: adding a paragraph does not move it, and
 * adding a claim without evidence will not compile.
 */
export function evidenceCount(contract: Contract): number {
  return (
    contract.claims.length +
    (contract.result?.length ?? 0) +
    (contract.decisions?.length ?? 0) +
    (contract.challenges?.filter((c) => c.source).length ?? 0) +
    (contract.nextIteration?.filter((n) => n.source).length ?? 0) +
    (contract.architecture?.source ? 1 : 0) +
    contract.attribution.entries.filter((e) => e.source).length +
    (contract.attribution.evidence ? 1 : 0)
  );
}

/** Sections written and evidenced, against sections declared. */
export function readinessRatio(contract: Contract): { done: number; total: number } {
  const states = Object.values(contract.readiness);
  return {
    done: states.filter((s) => s === "verified").length,
    total: states.length,
  };
}

/** Sections that are honestly not finished, in declaration order. */
export function readinessGaps(
  contract: Contract,
): { section: ContractSection; state: string }[] {
  return Object.entries(contract.readiness)
    .filter(([, state]) => state !== "verified")
    .map(([section, state]) => ({ section: section as ContractSection, state: state! }));
}

export interface Neighbour {
  slug: string;
  name: string;
  designation: string;
  path: string;
}

/**
 * The contracts either side of this one.
 *
 * A reader who finishes a dossier has exactly one useful next action, and
 * making them go back to the index to find it is a small tax charged at the
 * moment they were most engaged. The list does not wrap: "last" is a real
 * state and pretending otherwise sends someone in a circle.
 */
export function contractNeighbours(slug: string): {
  previous?: Neighbour;
  next?: Neighbour;
  position: number;
  total: number;
} {
  const i = CONTRACTS.findIndex((c) => c.slug === slug);
  const at = (n: number): Neighbour | undefined => {
    const c = CONTRACTS[n];
    if (!c) return undefined;
    return {
      slug: c.slug,
      name: c.name,
      designation: c.designation,
      path: contractPath(c.slug),
    };
  };
  return {
    previous: i > 0 ? at(i - 1) : undefined,
    next: i >= 0 ? at(i + 1) : undefined,
    position: i + 1,
    total: CONTRACTS.length,
  };
}

/**
 * The anchor for this project's section of the evidence index.
 *
 * `/verify` groups by subject and derives its ids from the project name, so
 * this derives the same id from the same name rather than restating it.
 */
export function verifyAnchor(contract: Contract): string {
  return `/verify#ev-${contract.name.replace(/\W+/g, "-").toLowerCase()}`;
}
