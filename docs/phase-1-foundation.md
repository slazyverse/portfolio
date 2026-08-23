# Phase 1 — Evidence, Content, Architecture

**Subject:** Sagar Tailor · `github.com/slazyverse` · sagar885402@gmail.com
**Audit date:** 2026-08-22 · **Method:** GitHub REST API, full repository trees, per-commit authorship, source reading, live-URL verification

---

## 0. Read this first

I audited every public repository at commit level — not READMEs. Three findings change the shape of this project, and you need to rule on them before Phase 2.

**Finding 1 — The evidence base is 2 real projects, not 4.**
Your account has 4 public repos. One is a profile README. One (`Neoparts_Oracle`) is a single squashed commit of someone else's project (details in §1.3). That leaves **`deadlockd`** and **`AKASH`** as genuine, verifiable engineering work.

**Finding 2 — Your brief asks for sections the evidence cannot fill.**
The brief lists Research, Hackathons, Open Source Contributions, Experience, Achievements. On the public record there is: no hackathon repo, no external PR, no employment, no publication, and no starred or forked work (highest star count across your repos: 0). Building those sections means writing fiction. That is the fastest way to lose a reviewer who checks — and the reviewers you want *will* check.

**Finding 3 — The two real projects share a theme strong enough to carry the whole site.**
In both, you built the *platform layer* — the substrate other people's work runs on. That is a genuinely differentiated position and it is fully provable. §3 develops it.

**Recommendation:** build a deep, evidence-linked, 2-project portfolio rather than a wide 12-section one. Depth is defensible; breadth is not. Everything below assumes that decision, which is yours to overturn.

---

## 1. Repository audit

### 1.1 `deadlockd` — flagship, sole-authored

`github.com/slazyverse/deadlockd` · Go + TypeScript · MIT · **live: https://deadlockd.vercel.app — 200 OK, verified**

| | |
|---|---|
| Authorship | **6 / 6 commits yours.** Sole contributor. |
| Window | 2026-04-04 → 2026-04-07 (built in ~3 days) |
| Languages | Go 32.1 KB · TypeScript 28.7 KB · CSS · Dockerfile |
| Origin | Ships `Deadlockd_CA2_Report.docx` — LPU CA2 coursework, taken well past coursework scope |

**What it actually is.** A real-time deadlock simulation and concurrency visualiser. A Go backend runs the simulation; a Next.js frontend renders a live resource-allocation graph over a WebSocket bridge.

**Architecture — read from source, not the README:**

- `backend/engine/` — `banker.go`, `detection.go`, `graph.go`, `manager.go`, `state.go`, `recovery.go`, `scenarios.go`, `nightmare.go`
- `backend/api/` — `hub.go`, `websocket.go` (hub-and-spoke WebSocket fan-out)
- `frontend/app/` — component-per-panel, `useDeadlockSocket.ts` custom hook, typed `types/index.ts`, React Flow (`@xyflow/react`) for the graph
- Next.js 16 · React 19 · Tailwind v4 · TS strict · Docker + compose · GitHub Actions CI

**Engineering quality — specific, verifiable observations:**

- `IsSafeState()` copies `Need` / `Allocation` under mutex, then **releases the lock before running the O(P²·R) search**. The expensive computation runs on a snapshot rather than while holding the lock — a deliberate, correct concurrency decision.
- `DetectDeadlock()` uses an **explicit-stack iterative DFS** with white/gray/black colouring instead of recursion — no stack-depth risk — and recovers the actual cycle through a parent array.
- Complexity is documented in the function header (`O(P²·R)` time, `O(P·R)` space), and the space bound is justified: transient copies *to avoid mutating core state*.
- `SystemState` carries a thread-safety contract in its doc comment, naming the invariant callers must hold.
- **Tests assert real behaviour.** `scenarios_test.go` checks that `CIRCULAR_WAIT` produces a non-empty cycle, and that a granted safe request moves `Available`, `Allocation`, and `Need` to exact expected values. Correctness tests, not smoke tests.
- CI runs `go mod verify` + `go test -v ./...`, plus a separate frontend `npm ci && npm run build` gate.

**Honest weaknesses.** Single-package `engine` with exported globals (`BuiltInScenarios`); no linter in CI (`golangci-lint` absent); no frontend tests; coverage is scenario-level only. The README overclaims a little ("60fps unthrottled"; a commit message says "FAANG-level enhancements") — worth toning down on the site.

**Verdict:** the strongest artefact you own. Correctness-critical algorithms, honest concurrency reasoning, tested, containerised, CI'd, deployed. This is the hero project.

---

### 1.2 `AKASH` / VAYU-DRISHTI — team project, you own the platform layer

