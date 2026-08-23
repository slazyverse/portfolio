import type { Principle, RecordRow, StackGroup } from "./types";

const DEADLOCKD = "https://github.com/slazyverse/deadlockd";
const VAYU =
  "https://github.com/slazyverse/AKASH-Atmospheric-Knowledge-AQI-from-Satellite-Harmonics-";

/**
 * Four principles, each earned by a specific piece of committed code.
 * None of these are aspirations — each one links to where it was practised.
 */
export const PRINCIPLES: Principle[] = [
  {
    index: "01",
    title: "A decision that isn't written down didn't happen",
    body: "Complexity bounds live in the function header that implements them. Every production dependency carries a line explaining why it is there and why the alternative was rejected. Six months later the reasoning is still in the repository rather than in someone's memory.",
    source: {
      path: "backend/requirements.txt",
      href: `${VAYU}/blob/main/backend/requirements.txt`,
    },
  },
  {
    index: "02",
    title: "Make the failure impossible, not unlikely",
    body: "Running with debug enabled in production is not a mistake to be careful about — it is a state the configuration layer refuses to construct. The validator raises at import time, so the server cannot reach the point of accepting a request in a dangerous configuration.",
    source: {
      path: "backend/app/core/config.py",
      href: `${VAYU}/blob/main/backend/app/core/config.py`,
    },
  },
  {
    index: "03",
    title: "Hold the lock for as short as you can",
    body: "The safety check needs a consistent view of the allocation matrices, not exclusive access for the duration of the search. So it copies them under the mutex, releases, and searches the snapshot. The critical section is a handful of copies; the O(P²·R) work happens outside it.",
    source: {
      path: "backend/engine/banker.go",
      lines: "L15–L30",
      href: `${DEADLOCKD}/blob/main/backend/engine/banker.go#L15-L30`,
    },
  },
  {
    index: "04",
    title: "A system you cannot observe is a system you cannot operate",
    body: "Every request carries a UUID bound into the logging context, so a single trace ID connects middleware, route handler, service and query. On the interface side the same instinct produces explicit loading, empty and error states rather than a spinner that means nothing.",
    source: {
      path: "backend/app/main.py",
      href: `${VAYU}/blob/main/backend/app/main.py`,
    },
  },
];

/**
 * Two tiers, honestly split. Phase 1 rule: anything that cannot be pointed at
 * in a repository does not appear in the shipped tier — an unbacked entry
 * devalues every entry beside it.
 */
export const STACK: StackGroup[] = [
  {
    tier: "shipped",
    heading: "Shipped in production",
    note: "Used to build something that runs, and pointed at below.",
    items: [
      { name: "Go", where: "deadlockd — concurrency engine, WebSocket hub" },
      { name: "Python", where: "VAYU-DRISHTI — FastAPI backend, services" },
      { name: "TypeScript", where: "deadlockd — typed socket client" },
      { name: "FastAPI", where: "App factory, versioned router, 6 endpoint modules" },
      { name: "PostgreSQL · PostGIS", where: "Async SQLAlchemy 2.0, GeoAlchemy2" },
      { name: "SQLAlchemy · Alembic", where: "Async engine, PostGIS migrations" },
      { name: "Pydantic v2", where: "Settings, validation, 7 schema modules" },
      { name: "Next.js · React", where: "deadlockd client, React Flow graph" },
      { name: "Tailwind CSS", where: "deadlockd interface" },
      { name: "Docker · Compose", where: "Both projects, with entrypoints" },
      { name: "GitHub Actions", where: "Test and build gates on both repos" },
      { name: "structlog", where: "JSON logging, request-ID tracing" },
      { name: "pytest · go test", where: "Behavioural tests in both projects" },
      { name: "Streamlit · Folium", where: "VAYU-DRISHTI dashboard and GIS map" },
    ],
  },
  {
    tier: "working",
    heading: "Working knowledge",
    note: "Used in coursework and study, not yet in anything I have shipped publicly.",
    items: [
      { name: "C · C++", where: "Data structures, algorithms, systems coursework" },
      { name: "scikit-learn", where: "Classification and evaluation workflows" },
      { name: "Pandas · NumPy", where: "Data processing and analysis" },
      { name: "Redis", where: "Caching and queueing patterns" },
      { name: "Linux", where: "Daily driver, shell tooling, deployment" },
    ],
  },
];

/**
 * Replaces the GitHub-stats widget. At 0 stars and 4 repos a contribution
 * graph argues against him; these are the measures the work actually wins on.
 */
export const RECORD: RecordRow[] = [
  {
    project: "deadlockd",
    tests: "Go behavioural suite",
    ci: "go mod verify · go test · frontend build",
    container: "Dockerfile + compose",
    deploy: "Live — deadlockd.vercel.app",
  },
  {
    project: "VAYU-DRISHTI",
    tests: "pytest + fixtures",
    ci: "Feature branches, PR review",
    container: "Dockerfile + compose + entrypoint",
    deploy: "Local / staging",
  },
];
