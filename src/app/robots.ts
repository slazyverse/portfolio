import type { MetadataRoute } from "next";
import { SITE } from "@/data/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The design-system laboratory. Internal: reviewed, not read. It also
      // carries `robots: noindex` in its own metadata; this is the second lock.
      disallow: "/system",
    },
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
