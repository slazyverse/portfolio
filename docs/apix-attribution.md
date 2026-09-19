# APIx — attribution record

Provenance research for a future SUBSTRATE contract entry. Produced during
Phase 1 (Ground Repair). **No portfolio copy has been written from this yet.**

Every figure below was derived from the repository's own git history, not from
recollection. The method is recorded so it can be re-run and disputed.

- **Repository:** <https://github.com/Rexy-5097/apix> — public, MIT, not a fork
- **Researched:** 2026-09-19, at `main` = `6426424`
- **Method:** full clone, `git log main --numstat`, identities merged by email

---

## 1. What the project is

> A quality-adjusted, high-frequency airfare price index for India — and the
> auditable infrastructure that produces it.

Built against **MoSPI problem statement 26056**, Data Informatics & Innovation
Division. Python. Created 2026-09-08, last pushed 2026-09-18.

The repository describes itself as a *hackathon prototype* and is unusually
candid about its limits — the README's own status table records the index value
as `PENDING`, the TPD estimator as `specified, NOT implemented`, uncertainty
intervals as `NOT implemented`, and national representativeness as
`not established`. That honesty is itself worth noting: it matches the
editorial standard the portfolio already holds itself to.

---

## 2. Contribution — measured

Commits on `main` only. Multiple git identities per person merged by email
(`slazyverse`, `sagar885402@gmail.com`, and the two `users.noreply` forms all
resolve to Sagar).

| Contributor | Commits | Share | Lines added | Files | Active |
|---|---:|---:|---:|---:|---|
| **Sagar Tailor** | **16 / 29** | **55%** | +50,935 | 167 | 2026-09-11 → 09-18 |
| Soumyadeb Tripathy | 8 / 29 | 28% | +46,973 | 493 | 2026-09-08 → 09-11 |
| Basant Bhushan | 5 / 29 | 17% | +5,793 | 22 | 2026-09-14 |

**Pull requests:** 32 opened in total, **18 by Sagar** (17 merged, 1 closed).

### The line count needs qualifying before it is ever published

The raw `+50,935` is not a code contribution figure and must not be presented
as one. Broken down by file type:

| Type | Lines | Files | What it is |
|---|---:|---:|---|
| `.json` | 22,878 | 13 | **Generated data artifacts.** Excluded from any claim. |
| `.py` | **18,921** | **72** | Application code and tests |
| `.md` | 6,400 | 65 | Documentation and decision records |
| `.yaml` | 1,519 | 3 | Configuration |
| `.html` | 813 | 2 | Dashboard output |

**The defensible headline is ~18,900 lines of Python across 72 files**, plus
~6,400 lines of documentation. Thirteen JSON artifacts account for 45% of the
raw total and are machine-generated.

---

## 3. What Sagar actually owns

Sole author (no other contributor appears in these files' history):

| Module | Lines | Subsystem |
|---|---:|---|
| `src/apix/ingestion/store.py` | 797 | Observation storage |
| `src/apix/ingestion/collectors/runner.py` | 730 | Collector execution |
| `src/apix/ingestion/collectors/indigo/parse.py` | 468 | IndiGo NDC parsing |
| `src/apix/ingestion/collectors/indigo/live.py` | 352 | Live acquisition |
| `src/apix/scheduling/scheduler.py` | 384 | Collection scheduling |
| `tools/analysis/execution_boundary.py` | 548 | Execution boundary analysis |
| `tools/analysis/replay_exclusions.py` | 522 | Exclusion replay |
| `tools/collection/load_manual.py` | 526 | Manual collection loader |
| `tools/analysis/build_panel_json.py` | 426 | Panel construction |
| `tools/analysis/pull_alliance_tariff.py` | 413 | Reference tariff |
| `tools/collection/collect_auto.py` | 393 | Automated collection |

Shared: `tools/analysis/build_dashboard.py` (933 lines, with Basant Bhushan).

**Test suite authored by Sagar — roughly 5,100 lines:**
`test_observed_panel` (680), `test_collector_runner` (671),
`test_manual_loader` (588), `test_platform` (558),
`test_execution_boundary` (519), `test_collector_ndc_boundary` (486),
`test_collector_contract_and_parse` (428), `test_collector_selection` (424),
`test_reference_tariff` (383), `test_collection_contract` (363).

**Feature ownership is also visible in the branch names** — 15 branches are
prefixed `feat/slazy/` or `docs/slazy/`: `automated-collection`,
`collection-contract`, `day-1-storage`, `day-1-acquisition`,
`execution-boundary`, `indigo-ndc`, `jury-dashboard`, `loopback-browser-proof`,
`ps26056-platform`, `source-register-audit`, `tariff-reference-and-permissions`,
`claim-wording-pass`, `credibility-freeze`, `p0-sanitization`,
`repository-clarity-pass`.

### The one-sentence version

**Sagar owns the data acquisition and ingestion layer, the collection
tooling, the analysis/verification tooling, and most of the test suite** —
the boundary where the system meets real, untrusted, external market data.

This maps directly onto the portfolio's existing thesis. It is the layer
underneath, again, in a third independent project.

---

## 4. Verified / not verified

| Claim | Status | Evidence |
|---|---|---|
| Repo is public, MIT, not a fork | **VERIFIED** | GitHub API |
| Built against MoSPI PS 26056 | **VERIFIED** | Stated in `README.md`, `AGENTS.md`, and 4 ADRs |
| 16 of 29 commits on `main` | **VERIFIED** | `git shortlog -sne main` |
| 18 of 32 PRs | **VERIFIED** | GitHub PR API |
| ~18,900 lines of Python, 72 files | **VERIFIED** | `git log --numstat`, filtered by extension |
| Sole authorship of ingestion modules | **VERIFIED** | Per-file `git log` author set |
| **Smart India Hackathon submission** | **NOT VERIFIED** | The only trace is a teammate's local path (`D:\WorkSpace\SIH\...`) embedded in two committed docs. Suggestive, not probative. **Do not assert SIH in portfolio copy without a citable source** — an event listing, a submission record, or a certificate. |
| Project is production-ready | **VERIFIED FALSE** | The README explicitly states it is not, on five separate axes |

---

## 5. Guidance for the eventual contract entry

1. **Claim the layer, not the project.** The VAYU-DRISHTI entry already does
   this well and reads as confidence rather than hedging. Repeat the pattern.
2. **Lead with ~18,900 lines of Python across 72 files** and the named
   subsystems. Never cite the raw 50,935.
3. **The test suite is the strongest single fact** — ~5,100 lines of tests
   against an external, unreliable data source is a better argument than any
   feature list.
4. **Do not claim SIH** until it can carry a `[VERIFY ↗]` link like every
   other claim on the site. If it cannot be sourced, the MoSPI problem
   statement is a stronger and fully verifiable framing anyway.
5. **The repository's honesty is an asset.** A project that refuses to publish
   an index it cannot yet justify is exactly the engineering temperament the
   portfolio argues for. Consider quoting the status table.
