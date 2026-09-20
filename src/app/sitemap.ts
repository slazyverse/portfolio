import type { MetadataRoute } from "next";
import { CONTRACTS } from "@/data/contracts";
import { INDEXABLE_ROUTES, contractPath } from "@/data/routes";
import { SITE } from "@/data/site";

/**
 * Generated from the route table, so a new route is in the sitemap the moment
 * it exists and an unavailable one never is.
 *
 * `INDEXABLE_ROUTES` already excludes the design-system laboratory, the
 * unavailable CV, and the dynamic contract template; the individual contracts
 * are appended from their own records.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const routes = INDEXABLE_ROUTES.map((r) => ({
    url: `${SITE.url}${r.path === "/" ? "" : r.path}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: r.path === "/" ? 1 : 0.8,
  }));

  const contracts = CONTRACTS.map((c) => ({
    url: `${SITE.url}${contractPath(c.slug)}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...routes, ...contracts];
}
