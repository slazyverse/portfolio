# Phase 3 — Routing and content model

The information architecture the rest of SUBSTRATE will be built on. Nine real
routes, a contract model with provenance and attribution, and the evidence
index that makes the site's central claim checkable in one place.

**Not in this phase:** the environment, SystemChrome, the cinematic landing,
the command palette, live telemetry. Phase 3 builds the structure those will
attach to.

---

## Route architecture

One canonical table in `src/data/routes.ts`. Everything reads from it —
navigation, `document.title`, metadata, the sitemap, route announcements — so
a route cannot end up indexed when the table says otherwise, or carry a title
that no longer matches its nav label.

| Route | Level | Display | Conventional | Indexed |
|---|---|---|---|---|
| `/` | surface | SIGNAL | home | yes |
| `/dossier` | interface | DOSSIER | profile | yes |
| `/systems` | interface | SYSTEMS | skills & stack | yes |
| `/contracts` | engine | CONTRACTS | projects | yes |
| `/contracts/[slug]` | engine | CONTRACT ## | project | yes |
| `/record` | substrate | RECORD | engineering record | yes |
| `/colophon` | substrate | COLOPHON | how this site is built | yes |
| `/verify` | substrate | VERIFY | evidence index | yes |
| `/contact` | substrate | COMMS | contact | yes |
| `/cv.pdf` | substrate | DOSSIER EXPORT | CV | **unavailable** |
| `/system` | substrate | SYSTEM REFERENCE | design system | noindex |

`id` is the stable join key, not the path. Paths can be restyled; ids must not
churn, because navigation, the level rail and eventually a location in a
generated environment will all be keyed off them.

### Dual register is permanent

Every route carries both names. `display` is the in-world one and
`conventional` is what everyone else calls the thing — and the conventional
name is what becomes the accessible name, the document title and the meta
description.

The theme is atmosphere. It is never a lock on the content. A browser tab
reading "CONTRACTS", or a screen reader announcing it, would cost exactly the
reader this site is for. A test asserts both registers exist on every route and
that they are not identical.

### `/cv.pdf` is declared unavailable, not omitted

There is no CV document. The route is reserved and marked `available: false`,
which keeps it out of navigation and the sitemap, and `/contact` says plainly
that none exists rather than linking to a 404. On a site whose premise is that
every statement is checkable, a link to a résumé that does not exist is the
wrong kind of lie.

---

## Content model

Extended, not replaced. The rule governing the original types governs the new
ones: **a statement about the work cannot be expressed without its evidence.**
`Decision` and `ResultClaim` both require a `Source` for that reason.

New types in `src/data/types.ts`:

- `Contract extends Project` — designation, level, objective, role,
  architecture, decisions, challenges, result, attribution, lessons,
  nextIteration, readiness
- `Decision` — choice, **rejected alternative**, why, and a mandatory source
- `Attribution` — model, summary, entries, `notClaimed`, collaborators, evidence
- `ContentState` — `verified` · `needs-source` · `needs-writing` · `not-available`

Every new field on `Contract` is optional on purpose. A half-written contract
should be a **smaller** contract, never one padded out with invention. Sections
with no content do not render; the page lists what is still missing instead.

### `notClaimed` is the important field

On a team project, stating plainly what is *not* yours reads as confidence. A
vague "collaborated on" reads as hedging, and an unqualified claim is simply
false. A test enforces it: any contract with `model: "team"` must have at least
one entry that is not the author's, and must state what it does not claim.

---

## Contracts

| Designation | Project | Model | Contribution |
|---|---|---|---|
| CONTRACT 01 | deadlockd | sole | 6 of 6 commits |
| CONTRACT 02 | APIx | team | 16 of 29 commits, 18 of 32 PRs |
| CONTRACT 03 | VAYU-DRISHTI | team | platform layer |

### APIx

Every figure comes from `docs/apix-attribution.md`, derived from the
repository's git history rather than recollection. Two things are deliberately
absent, and both are enforced by tests:

**The Smart India Hackathon association is not claimed.** The only trace is a
teammate's local directory path in two committed files — suggestive, not
probative. A test asserts the string never appears in the contract record. The
MoSPI problem statement is fully verifiable and is a stronger framing anyway.

**The raw +50,935 line count is not used anywhere.** 22,878 of those lines are
thirteen generated JSON artifacts; quoting the total would overstate the
contribution by roughly half. The published figure is ~18,900 lines of Python
across 72 files, of which ~5,100 are tests. A test asserts the raw number never
appears.

---

## The evidence index

`/verify` is generated from the typed records, not maintained beside them. A
hand-written index would be wrong within a month and worth nothing the moment
it was. Adding a sourced claim to a contract adds it to the index; there is no
second place to update.

It collects claims, decisions, attribution rows and principles — anything that
asserts something and carries a `Source`. A test asserts that every source
`/verify` displays exists in an underlying record, so the page cannot invent or
mutate an entry.

