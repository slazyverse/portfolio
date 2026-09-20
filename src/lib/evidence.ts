import { CONTRACTS } from "@/data/contracts";
import { PRINCIPLES } from "@/data/principles";
import { contractPath, route } from "@/data/routes";
import type { Source } from "@/data/types";

/**
 * The evidence graph.
 *
 * Derived from the typed content, never maintained alongside it. `/verify`
 * exists to answer two questions — what does this site claim, and where can
 * that be checked — and it can only answer them honestly if it is reading the
 * same records the pages read. A hand-written index would drift within a
 * month and would be worth nothing the moment it did.
 *
 * Anything that asserts something about the work and carries a `Source` is
 * collected here automatically. Adding a sourced claim to a contract adds it
 * to the index; there is no second place to update.
 */

export type EvidenceKind = "claim" | "decision" | "attribution" | "principle";

export interface EvidenceEntry {
  /** Stable key for lists and anchors. */
  id: string;
  kind: EvidenceKind;
  /** What is being asserted. */
  statement: string;
  /** What it is about — a project name, or the site itself. */
  context: string;
  /** Where on the site the claim appears. */
  href: string;
  /** Where it can be checked. */
  source: Source;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/**
 * Collects every sourced assertion the site makes.
 *
 * Ordered by context so the index reads as a document rather than a dump.
 */
export function collectEvidence(): EvidenceEntry[] {
  const entries: EvidenceEntry[] = [];

  for (const contract of CONTRACTS) {
    const href = contractPath(contract.slug);

    for (const claim of contract.claims) {
      entries.push({
        id: `${contract.slug}-claim-${slugify(claim.statement)}`,
        kind: "claim",
        statement: claim.statement,
        context: contract.name,
        href,
        source: claim.source,
      });
    }

    for (const result of contract.result ?? []) {
      entries.push({
        id: `${contract.slug}-result-${slugify(result.statement)}`,
        kind: "claim",
        statement: result.statement,
        context: contract.name,
        href,
        source: result.source,
      });
    }

    for (const decision of contract.decisions ?? []) {
      entries.push({
        id: `${contract.slug}-decision-${slugify(decision.choice)}`,
        kind: "decision",
        statement: `Chose ${decision.choice} over ${decision.rejected}. ${decision.why}`,
        context: contract.name,
        href,
        source: decision.source,
      });
    }

    // Attribution is a claim about who did what, which on a team project is
    // the claim most worth being able to check.
    for (const entry of contract.attribution.entries) {
      if (!entry.source) continue;
      entries.push({
        id: `${contract.slug}-attribution-${slugify(entry.area)}`,
        kind: "attribution",
        statement: `${entry.area} — ${entry.who}, ${entry.size}.`,
        context: contract.name,
        href,
        source: entry.source,
      });
    }
  }

  for (const principle of PRINCIPLES) {
    entries.push({
      id: `principle-${principle.index}`,
      kind: "principle",
      statement: principle.title,
      context: "How Sagar works",
      href: route("dossier").path,
      source: principle.source,
    });
  }

  return entries;
}

/** Evidence grouped by what it is about, preserving contract order. */
export function evidenceByContext(): { context: string; entries: EvidenceEntry[] }[] {
  const grouped = new Map<string, EvidenceEntry[]>();
  for (const entry of collectEvidence()) {
    const list = grouped.get(entry.context) ?? [];
    list.push(entry);
    grouped.set(entry.context, list);
  }
  return [...grouped.entries()].map(([context, entries]) => ({ context, entries }));
}