`github.com/slazyverse/AKASH-Atmospheric-Knowledge-AQI-from-Satellite-Harmonics-` · Python · repo owner: you

| | |
|---|---|
| Team | 4 contributors — yeshika-02 (26 commits), Soumyadeb (10, across 2 accounts), **you (4)** |
| Window | 2026-07-02 → 2026-07-24 |
| Process | Feature branches (`feature/soumyadeb/*`), PRs #1–#5 merged, issue tracker in use, `CHANGELOG.md`, `PROJECT_CONFIG.yaml` |

**Commit count understates you badly.** Your 4 commits are **~11,700 lines across 116 files**, and they are the entire backend and visualisation platform:

| Commit | Scope | Size |
|---|---|---|
| `feat(release)` · 07-07 | Backend foundation + dashboard skeleton | +6,731 / 69 files |
| `feat(day3)` · 07-07 | Live API integration + production hardening | +2,599 / 30 files |
| `feat(day4)` · 07-08 | GIS visualisation + production dashboard | +1,854 / 16 files |

**What you specifically built:**

- **FastAPI backend** — application-factory pattern, `lifespan` context manager (not the deprecated `on_event`), versioned `/api/v1` router, 6 endpoint modules (aqi, fire, forecast, hcho, stations, health), 7 Pydantic schema modules, 6 service modules.
- **Configuration** — Pydantic `BaseSettings`, `@lru_cache` single-parse, `computed_field` DATABASE_URL assembled from parts with `quote_plus` credential encoding, and a `model_validator` that **refuses to boot on `DEBUG=True` + `ENVIRONMENT=production`**.
- **Observability** — `structlog` JSON logging plus request-ID middleware binding a UUID into `contextvars`, so every log line in a request is traceable; `X-Request-ID` on every response.
- **Data layer** — async SQLAlchemy 2.0 + asyncpg; Alembic migrations run through `asyncio.run()` + `create_async_engine()`, deliberately dropping psycopg2 so the project carries one driver instead of two; PostGIS extension migration; GeoAlchemy2.
- **Abstractions** — `BaseService[T]`, a generic ABC with SOLID rationale written out per-principle in the docstring; `COGRasterInterface` / `RasterMetadata` defining Cloud-Optimized-GeoTIFF contracts as extension points for later sprints.
- **Dashboard** — Streamlit: `charts.py` (604 lines), `map.py` (531 lines, Folium), 7 pages including explainable-AI and reports, a services layer mirroring the backend API, and explicit loading / empty / error state components.
- **Ops** — Dockerfile, docker-compose, entrypoint, `init-db.sql`, pytest with `conftest.py` fixtures, `pyproject.toml`, and dependencies pinned to exact patch versions **with a written justification per dependency**.

**Standout signal.** Your `requirements.txt` explains why each dependency exists and why psycopg2 is deliberately absent. Your `main.py` header lists design decisions with reasoning. This is architectural writing, and it is rare at your stage.

**Honest weaknesses.** The root README is one line — the project's front door is empty. Naming is inconsistent (`AKASH` vs `VAYU-DRISHTI`). Your GIS layer defines *interfaces* with implementations deferred to "Day 5". Two issues remain open. `PROJECT_CONFIG.yaml` declares an agent/quality-gate scaffold whose gates are not enforced in CI.

**Verdict:** a legitimate second project, on one condition — it is **framed as team work with your layer named explicitly.** Present it as solo and it becomes a liability: the commit history is public and takes thirty seconds to check.

---

### 1.3 `Neoparts_Oracle` — cannot go on the site

A single commit, 2026-08-12: *"Initial commit: Baseline AdityaNet platform setup for slazyverse"* — 30 MB dropped in one push. The README is AdityaNet's, its CI badges point at `slazyverse/AdityaNet` (**404 — does not exist**), and the same project lives at `Rexy-5097/AdityaNet` with real incremental history.

There is no authorship evidence for you in this repository. Putting it on the portfolio is unbounded downside for zero upside: any reviewer who opens the commit list sees one squashed commit importing a teammate's project.

**Recommendation:** exclude it, and either delete it or rename-and-archive it honestly (e.g. `adityanet-study`) so it is not sitting on your profile looking like a claim. If you did contribute to AdityaNet, the fix is contributing to `Rexy-5097/AdityaNet`, where attribution is real.

---

### 1.4 `slazyverse/slazyverse` — profile README, currently broken

The prose is good. But it ships **unreplaced placeholders in production**: `YOUR_GITHUB_USERNAME` in both stats-card URLs, so the cards render wrong, and `YOUR_LINKEDIN_URL` / `YOUR_GITHUB_URL` / `YOUR_EMAIL` in the Connect badges. It also lists four projects — **YottaBoost AI**, **AI-Based System Performance Prediction**, **Surface AQI / HCHO**, and **SLAZY Gaming & Esports** — of which only the third has a public repo.

