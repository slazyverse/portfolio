import type { Stratum } from "./types";

/**
 * The canonical origin.
 *
 * Vercel injects the real host at build time, so canonical tags, Open Graph
 * URLs, robots and the sitemap all follow the deployment instead of pointing at
 * a domain that may not resolve. Set NEXT_PUBLIC_SITE_URL once a custom domain
 * is attached and it wins over everything else.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  // Set on production deployments; stable across redeploys.
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return `https://${production}`;

  // Per-deployment URL — correct for previews.
  const deployment = process.env.VERCEL_URL;
  if (deployment) return `https://${deployment}`;

  return "http://localhost:3000";
}

export const SITE = {
  name: "Sagar Tailor",
  role: "Backend & systems engineer",
  /** The positioning statement from Phase 1. Everything inherits from it. */
  statement: "Builds the layer underneath",
  description:
    "Backend and systems engineer. Go concurrency, async Python, and the platform layers other work runs on.",
  url: resolveSiteUrl(),
  email: "sagar885402@gmail.com",
  github: "https://github.com/slazyverse",
  githubHandle: "github.com/slazyverse",
  linkedin: "https://www.linkedin.com/in/slazyverse/",
  linkedinHandle: "linkedin.com/in/slazyverse",
  location: "Rajasthan, India",
  education: "B.Tech Computer Science & Engineering, Lovely Professional University",
} as const;

export const STRATA: Stratum[] = [
  {
    id: "surface",
    index: "00",
    name: "Surface",
    description: "What software looks like from outside.",
  },
  {
    id: "interface",
    index: "01",
    name: "Interface",
    description: "The layer where behaviour becomes visible.",
  },
  {
    id: "engine",
    index: "02",
    name: "Engine",
    description: "Where the work is actually done.",
  },
  {
    id: "substrate",
    index: "03",
    name: "Substrate",
    description: "Bedrock. Facts, no ornament.",
  },
];

/** Section anchors, in descent order. Drives the depth rail. */
export const NAV = [
  { id: "entry", label: "Entry", stratum: "surface" },
  { id: "position", label: "Position", stratum: "surface" },
  { id: "descent", label: "The descent", stratum: "interface" },
  { id: "deadlockd", label: "deadlockd", stratum: "interface" },
  { id: "vayu-drishti", label: "VAYU-DRISHTI", stratum: "engine" },
  { id: "how-its-built", label: "How it's built", stratum: "engine" },
  { id: "stack", label: "Stack", stratum: "substrate" },
  { id: "record", label: "Record", stratum: "substrate" },
  { id: "contact", label: "Contact", stratum: "substrate" },
] as const;
