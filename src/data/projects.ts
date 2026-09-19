import type { AttributionLayer, Project } from "./types";

const DEADLOCKD_REPO = "https://github.com/slazyverse/deadlockd";
const VAYU_REPO =
  "https://github.com/slazyverse/AKASH-Atmospheric-Knowledge-AQI-from-Satellite-Harmonics-";

export const DEADLOCKD: Project = {
  slug: "deadlockd",
  name: "deadlockd",
  tagline: "A real-time deadlock simulator and concurrency visualiser.",
  state: "live",
  ownership: "Sole author — 6 of 6 commits",
  liveUrl: "https://deadlockd.vercel.app",
  repoUrl: DEADLOCKD_REPO,
  meta: [
    { label: "Stack", value: "Go · Next.js · TypeScript" },
    { label: "Licence", value: "MIT" },
    { label: "Built", value: "April 2026" },
  ],
  summary: [
    "A Go backend runs the simulation; a Next.js client renders the resource-allocation graph live over a WebSocket bridge. Processes request and release resources, the engine checks whether each request leaves the system in a safe state, and when a circular wait closes the graph locks and the cycle is recovered and displayed.",
    "The correctness is the product. The visualiser exists so the correctness can be observed — which is the only reason the frontend is there at all.",
  ],
  claims: [
    {
      statement:
        "The safety check copies system state under mutex, then releases the lock before running its O(P²·R) search — so the expensive computation never blocks other goroutines.",
      source: {
        path: "backend/engine/banker.go",
        lines: "L15–L30",
        href: `${DEADLOCKD_REPO}/blob/main/backend/engine/banker.go#L15-L30`,
      },
    },
    {
      statement:
        "Cycle detection uses an explicit-stack iterative DFS with white/gray/black colouring rather than recursion, so deep process graphs carry no stack-depth risk — and it recovers the actual cycle through a parent array.",
      source: {
        path: "backend/engine/detection.go",
        href: `${DEADLOCKD_REPO}/blob/main/backend/engine/detection.go`,
      },
    },
    {
      statement:
        "Tests assert exact matrix state, not that the code merely ran: a granted safe request must move Available, Allocation and Need to specific expected values.",
      source: {
        path: "backend/engine/scenarios_test.go",
        href: `${DEADLOCKD_REPO}/blob/main/backend/engine/scenarios_test.go`,
      },
    },
    {
      statement:
        "CI runs go mod verify and the full Go test suite, plus an independent frontend production build, on every push and pull request.",
      source: {
        path: ".github/workflows/ci.yml",
        href: `${DEADLOCKD_REPO}/blob/main/.github/workflows/ci.yml`,
      },
    },
  ],
  metrics: [
    { value: "6/6", label: "Commits mine", note: "Sole contributor" },
    { value: "O(P²·R)", label: "Safety search", note: "Documented in-header" },
    { value: "2", label: "CI gates", note: "Go tests · frontend build" },
    { value: "8", label: "Engine modules" },
  ],
  excerpt: {
    file: "backend/engine/banker.go",
    range: "L14 — L30",
    href: `${DEADLOCKD_REPO}/blob/main/backend/engine/banker.go#L14-L30`,
    language: "go",
    lines: [
      { n: 14, code: "func IsSafeState(state *SystemState) (bool, []int) {" },
      { n: 15, code: "\tstate.Mu.Lock()", highlight: true },
      { n: 16, code: "\tnp := len(state.Processes)" },
      { n: 17, code: "\tnr := len(state.Resources)" },
      { n: 19, code: "\twork := make([]int, nr)" },
      { n: 20, code: "\tcopy(work, state.Available)" },
      { n: 24, code: "\tfor i := 0; i < np; i++ {" },
      { n: 27, code: "\t\tcopy(need[i], state.Need[i])" },
      { n: 28, code: "\t\tcopy(alloc[i], state.Allocation[i])" },
      { n: 29, code: "\t}" },
      { n: 30, code: "\tstate.Mu.Unlock()", highlight: true },
    ],
  },
};