Fix this before the portfolio ships: it is the first thing anyone following a link from the site will land on. Two of those projects are worth pushing as real repos if the code exists — see §6.

---

### 1.5 Aggregate profile signal

| Metric | Value |
|---|---|
| Account created | 2024-11-17 |
| Public repos | 4 (2 substantive) |
| Total stars received | **0** |
| Followers | 2 |
| Forks of your work | 0 |
| External contributions / PRs to other orgs | **none found** |
| Languages by bytes (excl. Neoparts) | Python ~879 KB · Go 32 KB · TypeScript 29 KB |
| Live deployments verified | 1 — deadlockd |

Do **not** put a GitHub-stats widget or contribution graph on this site. At 0 stars and 4 repos, it argues against you. Replace it with per-project engineering metrics you *do* win on — test count, CI gates, complexity bounds, container build, deploy status. See §5, section 07.

---

## 2. Cross-cutting technical profile

**Demonstrated, evidence-backed:**

- **Go** — concurrency, mutex discipline, graph algorithms, WebSocket hubs, behavioural tests
- **Python** — FastAPI, async SQLAlchemy 2.0 + asyncpg, Pydantic v2 / BaseSettings, Alembic, structlog, pytest
- **TypeScript / React** — Next.js 16, React 19, custom hooks, typed socket state, React Flow, Tailwind v4
- **Data / GIS** — PostGIS, GeoAlchemy2, Folium, COG raster contracts, satellite pipelines (integrated, not authored)
- **Ops** — Docker, docker-compose, GitHub Actions, Vercel, exact-pin dependency management

**Claimed on your profile, not yet provable:** PyTorch, scikit-learn, MySQL, MongoDB, Node.js, deep learning. Either ship a repo or drop them from the site — a stack list with unbacked entries devalues the entries that *are* backed.

**The real differentiator.** You write down *why*. Complexity bounds in function headers. Per-dependency justification. SOLID rationale per principle. A config validator that refuses to boot on a dangerous combination. Most portfolios at this level show that code runs; yours can show that decisions were reasoned. **That is what to build the site around.**

---

## 3. Positioning

### Statement

> **Sagar Tailor builds the layer underneath** — the concurrency engine, the API foundation, the migration path, the request trace, and the surface that makes someone else's data legible.

This is not a slogan; it is what the commit history literally shows. In `deadlockd` he wrote the engine that computes safety and the socket layer that streams it. In VAYU-DRISHTI he wrote the backend, the observability, the data layer, and the entire dashboard — the substrate three other people's ML work runs on and is seen through.

### Why this works

1. **It is true and checkable at commit level.**
2. **It resolves the team-project problem.** "I own the platform layer" turns a 4-of-45-commits statistic from a weakness into a precise claim.
3. **It gives Phases 2–4 a narrative spine.** A site about *layers* has a natural cinematic structure: descend from surface → interface → engine → substrate. Motion then serves the argument instead of decorating it. Phase 2 will develop this; it is flagged here so the IA supports it.
4. **It is not a stock student position.** "Full-stack developer passionate about AI/ML" is the default. This is not.

### A note on originality

`Rexy-5097/proof-of-work` is a portfolio built on "every claim links to its evidence." Your collaborator already owns that concept publicly. We will use evidence-linking as a *mechanic* — it is just intellectual honesty — but the site's identity must be the layer/substrate idea, not proof-of-work. Phase 2 will stay clear of it.

---

## 4. Portfolio copy — draft, evidence-linked

### Biography, short

Sagar Tailor is a Computer Science and Engineering student at Lovely Professional University who builds backend systems and the platform layers that sit under them. His work runs from a Go concurrency engine implementing Banker's Algorithm and cycle-based deadlock detection, to a production-shaped FastAPI service with async Postgres/PostGIS, structured request tracing, and containerised deployment.

### Biography, long

Sagar works on the parts of software that other work depends on.

In `deadlockd`, a real-time deadlock simulator, that meant a Go engine where the safety check copies system state under mutex and then releases the lock before running its O(P²·R) search, and where cycle detection uses an explicit-stack DFS instead of recursion. Correctness and concurrency are the product; the visualiser exists to make them observable.

In VAYU-DRISHTI, a four-person satellite air-quality platform, it meant owning the layer everyone else built on: a FastAPI application factory, async SQLAlchemy over asyncpg, Alembic migrations enabling PostGIS, structlog request-ID tracing, a Docker and compose environment, and the Streamlit dashboard and GIS layer that turned the team's models into something a person could read.

