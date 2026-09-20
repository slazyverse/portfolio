import { DEADLOCKD, VAYU, VAYU_LAYERS } from "./projects";
import type { Contract } from "./types";

/**
 * Contracts — the projects, as the site presents them.
 *
 * Built by extending the existing `Project` records rather than restating
 * them, so there is still one description of each project and the deeper
 * dossier fields accumulate on top of it.
 *
 * Every optional field is optional on purpose. A half-written contract should
 * be a smaller contract, never a contract padded out with plausible prose.
 * `readiness` records where each one actually stands, and the content-gap
 * report is generated from it rather than maintained by hand.
 */

const DEADLOCKD_REPO = "https://github.com/slazyverse/deadlockd";
const VAYU_REPO =
  "https://github.com/slazyverse/AKASH-Atmospheric-Knowledge-AQI-from-Satellite-Harmonics-";
const APIX_REPO = "https://github.com/Rexy-5097/apix";

/* -------------------------------------------------------------- CONTRACT 01 */

export const CONTRACT_DEADLOCKD: Contract = {
  ...DEADLOCKD,
  designation: "CONTRACT 01",
  // The deepest of the three: this work is about a mutex and the order in
  // which processes are allowed to finish.
  level: "substrate",
  role: "Sole author — engine, WebSocket bridge and client",
  objective: {
    problem:
      "Deadlock is taught as a diagram and examined as a definition. Neither shows the thing that actually matters: that a system can be one allocation away from a circular wait and still look completely healthy.",
    whyItMatters:
      "A safety check is only worth having if it can be watched being wrong. Making the state observable is what turns the algorithm from an exam answer into something you can trust in a running system.",
  },
  attribution: {
    model: "sole",
    summary: "Sole author. Six of six commits, engine and client.",
    entries: [
      {
        area: "Concurrency engine — Banker's Algorithm, cycle detection, recovery",
        who: "Sagar",
        mine: true,
        size: "6 of 6 commits",
        source: {
          path: "backend/engine/banker.go",
          href: `${DEADLOCKD_REPO}/blob/main/backend/engine/banker.go`,
        },
      },
      {
        area: "WebSocket bridge and Next.js visualiser",
        who: "Sagar",
        mine: true,
        size: "6 of 6 commits",
        source: {
          path: "backend/engine/detection.go",
          href: `${DEADLOCKD_REPO}/blob/main/backend/engine/detection.go`,
        },
      },
    ],
    evidence: {
      path: "deadlockd — contributors",
      href: `${DEADLOCKD_REPO}/graphs/contributors`,
    },
  },
  readiness: {
    identification: "verified",
    objective: "verified",
    result: "verified",
    evidence: "verified",
    attribution: "verified",
    architecture: "needs-writing",
    decisions: "needs-writing",
    challenges: "needs-writing",
    lessons: "needs-writing",
    nextIteration: "needs-writing",
  },
};

/* -------------------------------------------------------------- CONTRACT 02 */

/**
 * APIx.
 *
 * Every figure here comes from `docs/apix-attribution.md`, which was derived
 * from the repository's own git history rather than from recollection. Nothing
 * has been rounded up.
 *
 * Two things are deliberately absent. The Smart India Hackathon association is
 * not claimed: the only trace of it is a teammate's local directory path in
 * two committed files, which is suggestive and not probative. And the raw
 * +50,935 line count is not used anywhere, because 22,878 of those lines are
 * thirteen generated JSON artifacts and quoting the total would overstate the
 * contribution by roughly half.
 */
