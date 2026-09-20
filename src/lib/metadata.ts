import type { Metadata } from "next";
import { route } from "@/data/routes";
import type { RouteId } from "@/data/types";

/**
 * Builds page metadata from the canonical route table.
 *
 * The point is that a route's title, description, canonical URL and indexing
 * rule all come from the same record that drives its navigation label — so a
 * page cannot end up indexed when the route table says it should not be, or
 * carry a title that no longer matches what the nav calls it.
 *
 * Titles use the *conventional* name. A search result reading "CONTRACTS" is a
 * search result nobody clicks.
 */
export function routeMetadata(
  id: RouteId,
  overrides: Partial<Metadata> = {},
): Metadata {
  const meta = route(id);

  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: meta.path },
    robots: meta.index
      ? { index: true, follow: true }
      : { index: false, follow: false, nocache: true },
    openGraph: {
      type: "website",
      url: meta.path,
      title: meta.title,
      description: meta.description,
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
    },
    ...overrides,
  };
}