The habit connecting them is writing the reasoning down. Complexity bounds live in function headers. Dependencies carry a line explaining why they exist and why the alternative was rejected. The configuration layer refuses to start the server on a production-plus-debug combination rather than trusting that it will not happen.

He is looking for backend and systems work where correctness matters more than surface area.

### Engineering philosophy — four principles, each earned

1. **A decision that isn't written down didn't happen.** — per-dependency justification in `requirements.txt`; the design-decisions header in `main.py`; documented complexity bounds.
2. **Make the failure impossible, not unlikely.** — the `model_validator` rejecting `DEBUG=True` in production at import time, before the server accepts a request.
3. **Hold the lock as briefly as you can.** — `IsSafeState` snapshots under mutex, then computes outside it.
4. **A system you cannot observe is a system you cannot operate.** — request-ID middleware bound into structlog contextvars; explicit loading, empty, and error states in the dashboard.

### Timeline — verifiable dates only

- **Nov 2024** — GitHub account created; B.Tech CSE at LPU
- **Apr 2026** — `deadlockd` designed, built, tested, containerised, and deployed within a 3-day window
- **Jul 2026** — VAYU-DRISHTI: backend foundation, live API integration, GIS dashboard — ~11.7k lines across 116 files, in three commits over 48 hours
- **Jul 2026** — team scaled to four; PR and issue workflow established on the repo he owns

### Copy rules for every section

No "passionate." No "cutting-edge." No "leveraging." No invented metrics, no claimed users. Numbers appear only where they are countable from the repository — lines, files, commits, complexity, test count, endpoint count. Every project claim carries a link to the file or commit that proves it.

---

## 5. Information architecture

Nine sections. Every one is backed by evidence that exists today.

| # | Section | Purpose | Backed by |
|---|---|---|---|
| 01 | **Entry** | Name, the layer-underneath claim, one line of proof. No scroll-hint theatre. | — |
| 02 | **Position** | The paragraph in §3 — what he builds, and why it is a category rather than a job title. | §3 |
| 03 | **deadlockd** — case study | Full depth: problem → engine → concurrency decision → tests → deploy. Live embed. | §1.1 |
| 04 | **VAYU-DRISHTI** — case study | Framed as team work; his layer named and diagrammed distinctly from the ML layer. | §1.2 |
| 05 | **How it's built** | The four principles, each with the real code excerpt that earned it. **The section that wins the site.** | §4 |
| 06 | **Stack** | Two tiers — *shipped in production* vs *working knowledge*. An honest split, not a logo wall. | §2 |
| 07 | **Engineering record** | Replaces GitHub stats. Per project: tests, CI gates, container, complexity, deploy status, live check. | §1.5 |
| 08 | **Now** | What he is building and what he is looking for. Short, present tense. | — |
| 09 | **Contact / Footer** | Email, GitHub, LinkedIn, résumé. | — |

**Cut from the brief, with reason:** Experience (none), Research (none published), Hackathons (no repository), Open Source Contributions (no external PRs), Achievements (nothing verifiable), an All-Projects grid (two projects is not a grid — it is two case studies), and the GitHub Statistics widget (§1.5).

**Held for later:** a Writing / Notes section. If you publish three or four short technical notes, it becomes the strongest addition available to you — the one section you can fill by choice rather than by waiting.

---

## 6. Actions that would materially strengthen this — ranked

1. **Push YottaBoost AI and the system-performance-prediction work as real repositories.** Your profile claims them and nothing backs them. If that code exists locally, this is the highest-leverage hour available: it converts the ML half of your stack from claim to evidence and takes the site from two case studies to four.
2. **Write the AKASH root README.** One line is an empty front door on your second-best project.
3. **Fix the profile README placeholders** — broken stat cards and `YOUR_LINKEDIN_URL` currently live.
4. **Resolve `Neoparts_Oracle`** — delete, or rename and archive with an honest description.
5. **Add `golangci-lint` to deadlockd CI** — roughly ten lines, and it completes the CI story.
6. **Confirm your LinkedIn URL.** You gave two: the text read `linkedin.com/in/slazyverse/`, the link resolved to `linkedin.com/in/soumyadeb-tripathy/`. I will use **slazyverse** unless you say otherwise.

---

## 7. Decisions needed before Phase 2

1. **Scope** — the depth-over-breadth 9-section IA above? Or the full brief structure, accepting that several sections will be thin or unevidenced?
2. **AKASH framing** — confirm it ships as *team project, platform layer owned by you*.
3. **`Neoparts_Oracle`** — confirm exclusion.
4. **YottaBoost / performance-prediction** — does that code exist? If yes, push it and I will fold both in as case studies before design starts.
5. **Positioning** — does "builds the layer underneath" fit how you want to be read? It shapes everything downstream.
6. **LinkedIn** — confirm the handle.