export const VAYU: Project = {
  slug: "vayu-drishti",
  name: "VAYU-DRISHTI",
  tagline:
    "A satellite air-quality platform for India — surface AQI, formaldehyde hotspots and active-fire monitoring.",
  state: "in-progress",
  ownership: "Team of four — platform layer mine",
  repoUrl: VAYU_REPO,
  meta: [
    { label: "Stack", value: "FastAPI · PostGIS · Streamlit" },
    { label: "Team", value: "4 contributors" },
    { label: "Built", value: "July 2026" },
  ],
  summary: [
    "A four-person project analysing Sentinel-5P and ERA5 observations to estimate ground-level air quality. Yeshika owns the machine-learning pipeline; Soumyadeb owns the AQI calculation and Earth Engine ingestion.",
    "I own the platform: the API, the data layer, the observability, the container environment, and the dashboard the team's models are seen through. Three commits, roughly 11,700 lines across 116 files — the substrate everything else runs on.",
  ],
  claims: [
    {
      statement:
        "Configuration refuses to boot the server on DEBUG=True with ENVIRONMENT=production. The misconfiguration raises at import time, before the application accepts a single request.",
      source: {
        path: "backend/app/core/config.py",
        href: `${VAYU_REPO}/blob/main/backend/app/core/config.py`,
      },
    },
    {
      statement:
        "Request-ID middleware binds a UUID into structlog contextvars, so every log line emitted during a request carries the same trace ID — and the ID returns to the caller on the X-Request-ID header.",
      source: {
        path: "backend/app/main.py",
        href: `${VAYU_REPO}/blob/main/backend/app/main.py`,
      },
    },
    {
      statement:
        "Alembic runs migrations through asyncio.run() and create_async_engine(), so asyncpg is the only PostgreSQL driver in the project. psycopg2 is deliberately absent rather than carried as a second dependency.",
      source: {
        path: "backend/requirements.txt",
        href: `${VAYU_REPO}/blob/main/backend/requirements.txt`,
      },
    },
    {
      statement:
        "The DATABASE_URL is a computed field assembled from separate components with quote_plus encoding, so special characters in credentials cannot corrupt the connection string.",
      source: {
        path: "backend/app/core/config.py",
        href: `${VAYU_REPO}/blob/main/backend/app/core/config.py`,
      },
    },
  ],
  metrics: [
    { value: "11,700", label: "Lines, platform layer", note: "Across 116 files" },
    { value: "6", label: "API endpoint modules" },
    { value: "7", label: "Pydantic schema modules" },
    { value: "3", label: "Commits", note: "Plus repo initialisation" },
  ],
};

export const PROJECTS: Project[] = [DEADLOCKD, VAYU];

/**
 * The attribution cross-section. Ordered top-down as strata: the team's work
 * sits above the platform it runs on. Rendering this honestly is the point —
 * it is more convincing than claiming the whole project.
 */
export const VAYU_LAYERS: AttributionLayer[] = [
  {
    name: "ML pipeline — models, feature selection, evaluation",
    who: "yeshika-02",
    mine: false,
    size: "26 commits",
  },
  {
    name: "AQI calculation · Earth Engine ingestion · Random Forest",
    who: "soumyadeb",
    mine: false,
    size: "10 commits",
  },
  {
    name: "Streamlit dashboard · GIS map · charts · report pages",
    who: "Sagar",
    mine: true,
    size: "1,854 lines",
  },
  {
    name: "API v1 · schemas · services · live-data hardening",
    who: "Sagar",
    mine: true,
    size: "2,599 lines",
  },
  {
    name: "Config · structured logging · async data layer · Docker · tests",
    who: "Sagar",
    mine: true,
    size: "6,731 lines",
  },
];
