import type { StratumId } from "./types";

/**
 * The lightweight contract index.
 *
 * This exists for one concrete reason: the persistent chrome needs to know
 * which contract it is sitting on — its designation and level — and importing
 * the full `CONTRACTS` array into a client component would pull every summary,
 * claim, metric and attribution row into the initial bundle for the sake of
 * two short strings.
 *
 * So designation, name and level live here, and `contracts.ts` reads them from
 * this file rather than restating them. There is still one source of truth;
 * it is just the small one, and only the small one crosses into the client.
 */
export interface ContractIndexEntry {
  slug: string;
  /** "CONTRACT 01". Stable; the future environment may key objects off it. */
  designation: string;
  name: string;
  level: StratumId;
}

export const CONTRACT_INDEX: readonly ContractIndexEntry[] = [
  {
    slug: "deadlockd",
    designation: "CONTRACT 01",
    name: "deadlockd",
    // The deepest of the three: this work is about a mutex and the order in
    // which processes are allowed to finish.
    level: "substrate",
  },
  {
    slug: "apix",
    designation: "CONTRACT 02",
    name: "APIx",
    level: "engine",
  },
  {
    slug: "vayu-drishti",
    designation: "CONTRACT 03",
    name: "VAYU-DRISHTI",
    level: "engine",
  },
];

const BY_SLUG = new Map(CONTRACT_INDEX.map((c) => [c.slug, c]));

export function contractIndexBySlug(slug: string): ContractIndexEntry | undefined {
  return BY_SLUG.get(slug);
}
