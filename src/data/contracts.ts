import { contractIndexBySlug } from "./contract-index";
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
  designation: contractIndexBySlug("deadlockd")!.designation,
  domain: "Concurrency",
  level: contractIndexBySlug("deadlockd")!.level,
  role: "Sole author — engine, WebSocket bridge and client",
  objective: {
    problem:
      "Deadlock is taught as a diagram and examined as a definition. Neither shows the thing that actually matters: that a system can be one allocation away from a circular wait and still look completely healthy.",
    whyItMatters:
      "A safety check is only worth having if it can be watched being wrong. Making the state observable is what turns the algorithm from an exam answer into something you can trust in a running system.",
  },
  architecture: {
    summary:
      "Two processes and a socket between them. Every decision about safety happens in the Go engine; the browser receives state snapshots and draws them. That split is the design: a correctness engine that needs its own interface in order to be right is not a correctness engine.",
    layers: [
      {
        name: "Next.js client",
        detail:
          "Dashboard, sandbox and matrix viewers, with the resource-allocation graph drawn through @xyflow/react. It computes nothing about safety.",
      },
      {
        name: "WebSocket hub",
        detail:
          "Commands in, state snapshots out. The only thing the client talks to, and the only thing that talks back.",
      },
      {
        name: "Simulation manager",
        detail:
          "Applies a request tentatively, asks the safety check, then commits it or rolls it back under the same mutex.",
      },
      {
        name: "Safety and detection",
        detail:
          "Banker's safety search and the wait-for cycle detector. Both read a copy of the matrices; neither touches the live ones.",
      },
      {
        name: "System state",
        detail:
          "Available, Allocation and Need behind a sync.Mutex, with one goroutine per simulated process.",
      },
    ],
    flow: [
      { stage: "Request", detail: "A process asks for a quantity of a resource." },
      {
        stage: "Tentative allocation",
        detail: "The manager applies it to the state before deciding anything about it.",
      },
      {
        stage: "Safety check",
        detail:
          "IsSafeState looks for an order in which every process could still finish.",
      },
      {
        stage: "Commit or roll back",
        detail:
          "Safe grants the resource; unsafe restores the previous allocation under mutex and rejects the request.",
      },
      {
        stage: "Snapshot",
        detail: "The resulting state is dispatched to every connected client.",
      },
    ],
    source: {
      path: "README.md — system architecture",
      href: `${DEADLOCKD_REPO}/blob/main/README.md`,
    },
  },
  decisions: [
    {
      problem:
        "The safety search is O(P²·R) and reads every matrix in the system, while goroutines standing in for processes are asking for resources the whole time.",
      choice:
        "Copy Available, Allocation and Need under the mutex, release it, and run the search on the copy.",
      rejected: "Holding the mutex for the duration of the search.",
      why: "The lock exists to keep the matrices consistent, not to serialise the simulation. A quadratic search inside the critical section makes every other goroutine wait on work that does not need live state.",
      consequence:
        "The check never blocks a request, and it answers about the state as it was at copy time — which is the correct semantics for a decision the manager is about to act on under the same lock.",
      source: {
        path: "backend/engine/banker.go",
        lines: "L15–L30",
        href: `${DEADLOCKD_REPO}/blob/main/backend/engine/banker.go#L15-L30`,
      },
    },
    {
      problem:
        "Cycle detection over a wait-for graph is naturally recursive, and the graph is as deep as the process count — which the simulation lets you raise.",
      choice:
        "An iterative depth-first search with an explicit frame stack and white/gray/black colouring.",
      rejected: "Recursive DFS.",
      why: "Recursion depth would be bounded by user input. A stack overflow in the detector would take the engine down at exactly the moment it was most needed.",
      consequence:
        "Depth costs heap instead of stack, and the gray edge that closes the cycle is unwound from the live stack — so the detector reports which processes are deadlocked, not merely that something is.",
      source: {
        path: "backend/engine/detection.go",
        href: `${DEADLOCKD_REPO}/blob/main/backend/engine/detection.go`,
      },
    },
    {
      problem:
        "A wait-for graph is not stored anywhere. The simulation holds allocation matrices, and an edge between two processes is an inference from them.",
      choice:
        "Rebuild the graph on every detection pass — an edge from a process needing an exhausted resource to every process currently holding any of it.",
      rejected: "Maintaining a wait-for graph incrementally beside the matrices.",
      why: "Two representations of the same fact drift apart, and here the one that drifts is the one that decides whether the system is deadlocked.",
      consequence:
        "Detection pays for a rebuild each pass. In exchange there is exactly one place where the truth about allocation lives.",
      source: {
        path: "backend/engine/detection.go",
        href: `${DEADLOCKD_REPO}/blob/main/backend/engine/detection.go`,
      },
    },
    {
      problem:
        "An engine's correctness is invisible. A safety check that quietly returns the wrong answer looks exactly like one that works.",
      choice:
        "Assert exact matrix state in the tests, and ship the visualiser as part of the product rather than as a demo.",
      rejected: "A command-line simulator and a suite that checks the code ran.",
      why: "A granted safe request has one correct effect on Available, Allocation and Need. Asserting that effect is a different claim from asserting no error was returned, and watching the graph close is a different kind of evidence again.",
      consequence:
        "The client is a dependency of the explanation, never of the engine: go test ./... and go run . are both complete without it.",
      source: {
        path: "backend/engine/scenarios_test.go",
        href: `${DEADLOCKD_REPO}/blob/main/backend/engine/scenarios_test.go`,
      },
    },
  ],
  challenges: [
    {
      problem:
        "Two readers — the safety check and the detector — each need a coherent view of three matrices that a dozen goroutines are mutating.",
      resolution:
        "Both take the mutex only long enough to copy and then let go. Every critical section in the engine is short by construction, because the expensive work is always outside it.",
      source: {
        path: "backend/engine/banker.go",
        href: `${DEADLOCKD_REPO}/blob/main/backend/engine/banker.go`,
      },
    },
    {
      problem:
        "A deadlock is only worth showing while it forms, which means the client has to keep up with a graph that changes on every allocation.",
      resolution:
        "The engine dispatches state snapshots over the socket and the client re-renders memoised nodes. Nothing about the graph is recomputed in the browser, so the rendering cost does not sit on the path that decides safety.",
      source: {
        path: "README.md — design notes and constraints",
        href: `${DEADLOCKD_REPO}/blob/main/README.md`,
      },
    },
  ],
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
    architecture: "verified",
    decisions: "verified",
    challenges: "verified",
    // Both first-person. What changed in how I think, and what I would do
    // next, are the two things on this page nobody else can write — including
    // by inference from the repository. They stay absent.
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
  designation: contractIndexBySlug("apix")!.designation,
  domain: "Official statistics",
  level: contractIndexBySlug("apix")!.level,
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
  architecture: {
    summary:
      "A collection boundary, an evidence store, and a deterministic statistical spine that is forbidden from importing anything above it. My half is everything up to and including the store — the part that decides what counts as admissible evidence and can prove, months later, what it collected and what it refused.",
    layers: [
      {
        name: "Collection contract",
        detail:
          "Frozen advance-purchase bands, lead-time windows and eligibility rules, committed before any data is gathered so the protocol cannot be adjusted after seeing results.",
      },
      {
        name: "Compliance gate",
        detail:
          "Clearance for a live run is required before a single request leaves the machine, and refused by default.",
      },
      {
        name: "Collectors and scheduler",
        detail:
          "One paced search per travel date. A site error gets one retry; an access challenge stops that source for the rest of the run.",
      },
      {
        name: "Canonicalisation",
        detail:
          "Each search resolves to an Observation, an UnpricedFlight, or an exclusion carrying its reason. Nothing is discarded silently.",
      },
      {
        name: "Evidence store",
        detail:
          "Four SQLite tables — run, attempt, canonical observation, unpriced flight — beside a content-addressed directory of the raw bytes each one came from.",
      },
      {
        name: "Statistical spine",
        detail:
          "Jevons at the elementary level, Young / Modified Laspeyres above it, and the publication guards. Not my work.",
      },
    ],
    flow: [
      { stage: "Run config", detail: "The frozen collection contract for this wave." },
      { stage: "Compliance gate", detail: "Refuses before any request is made." },
      { stage: "Search", detail: "Paced, per travel date, recorded whether or not it succeeds." },
      {
        stage: "Eligibility",
        detail: "Earliest eligible flight per band, then the fare decision.",
      },
      {
        stage: "Canonical record",
        detail: "Observation, unpriced flight, or exclusion with a reason.",
      },
      {
        stage: "Export and manifest",
        detail: "Written first, so the evidence survives a refused load.",
      },
      { stage: "Store and verify", detail: "Loaded into the store, then read back and checked." },
    ],
    source: {
      path: "src/apix/ingestion/collectors/runner.py",
      href: `${APIX_REPO}/blob/main/src/apix/ingestion/collectors/runner.py`,
    },
  },
  decisions: [
    {
      problem:
        "The specification requires that a publication can be re-run from its recorded version vector and compared bit for bit.",
      choice:
        "A single SQLite file beside a content-addressed directory of raw artifacts, using only the standard library.",
      rejected: "A server database or a cloud object store.",
      why: "Reproducibility is a property of being able to find the original bytes again, not of the database engine. A file can be copied, diffed, and have its checksum committed.",
      consequence:
        "No operational cost and no new dependency, and PostgreSQL can replace the file later without touching a call site — the calls are the contract, not the storage.",
      source: {
        path: "src/apix/ingestion/store.py",
        href: `${APIX_REPO}/blob/main/src/apix/ingestion/store.py`,
      },
    },
    {
      problem:
        "Coverage has to be reported against the cells that were expected, and “expected cells” is undefined in the frozen specification.",
      choice:
        "Store no expected-cells table at all, and make publication take the denominator as a required argument with no default.",
      rejected: "A schema field recording what the collector expected to find.",
      why: "Storing the cells we saw and reading them back as the cells we expected is circular. Coverage measured against our own success can never fall, and would report 100% on a day the collector was blocked.",
      consequence:
        "The ambiguity stays open and named rather than being quietly answered by a schema, and no number can be published until someone declares the denominator out loud.",
      source: {
        path: "src/apix/ingestion/store.py",
        href: `${APIX_REPO}/blob/main/src/apix/ingestion/store.py`,
      },
    },
    {
      problem:
        "Missing data is what an index is most easily wrong about, and a store of successful observations cannot describe it.",
      choice:
        "Record an attempt for every search — including ones that failed, and ones never made because an earlier search hit an access challenge.",
      rejected: "Persisting only the observations that were collected.",
      why: "Missingness is measurable only from a record of attempts. Without it, a blocked run and a quiet market produce the same rows.",
      consequence:
        "The exclusion replay can be reconstructed long afterwards, and the two cases stay distinguishable.",
      source: {
        path: "src/apix/ingestion/collectors/runner.py",
        href: `${APIX_REPO}/blob/main/src/apix/ingestion/collectors/runner.py`,
      },
    },
    {
      problem:
        "An automated collector is the convenient path and also the easiest way to contaminate a frozen longitudinal protocol.",
      choice:
        "Tag automated, sandbox and fixture runs in the frame identifier, and admit only primary frames to the index.",
      rejected: "Letting automated runs feed the index once the adapter worked.",
      why: "Adopting automated collection as a production frame is an owner decision recorded in a decision record, not a default that arrives with a working adapter.",
      consequence:
        "The browser path can be exercised freely without any run of it ever becoming index input.",
      source: {
        path: "src/apix/ingestion/collectors/runner.py",
        href: `${APIX_REPO}/blob/main/src/apix/ingestion/collectors/runner.py`,
      },
    },
    {
      problem:
        "Evidence is written at the end of a run, which is exactly when a load can be refused.",
      choice: "Write the run export and manifest before handing anything to the store.",
      rejected: "Exporting after a successful load.",
      why: "A refused load must not also destroy the record of what was collected — that is the run you most need the audit trail for.",
      consequence:
        "The trail survives the failure, and a rejected wave can be examined instead of repeated blind.",
      source: {
        path: "src/apix/ingestion/collectors/runner.py",
        href: `${APIX_REPO}/blob/main/src/apix/ingestion/collectors/runner.py`,
      },
    },
  ],
  challenges: [
    {
      problem:
        "The source is hostile and is entitled to be. Quoted prices move constantly, carriers restrict automated access, and a single undocumented collection decision invalidates a longitudinal series.",
      resolution:
        "Searches are paced, a site error gets exactly one retry, and an access challenge stops that source for the remainder of the run rather than being retried into a block. Every one of those outcomes is recorded as an attempt.",
      source: {
        path: "src/apix/ingestion/collectors/runner.py",
        href: `${APIX_REPO}/blob/main/src/apix/ingestion/collectors/runner.py`,
      },
    },
    {
      problem:
        "A test suite for a collector cannot depend on the thing it collects from.",
      resolution:
        "Roughly 5,100 lines of tests run against fixtures and a sandbox mode, behind a gate that refuses live clearance unless it has been granted explicitly.",
      source: {
        path: "tests/test_collector_runner.py",
        href: `${APIX_REPO}/blob/main/tests/test_collector_runner.py`,
      },
    },
    {
      problem:
        "The repository vendors a large engineering framework that is not the product, and its version numbers and readiness reports describe itself.",
      resolution:
        "The layout states which trees are the framework and which are APIx, file by file, and marks every empty package as a reserved slot rather than working code.",
      source: {
        path: "README.md — repository layout",
        href: `${APIX_REPO}/blob/main/README.md`,
      },
    },
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
  nextIteration: [
    {
      change:
        "Run the second collection wave, so the longitudinal step has a matched t and t−7 pair to compare.",
      why: "The engine is implemented and tested and still publishes nothing, because one wave produces zero matched pairs and the chaining guard refuses an index value without them. The next run is what unlocks the first real number.",
      source: {
        path: "src/apix/statistics/index/chaining.py",
        href: `${APIX_REPO}/blob/main/src/apix/statistics/index/chaining.py`,
      },
    },
    {
      change:
        "Establish a second source and a second route, so the panel stops being one carrier on one sector.",
      why: "National representativeness is recorded as not established. Deduplication and source precedence are implemented but degenerate on a single-source panel — exercised is not validated.",
      source: {
        path: "src/apix/ingestion/collectors/runner.py",
        href: `${APIX_REPO}/blob/main/src/apix/ingestion/collectors/runner.py`,
      },
    },
  ],
  readiness: {
    identification: "verified",
    objective: "verified",
    result: "verified",
    evidence: "verified",
    attribution: "verified",
    architecture: "verified",
    decisions: "verified",
    challenges: "verified",
    nextIteration: "verified",
    lessons: "needs-writing",
  },
};