export const CONTRACT_APIX: Contract = {
  slug: "apix",
  name: "APIx",
  tagline:
    "A quality-adjusted airfare price index for India, and the auditable pipeline that produces it.",
  state: "in-progress",
  ownership: "Team of three — acquisition and ingestion layer mine",
  designation: "CONTRACT 02",
  level: "engine",
  repoUrl: APIX_REPO,
  role: "Data acquisition, ingestion, and the analysis tooling that verifies it",
  meta: [
    { label: "Stack", value: "Python · pytest" },
    { label: "Team", value: "3 contributors" },
    { label: "Built", value: "September 2026" },
  ],
  summary: [
    "Built against MoSPI problem statement 26056. The engine is a frozen-specification airfare index; the harder half is the evidence pipeline underneath it, which has to collect real market observations under a fixed protocol and be able to prove afterwards what it collected and what it excluded.",
    "I own the boundary where the system meets untrusted external data: the collectors, the store, the scheduler, the manual and automated collection paths, and the analysis tooling that replays exclusions and checks the result. Roughly 18,900 lines of Python across 72 files, of which about 5,100 lines are tests.",
  ],
  objective: {
    problem:
      "An airfare index is only as credible as its inputs, and airfare inputs are hostile: quoted prices move constantly, carriers restrict automated access, and a single undocumented collection decision silently invalidates a longitudinal series.",
    whyItMatters:
      "Any index can produce a number. The question a statistical office would ask is whether you can reconstruct, months later, exactly which observations went in and which were excluded, and why.",
  },
  claims: [
    {
      statement:
        "Sole author of the ingestion layer — the observation store, the collector runner, the IndiGo parser and the scheduler — which is the boundary where the system meets untrusted external market data.",
      source: {
        path: "src/apix/ingestion/store.py",
        href: `${APIX_REPO}/blob/main/src/apix/ingestion/store.py`,
      },
    },
    {
      statement:
        "The collection contract is frozen in the repository before data is gathered, so the protocol cannot be adjusted after seeing the results.",
      source: {
        path: "src/apix/ingestion/collectors/runner.py",
        href: `${APIX_REPO}/blob/main/src/apix/ingestion/collectors/runner.py`,
      },
    },
    {
      statement:
        "Roughly 5,100 lines of the project's tests are mine, written against an external data source that cannot be relied upon to behave.",
      source: {
        path: "tests/test_collector_runner.py",
        href: `${APIX_REPO}/blob/main/tests/test_collector_runner.py`,
      },
    },
    {
      statement:
        "The project publishes no index value, and says so in its own README, because the longitudinal evidence its frozen methodology requires does not exist yet.",
      source: {
        path: "README.md",
        href: `${APIX_REPO}/blob/main/README.md`,
      },
    },
  ],
  metrics: [
    { value: "16/29", label: "Commits on main", note: "55% of the project" },
    { value: "18/32", label: "Pull requests", note: "17 merged" },
    { value: "18,900", label: "Lines of Python", note: "Across 72 files" },
    { value: "5,100", label: "Lines of tests", note: "Mine" },
  ],
  attribution: {
    model: "team",
    summary:
      "Three contributors. I am the largest by commits and own the acquisition boundary; the statistical core and the interface work are not mine.",
    entries: [
      {
        area: "Ingestion, collectors, scheduler, collection and analysis tooling",
        who: "Sagar",
        mine: true,
        size: "16 of 29 commits",
        source: {
          path: "src/apix/ingestion/",
          href: `${APIX_REPO}/tree/main/src/apix/ingestion`,
        },
      },
      {
        area: "Statistical core, methodology and index specification",
        who: "Soumyadeb Tripathy",
        mine: false,
        size: "8 of 29 commits",
      },
      {
        area: "Interface, art direction and jury dashboard surface",
        who: "Basant Bhushan",
        mine: false,
        size: "5 of 29 commits",
      },
    ],
    notClaimed:
      "The index methodology and the statistical engine are Soumyadeb's work, and the presentation layer is largely Basant's. I did not design the index.",
    collaborators: [
      { name: "Soumyadeb Tripathy", handle: "Rexy-5097", href: "https://github.com/Rexy-5097" },
      { name: "Basant Bhushan", handle: "Basant-creator", href: "https://github.com/Basant-creator" },
    ],
    evidence: {
      path: "docs/apix-attribution.md",
      href: `${APIX_REPO}/graphs/contributors`,
    },
  },
  readiness: {
    identification: "verified",
    objective: "verified",
    result: "verified",
    evidence: "verified",
    attribution: "verified",
    architecture: "needs-writing",
    decisions: "needs-writing",
    challenges: "needs-writing",
    lessons: "needs-writing",
    nextIteration: "needs-writing",
  },
};

/* -------------------------------------------------------------- CONTRACT 03 */

export const CONTRACT_VAYU: Contract = {
  ...VAYU,
  designation: "CONTRACT 03",
  level: "engine",
  role: "Platform layer — API, data layer, observability, container environment",
  objective: {
    problem:
      "Satellite observations of air quality are not air quality. Turning Sentinel-5P and ERA5 columns into something a person can act on needs a platform: somewhere to put the data, something to serve it, and enough observability to know when an answer is wrong.",
    whyItMatters:
      "The models are the visible half. Without a data layer, a versioned API and request tracing, a four-person team has no way to tell a modelling error from an ingestion error.",
  },
  attribution: {
    model: "team",
    summary:
      "Four contributors. I own the platform everything else runs on; the machine learning and the AQI calculation are not mine.",
    entries: VAYU_LAYERS.map((layer) => ({
      area: layer.name,
      who: layer.who,
      mine: layer.mine,
      size: layer.size,
    })),
    notClaimed:
      "The machine-learning pipeline is Yeshika's and the AQI calculation and Earth Engine ingestion are Soumyadeb's. I did not build the models.",
    collaborators: [
      { name: "Yeshika", handle: "yeshika-02" },
      { name: "Soumyadeb Tripathy", handle: "Rexy-5097", href: "https://github.com/Rexy-5097" },
    ],
    evidence: {
      path: "backend/app/main.py",
      href: `${VAYU_REPO}/blob/main/backend/app/main.py`,
    },
  },
  readiness: {
    identification: "verified",
    objective: "verified",
    result: "verified",
    evidence: "verified",
    attribution: "verified",
    architecture: "needs-writing",
    decisions: "needs-writing",
    challenges: "needs-writing",
    lessons: "needs-writing",
    nextIteration: "needs-writing",
  },
};

/* ------------------------------------------------------------------ index -- */

/** Every contract, in the order the index presents them. */
export const CONTRACTS: readonly Contract[] = [
  CONTRACT_DEADLOCKD,
  CONTRACT_APIX,
  CONTRACT_VAYU,
];

const BY_SLUG = new Map(CONTRACTS.map((c) => [c.slug, c]));

/** Resolves a slug. Returns undefined so callers can reach `notFound()`. */
export function contractBySlug(slug: string): Contract | undefined {
  return BY_SLUG.get(slug);
}

export const CONTRACT_SLUGS: readonly string[] = CONTRACTS.map((c) => c.slug);