Deliberately not a search interface. Filtering would be a feature; being
complete and checkable is the point.

---

## Routing behaviour

**Static generation.** All eleven routes prerender, and the three contracts use
`generateStaticParams`. A portfolio has no reason to resolve its own content at
request time and one good reason not to: a static page cannot fail in front of
a reader.

**Unknown slugs 404.** `/contracts/does-not-exist` returns a real 404 status and
the not-found page — never an empty shell.

**Focus and announcement.** Client navigation does not reload the document, so
`RouteAnnouncer` moves focus to `#main` and announces the new route by its
conventional name. Without it a screen-reader user hears nothing and a keyboard
user is left focused on a link that no longer exists.

**View transitions.** `withViewTransition()` in `src/lib/view-transition.ts` —
feature-detected, skipped under reduced motion, and non-blocking. The failure
mode designed out is a navigation that waits on an animation. Zero
dependencies; it is a browser API. The cinematic treatment comes later.

---

## An accessibility defect found and fixed

The reduced-motion block suppressed `animation` but not `transition`, so the
body's **1.2s full-viewport background fade still ran for reduced-motion
users**. axe caught it mid-fade, at 17.6% alpha, on the slower on-demand 404
route.

Suppressed outright rather than shortened. The fix is deliberately narrow:
Phase 2 established that hover feedback keeps its colour transition under
reduced motion, because a page whose controls stop responding reads as broken.
Page-level atmosphere goes; a control acknowledging a pointer stays.

---

## Content gap report

Generated from each contract's `readiness` ledger. This is what Phase 7 needs.

| Section | deadlockd | APIx | VAYU-DRISHTI |
|---|---|---|---|
| identification | verified | verified | verified |
| objective | verified | verified | verified |
| result | verified | verified | verified |
| evidence | verified | verified | verified |
| attribution | verified | verified | verified |
| architecture | needs-writing | needs-writing | needs-writing |
| decisions | needs-writing | needs-writing | needs-writing |
| challenges | needs-writing | needs-writing | needs-writing |
| lessons | needs-writing | needs-writing | needs-writing |
| nextIteration | needs-writing | needs-writing | needs-writing |

**Nothing is `needs-source`** — every claim currently published carries one.
Everything outstanding is `needs-writing`, which is the honest state: the
material exists in the repositories, it has not been written up.

**The highest-value gap is `decisions`.** "I chose X over Y, for this reason,
and here is the commit" is the most convincing thing an engineer can show, and
almost no portfolio has it. The type already requires a source on every
decision, so the structure is ready — what is missing is the writing, and it
cannot be generated. It has to be recalled by the person who made the choices.

Also outstanding, outside the contracts:

- **No CV document.** The route is reserved and marked unavailable.
- **`/systems` has no evidence links per capability.** Each entry names where
  it shipped, but does not yet link to it.
- **The colophon's figures are build-time, not live.** Presenting them as live
  telemetry would require runtime instrumentation that does not exist; they are
  labelled as measured at the Phase 3 build instead.

---

## Future environment contract

Recorded now so the boundary is not negotiated later under pressure.

**The environment owns:** atmosphere, depth, the sense of a world, navigation
affordance, cinematic context.

**The DOM owns:** the content, the text, the controls, the links, accessibility
and SEO.

**The environment must never become the only way to reach information.** Every
route works, is readable and is indexable with no environment at all — which is
exactly the state Phase 3 leaves it in. A generated city can later map a
location to a route id, a building to a contract slug and a level to
`data-level`, without any of those needing to change.

---

## Results

| Metric | Phase 2 | Phase 3 | Budget |
|---|---:|---:|---:|
| Initial JS (gz) | 189.4 KB | **187.6 KB** | 200 KB |
| Lazy WebGL (gz) | 268.9 KB | 268.9 KB | 300 KB |
| CSS (gz) | 9.3 KB | 9.5 KB | 16 KB |
| Routes | 6 | **11** | — |
| Unit + content tests | 142 | **172** | — |
| a11y assertions | 28 | **56** | — |
| Runtime dependencies | 6 | 6 | — |

Initial JS went **down** while adding eight routes: the home page no longer
carries navigation markup it was rendering inline, and no library was added.

---

## Carried into Phase 4

1. **`SiteNav` is still plain.** SystemChrome — the persistent status bar,
   level rail and command palette — is Phase 4. Building a throwaway version
   here would mean designing the same thing twice.
2. **`DepthRail` still reads `data-stratum`**, via the Phase 2 compatibility
   shim. It goes when SystemChrome lands.
3. **`--scrolled` is still never written**, so the nav's condense-on-scroll
   remains inert. `SiteNav` is replaced in Phase 4; not worth touching twice.
4. **The home page is untouched.** It is still the single-page descent and does
   not yet use `PageShell` or the level scope. The cinematic landing is Phase 6.
5. **`aria-live` on a perpetual timer** in `AllocationGraph` still announces
   every 2.6 to 4.2 seconds. Needs a design decision, not a repair.