/* -------------------------------------------------------------- CONTRACT 03 */

export const CONTRACT_VAYU: Contract = {
  ...VAYU,
  designation: contractIndexBySlug("vayu-drishti")!.designation,
  domain: "Geospatial platform",
  level: contractIndexBySlug("vayu-drishti")!.level,
  role: "Platform layer — API, data layer, observability, container environment",
  objective: {
    problem:
      "Satellite observations of air quality are not air quality. Turning Sentinel-5P and ERA5 columns into something a person can act on needs a platform: somewhere to put the data, something to serve it, and enough observability to know when an answer is wrong.",
    whyItMatters:
      "The models are the visible half. Without a data layer, a versioned API and request tracing, a four-person team has no way to tell a modelling error from an ingestion error.",
  },
  architecture: {
    summary:
      "A FastAPI application factory over an async PostGIS data layer, with configuration validated and logging configured before anything else is constructed. The models and the AQI calculation sit on top of this and are not mine. The platform underneath them is.",
    layers: [
      {
        name: "Streamlit dashboard",
        detail:
          "GIS map, charts and report pages — the surface the team's models are actually seen through.",
      },
      {
        name: "Versioned API",
        detail:
          "An /api/v1 router with Pydantic schemas and a service layer, mounted by the application factory rather than by import side effect.",
      },
      {
        name: "Middleware",
        detail:
          "CORS from configuration, and a request-ID that binds a UUID into structlog contextvars and returns to the caller on X-Request-ID.",
      },
      {
        name: "Configuration",
        detail:
          "Pydantic settings validated at import, cached for the process lifetime, with the database URL assembled from separate components.",
      },
      {
        name: "Async data layer",
        detail:
          "SQLAlchemy over asyncpg, with Alembic running migrations through asyncio.run() so there is only ever one PostgreSQL driver.",
      },
      {
        name: "Container environment",
        detail: "The API and its database, defined so the rest of the team can run the platform without configuring it.",
      },
    ],
    flow: [
      { stage: "Startup", detail: "Settings load and logging is configured before any logger exists." },
      { stage: "Request-ID", detail: "A UUID is bound into the logging context for this request." },
      { stage: "CORS", detail: "Origins from configuration; restricted in production." },
      { stage: "v1 router", detail: "Versioned route handlers, typed in and typed out." },
      { stage: "Service", detail: "Business logic, isolated from transport." },
      { stage: "Async session", detail: "A connection from the async engine, released with the request." },
      { stage: "Response", detail: "The trace id returns on X-Request-ID." },
    ],
    source: {
      path: "backend/app/main.py",
      href: `${VAYU_REPO}/blob/main/backend/app/main.py`,
    },
  },
  decisions: [
    {
      problem:
        "Four people are changing four layers, and a log line that cannot be tied to the request that produced it cannot separate a modelling error from an ingestion error.",
      choice:
        "Inject a UUID per request in middleware and bind it into structlog contextvars, returning it on X-Request-ID.",
      rejected: "Per-module logging with no correlation identifier.",
      why: "Binding into contextvars means every line emitted anywhere during that request carries the id without a single call site passing it — through middleware, handlers and services alike. Returning it on the header means the caller can quote the id for their own failed request.",
      consequence:
        "Full request tracing costs one middleware and one header, with no tracing backend to run.",
      source: {
        path: "backend/app/main.py",
        href: `${VAYU_REPO}/blob/main/backend/app/main.py`,
      },
    },
    {
      problem:
        "A misconfigured deployment is most dangerous when it starts successfully.",
      choice:
        "Validate settings at import time, and raise on DEBUG=True with ENVIRONMENT=production in a model validator.",
      rejected: "Reading environment variables where they are needed and checking at use time.",
      why: "The failure has to happen before the application accepts a request. A check at the point of use fires after the thing it was guarding has already been exposed.",
      consequence:
        "A bad environment is a startup crash naming the field, rather than a production server running with debug behaviour and interactive docs exposed.",
      source: {
        path: "backend/app/core/config.py",
        href: `${VAYU_REPO}/blob/main/backend/app/core/config.py`,
      },
    },
    {
      problem:
        "A database URL is a single opaque string containing credentials, and it gets logged, pasted and copied.",
      choice:
        "Derive it as a computed field from separate components, encoding user and password with quote_plus.",
      rejected: "Accepting a raw connection string from the environment.",
      why: "Special characters in a password corrupt a hand-assembled URL, and a single opaque variable makes accidental exposure the easy path rather than the careless one.",
      consequence:
        "Credentials are ordinary separate settings; the connection string is derived and never authored by hand.",
      source: {
        path: "backend/app/core/config.py",
        href: `${VAYU_REPO}/blob/main/backend/app/core/config.py`,
      },
    },
    {
      problem:
        "Alembic conventionally wants a synchronous driver, which would put a second PostgreSQL driver into a project that is otherwise entirely async.",
      choice:
        "Run migrations through asyncio.run() with an async engine, keeping asyncpg as the only driver.",
      rejected: "Installing psycopg2 alongside asyncpg for migrations.",
      why: "Two drivers means two connection behaviours, two sets of type adapters and a second thing to keep configured — for a task that runs a handful of times.",
      consequence:
        "One driver and one URL. Migrations execute on the same stack the application runs on, so a migration that works is evidence the application's connection settings work.",
      source: {
        path: "backend/requirements.txt",
        href: `${VAYU_REPO}/blob/main/backend/requirements.txt`,
      },
    },
    {
      problem:
        "Interactive API documentation is the fastest way for a team to learn an API and an inventory of the surface for anyone else.",
      choice: "Serve /docs and /redoc in development and staging, and disable them in production.",
      rejected: "Leaving them enabled everywhere because they are useful.",
      why: "The people who need them are not in production, and the environment already knows which one it is — so the decision can be made by configuration rather than by remembering.",
      consequence:
        "The team keeps the documentation; production does not publish its own route inventory.",
      source: {
        path: "backend/app/main.py",
        href: `${VAYU_REPO}/blob/main/backend/app/main.py`,
      },
    },
  ],
  challenges: [
    {
      problem:
        "Three of the four people on the project never touch the platform, and their work has to attach to it without editing it.",
      resolution:
        "An application factory rather than a module-level app, a versioned router, and typed schemas at the boundary — so a model or an endpoint is added by registration, and tests can build an application with custom settings without affecting any other test.",
      source: {
        path: "backend/app/main.py",
        href: `${VAYU_REPO}/blob/main/backend/app/main.py`,
      },
    },
    {
      problem:
        "Observability has an ordering problem: any logger created before logging is configured is configured wrongly, and will be for the life of the process.",
      resolution:
        "Settings load and logging is configured as the first module-level actions in the entry point, before the factory runs and before any logger is created.",
      source: {
        path: "backend/app/main.py",
        href: `${VAYU_REPO}/blob/main/backend/app/main.py`,
      },
    },
  ],
  nextIteration: [
    {
      change:
        "Fill the lifespan hook: database pool warm-up, model loading and background task startup.",
      why: "The lifespan context manager is in place and the code says that is where those belong, but it does nothing yet — so the first request after a deploy currently pays for a cold pool.",
      source: {
        path: "backend/app/main.py",
        href: `${VAYU_REPO}/blob/main/backend/app/main.py`,
      },
    },
  ],
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
    architecture: "verified",
    decisions: "verified",
    challenges: "verified",
    nextIteration: "verified",
    lessons: "needs-writing",
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
