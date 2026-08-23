# Phase 2 — Creative Direction & Design System

**Project:** Sagar Tailor portfolio · **Direction:** *The Layer Underneath*
**Status:** for review — no implementation until approved

---

## 0. Inherited decisions

Carried from Phase 1, assumed unless you say otherwise:

- Positioning: **builds the layer underneath**
- Two case studies: `deadlockd` (sole-authored) and VAYU-DRISHTI (team, platform layer owned)
- `Neoparts_Oracle` excluded
- No GitHub-stats widget; an engineering record instead
- Original design and code — no derivation from `proof-of-work`

---

## 1. Creative direction

### 1.1 The idea

Software is strata. Users touch the top layer. Almost nobody sees the ones below — the scheduler, the lock, the migration, the trace. Sagar builds those.

**So the site is a cross-section.** Not a page you scroll — a structure you descend through. It opens at the surface, where software looks like a product, and takes you down through interface, engine, and substrate until you're looking at the mutex and the safe-sequence search. The scroll is a *depth axis*, and every design decision below serves that one metaphor.

This works because it is literally what the evidence says. It isn't a theme applied to the work; it's the shape of the work.

### 1.2 The reference frame

The visual language borrows from **instrumentation and engineering section drawings** — control-room panels, geological sections, oscilloscope traces, PCB silkscreen — not from agency-portfolio conventions.

Concretely, that means: warm signal on cold substrate. Hairline rules and measurement ticks. Monospace for anything a machine produced. Generous negative space treated as vacuum, not padding. Type that behaves like signage.

**Explicitly avoided:** glassmorphism, gradient mesh blobs, floating 3D shapes with no referent, purple-to-teal SaaS gradients, noise overlays used as texture-for-texture's-sake, and the audit/ledger/verdict language that belongs to another site.

### 1.3 The four strata

Each maps to real sections, and each has its own light, density, and type treatment.

| Stratum | Sections | Character |
|---|---|---|
| **00 · SURFACE** | Entry, Position | Widest space, largest type, near-black with the most light. What software looks like from outside. |
| **01 · INTERFACE** | deadlockd case study | Density increases. Live graph. The layer where behaviour becomes visible. |
| **02 · ENGINE** | VAYU-DRISHTI, How it's built | Technical peak. Mono-dominant, schematic diagrams, code excerpts at full weight. |
| **03 · SUBSTRATE** | Stack, Engineering record, Now, Contact | Darkest, quietest, most compressed. Bedrock — facts, no ornament. |

Descent is signalled by a **depth rail** pinned left: a vertical scale marking `00 → 03` with a travelling indicator, ticked like a ruler. It's the site's one persistent chrome element and doubles as navigation.

---

## 2. Typography

### 2.1 Families

Two families. Both open-licensed, both self-hosted via `next/font/local` — no external font requests, no layout shift.

| Role | Family | Why |
|---|---|---|
| Display / UI / body | **Archivo** (variable: weight 100–900, width 62–125) | A grotesque with genuine engineering-signage character. The width axis lets headlines compress into section-drawing labels without a second family. Not a portfolio default. |
| Mono | **JetBrains Mono** (variable) | Anything a machine produced or a human addressed to a machine: code, file paths, commit SHAs, metrics, section numbers, the depth rail. |

**The rule that makes it a system:** *mono means machine-verifiable.* If a value came from the repository — a line count, a complexity bound, a test name, a commit — it is set in mono. If it is Sagar's prose, it is Archivo. The reader learns this within one section and can then tell claim from evidence at a glance. That is the honesty mechanic from Phase 1, expressed typographically rather than as a badge.

### 2.2 Scale

Fluid, `clamp()`-based, 1.250 minor-third at mobile opening to 1.333 at desktop.

| Token | Clamp | Use |
|---|---|---|
| `--fs-display` | `clamp(3.5rem, 11vw, 10rem)` | Entry statement only. Archivo 500, width 100, tracking `-0.04em` |
| `--fs-h1` | `clamp(2.5rem, 6vw, 5rem)` | Stratum openers. Weight 500, tracking `-0.03em` |
| `--fs-h2` | `clamp(1.75rem, 3.2vw, 2.75rem)` | Section heads. Weight 500, tracking `-0.02em` |
| `--fs-h3` | `clamp(1.25rem, 1.8vw, 1.625rem)` | Sub-heads. Weight 600 |
| `--fs-lead` | `clamp(1.125rem, 1.5vw, 1.375rem)` | Opening paragraph per section. Weight 400, `line-height 1.55` |
| `--fs-body` | `clamp(1rem, 1.1vw, 1.0625rem)` | Body. `line-height 1.65`, `max-width 68ch` |
| `--fs-small` | `0.875rem` | Captions, footnotes |
| `--fs-mono` | `0.8125rem` | Code, data, metadata. `line-height 1.7`, tracking `0` |
| `--fs-label` | `0.6875rem` | Section labels, rail ticks. Mono 500, tracking `0.18em`, uppercase |

### 2.3 Rules

- Body measure never exceeds **68ch**; code blocks never exceed **86ch**.
- Headlines use optical tracking — negative and tightening as size increases.
- Numerals: `font-variant-numeric: tabular-nums` on every metric, table, and rail tick so digits don't jitter during animation.
- Archivo's width axis compresses to ~85 for stratum labels; body always stays at 100.
- Never centre a paragraph over two lines.

---

## 3. Colour

### 3.1 Principle

**Warm signal on cold substrate.** The base is a cold, blue-cast near-black — the palette of a machine room. One warm amber carries all signal. Semantic green and red exist but are *earned*: they appear only where the underlying system genuinely has a pass/fail state (a safe vs. deadlocked graph, a passing vs. failing CI gate). They are never decorative.

This is deliberately not the teal/violet portfolio default, and the warm-on-cold pairing is what instrumentation actually looks like.

### 3.2 Dark palette (primary)

```css
/* Substrate ramp — deeper = further down the stack */
--l0:  #05070A;   /* deepest ground, stratum 03 */
--l1:  #090D13;   /* page base */
--l2:  #0F151E;   /* raised surface, cards */
--l3:  #161E2A;   /* hover, elevated panel */
--l4:  #222D3D;   /* borders on raised surfaces */

/* Hairlines */
--rule-faint:  rgba(232,237,244,0.06);
--rule:        rgba(232,237,244,0.11);
--rule-strong: rgba(232,237,244,0.20);

/* Type */
--ink-hi:   #E9EEF6;   /* headlines, 15.8:1 on --l1 */
--ink:      #C3CCD9;   /* body, 10.4:1 */
--ink-mid:  #8794A6;   /* secondary, 5.3:1 */
--ink-low:  #5D6878;   /* metadata, 3.1:1 — non-essential text only */

/* Signal */
--signal:       #FF9E2C;   /* the one accent: live, current, interactive */
--signal-dim:   #B86C14;
--signal-wash:  rgba(255,158,44,0.10);

/* Semantic — only where the system has a real state */
--safe:    #3DDC91;
--unsafe:  #FF5A5A;
--waiting: #6FA8FF;
```

### 3.3 Light palette

Not an inversion — a re-grounding. Light mode reads as engineering paper: warm-white ground, ink-blue text, the same amber signal darkened for contrast.

```css
--l0: #FFFFFF;  --l1: #F7F6F3;  --l2: #FFFFFF;
--l3: #F1EFEA;  --l4: #E2DED5;
--ink-hi: #0C1119;  --ink: #2C3542;  --ink-mid: #5C6675;  --ink-low: #8A93A0;
--signal: #B45C00;      /* darkened — 4.7:1 on --l1 */
--safe: #12805A;  --unsafe: #C0261F;  --waiting: #2258C7;
```

### 3.4 Contrast commitments

Every pairing meets **WCAG AA**; body and headline pairings meet **AAA**. `--ink-low` is restricted to genuinely non-essential metadata and never carries information available nowhere else. The amber signal is never the sole carrier of meaning — state is always also conveyed by shape, label, or position, so the site works for colour-blind readers and in monochrome.

---

## 4. Space, grid, geometry

### 4.1 Space

4px base. Steps: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128 · 192 · 256`, as `--s-1` … `--s-12`. Nothing off-scale.

Vertical rhythm carries the descent — section padding *compresses* as you go down, from `--s-12` at Surface to `--s-9` at Substrate. The page physically tightens as it deepens.

### 4.2 Grid

- **Desktop ≥1280px** — 12 columns, 24px gutters, 1440px max, 80px margins. Depth rail occupies a fixed 72px outside the grid.
- **Tablet 768–1279px** — 8 columns, 20px gutters, 48px margins. Rail collapses to 44px.
- **Mobile <768px** — 4 columns, 16px gutters, 20px margins. Rail becomes a 3px progress edge.

Content is deliberately asymmetric — prose sits in columns 2–7, diagrams break to 1–12. Full-bleed is reserved for stratum transitions, so it stays meaningful.

### 4.3 Geometry

- **Radius:** `2px` default, `4px` on large panels, `0` on diagrams and code. Almost square. Rounded corners read as consumer software; this isn't that.
- **Borders:** 1px hairlines, and where possible a real `0.5px` on 2× displays.
- **Elevation is light, not shadow.** Depth comes from the substrate ramp (`--l1` → `--l3`) plus a 1px top highlight at `rgba(255,255,255,0.04)`. Drop shadows appear only on genuinely floating UI — the cursor readout and the nav on scroll. No soft ambient blurs.
- **Neumorphism:** used once and only once, at the lowest amplitude — the depth-rail indicator sits in a 1px inset groove. That is the entire budget.

---

## 5. Components

Twelve primitives. Every section composes from these; nothing is bespoke without cause.

| Component | Behaviour |
|---|---|
| `StratumMarker` | Full-bleed transition: `00 / SURFACE` in compressed mono, hairline, depth reading. Marks descent. |
| `DepthRail` | Persistent left rail. Ticked scale, travelling indicator, click-to-jump. The site's only chrome. |
| `Section` | Layout wrapper. Owns column span, stratum, and vertical rhythm. |
| `SectionLabel` | `--fs-label` mono, uppercase, with leading index (`03 —`). |
| `Claim` | A prose statement with an attached `Source`. The site's core unit. |
| `Source` | Mono link to the exact file/commit that proves the adjacent claim. `path/to/file.go:L14` style. Hover reveals the excerpt inline. |
| `CodeExcerpt` | Real source, syntax-highlighted at build time (Shiki, zero runtime JS), with file path, line range, and permalink header. Line-highlight for the lines under discussion. |
| `Metric` | Tabular-num figure + mono label + provenance. Counts up on first view only. |
| `LayerDiagram` | Horizontal strata diagram. Used for VAYU-DRISHTI to show which layers are Sagar's and which are the team's — attribution rendered, not asserted. |
| `StateBadge` | `SAFE` / `DEADLOCKED` / `PASSING`. Shape + label + colour, never colour alone. |
| `Button` | Square, hairline, mono label. Magnetic within 24px on fine pointers. Fills with `--signal-wash` on hover; the border goes amber. |
| `Reticle` | The cursor. §7. |

---

## 6. Signature visuals

Five bespoke pieces. Each one renders something Sagar actually built — no stock abstraction, and none of it transferable to another person's portfolio.

**1 · The Entry Graph** *(Surface)*
A live resource-allocation graph running his real simulation as the landing backdrop. Processes and resources as nodes; allocation and request edges forming and clearing. Every ~20s a circular wait closes and the graph **locks** — edges go `--unsafe`, motion stops, `DEADLOCKED` resolves in the corner. Then recovery runs and it breathes again. Canvas 2D, ~8KB, capped at 30fps, frozen entirely under `prefers-reduced-motion` with a static safe-state render.
*Why it earns its place:* it is his algorithm, running, as the first thing you see.

**2 · The Safety Search** *(Interface)*
Scroll-driven execution of `IsSafeState()`. As you scroll, the work vector fills, processes resolve into the safe sequence one at a time, and the matrix highlights the `Need ≤ Work` comparison being made. Scrubbing backwards steps it back. The reader watches Banker's Algorithm execute at their own pace.

**3 · The Lock Window** *(Interface — the key frame)*
A timeline of one `IsSafeState` call. The mutex-held band is a thin amber sliver; the O(P²·R) computation is a long band *outside* it. Beside it, a ghosted counterfactual shows the same call with the lock held throughout. One image, one decision, immediately legible.
*Why:* this is his single best engineering judgement, and prose cannot land it as fast.

**4 · The Request Trace** *(Engine)*
For VAYU-DRISHTI: an `X-Request-ID` entering the middleware and threading down through router → service → session → Postgres, with real structlog lines illuminating in sequence, all sharing the same request ID. Makes observability visible instead of claimed.

**5 · The Attribution Cross-Section** *(Engine)*
VAYU-DRISHTI drawn as strata — dashboard, API, services, observability, data, and above them the ML pipeline. Sagar's layers are solid and amber-keyed; the team's are hatched and labelled with their authors. Hover any layer for its file count, line count, and commit.
*Why:* it solves the Phase 1 attribution problem by being straightforwardly honest, and reads as confidence rather than hedging.

---

## 7. Motion & interaction

### 7.1 Principles

1. **Motion is depth change.** Sections advance and recede on Z; they do not slide in from the sides.
2. **Nothing moves that isn't being explained.** Every animation is attached to a claim.
3. **The reader drives.** Scroll-linked scrubbing over autoplay. Anything on a timer can be paused.
4. **Instrument easing, not toy easing.** No overshoot, no bounce, no elastic.
5. **Reduced motion is a first-class path**, not a degraded one.

### 7.2 Easing & duration

```css
--ease-out:  cubic-bezier(0.16, 1, 0.3, 1);      /* entrances */
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);   /* transforms */
--ease-precise: cubic-bezier(0.4, 0, 0.2, 1);    /* UI state */
--d-fast: 160ms;  --d-base: 320ms;  --d-slow: 640ms;  --d-cine: 1200ms;
```

Reveals stagger at 60ms. Nothing exceeds 1200ms except the stratum transitions.

### 7.3 Techniques, and where each is used

| Tool | Used for | Not used for |
|---|---|---|
| **Lenis** | Global smooth scroll, `lerp: 0.09`, disabled under reduced motion | — |
| **GSAP + ScrollTrigger** | Scroll-scrubbed sequences: safety search, request trace, stratum transitions | Simple entrances |
| **Framer Motion** | Component state, reveals, layout transitions, magnetic buttons | Long scroll timelines |
| **Canvas 2D** | Entry graph, lock window, cross-section | — |
| **React Three Fiber** | **Not used.** No section needs a 3D scene, and adding one costs ~120KB to decorate. If depth is the concept, it should be earned with layout and light — not a WebGL canvas that means nothing. |

That last row is a deliberate departure from your brief, which listed R3F. I'd rather spend the budget on the five bespoke visuals, which carry meaning, than on a 3D scene that carries mood. Say the word and I'll add it, but I don't think it improves the site.

### 7.4 Cursor

A **reticle**, on fine pointers only: a 20px crosshair with a 1px ring. Over interactive elements it snaps to the target's bounds and the ring squares off. Over a diagram it becomes a measurement cursor with a live mono readout — process ID, resource count, layer name. Hidden entirely on touch, and on reduced motion it reverts to the native cursor.

It is an instrument, not a blob that lags behind the pointer.

### 7.5 Reduced motion

Under `prefers-reduced-motion: reduce`: Lenis off (native scroll), all scroll-scrubbing replaced by static end-states, the entry graph frozen at a legible safe state, reveals become instant opacity, the reticle is disabled. **Every piece of information remains reachable** — no content lives only inside an animation.

---

## 8. Wireframes — desktop first

```
┌────────────────────────────────────────────────────────────────┐
│ ░ 00                                    SAGAR TAILOR    ☾  CV  │  ← nav, hairline under
│ ░                                                              │
│ ░                                                              │
│ ░    BUILDS THE                        ┌──────────────────┐    │
│ ░    LAYER                             │  live RAG graph  │    │
│ ░    UNDERNEATH                        │  P0 ──▶ R1       │    │
│ ░                                      │   ▲       │      │    │
│ ░    Backend and systems engineer.     │   └── P1 ◀┘      │    │
│ ░    Go concurrency, async Python,     │                  │    │
│ ░    the parts other work runs on.     │  ● SAFE          │    │
│ ░                                      └──────────────────┘    │
│ ░    ↓ DESCEND                          deadlockd/engine ↗     │
│ ░                                                              │
└────────────────────────────────────────────────────────────────┘
   ↑ depth rail
```

```
┌────────────────────────────────────────────────────────────────┐
│ ░                                                              │
│ ░   ─────────────────────────────────────────────────────────  │
│ ░   01 / INTERFACE                                  DEPTH 01   │  ← stratum marker, full bleed
│ ░   ─────────────────────────────────────────────────────────  │
│ ░                                                              │
│ ░   01 — CASE STUDY                                            │
│ ░                                                              │
│ ░   deadlockd                          ● LIVE   MIT   Go/TS    │
│ ░                                                              │
│ ░   A real-time deadlock simulator.    ┌──────────────────┐    │
│ ░   Sole author, 6/6 commits.          │  THE LOCK WINDOW │    │
│ ░                                      │ ▓ held 0.4ms     │    │
│ ░   ┌─ CLAIM ─────────────────────┐    │ ░░░░░ compute    │    │
│ ░   │ The safety check releases   │    │      12.1ms      │    │
│ ░   │ the mutex before searching. │    └──────────────────┘    │
│ ░   │ engine/banker.go:L14-28  ↗  │                            │
│ ░   └─────────────────────────────┘                            │
│ ░                                                              │
│ ░   ┌── engine/banker.go ────────────────────── L14 ─ L28 ──┐  │
│ ░   │ 14  state.Mu.Lock()                                   │  │
│ ░   │ 20  copy(need[i], state.Need[i])                      │  │
│ ░   │ 28  state.Mu.Unlock()          ◀── highlighted        │  │
│ ░   └───────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────┐
│ ░   02 — CASE STUDY                                            │
│ ░   VAYU-DRISHTI            TEAM OF 4 · PLATFORM LAYER: SAGAR   │
│ ░                                                              │
│ ░   ┌── ATTRIBUTION CROSS-SECTION ────────────────────────────┐ │
│ ░   │ ╱╱╱ ML pipeline · models, features    yeshika-02  26c ╱ │ │
│ ░   │ ╱╱╱ AQI calc · GEE ingestion          soumyadeb   10c ╱ │ │
│ ░   │ ███ Streamlit dashboard · GIS         SAGAR    1,854L  │ │
│ ░   │ ███ API · schemas · services          SAGAR    2,599L  │ │
│ ░   │ ███ Config · logging · data · ops     SAGAR    6,731L  │ │
│ ░   └────────────────────────────────────────────────────────┘ │
│ ░       hover a layer → files, lines, commit ↗                 │
└────────────────────────────────────────────────────────────────┘
```

**Tablet:** diagrams drop to full width above prose; the rail narrows to 44px; the two-column case-study split becomes stacked.
**Mobile:** single column; the entry graph becomes a static safe-state render with a "run it" affordance; the lock window and cross-section become horizontally scrollable within their own containers — the page body never scrolls sideways; the rail becomes a 3px progress edge.

---

## 9. Accessibility

- Semantic landmarks throughout; one `h1`; heading levels never skipped.
- Full keyboard path, visible 2px `--signal` focus rings with 2px offset, skip-to-content first in tab order.
- The depth rail is a real `nav` with `aria-current`.
- Every canvas visual carries an adjacent text equivalent — the entry graph's state is announced via `aria-live="polite"` on transition, not left as pixels.
- Diagram hover data is also reachable on focus and rendered as a table for screen readers.
- Targets ≥44×44px. Colour is never the only signal. Tested against AA throughout, AAA for body.

---

## 10. Self-critique

Where this could go wrong, and the guard:

1. **The descent metaphor could become a gimmick.** Guard: strata are only ever labels and rhythm changes on real sections. No content is invented to fill a layer, and the rail always shows real position.
2. **Amber-on-dark risks a "hacker terminal" cliché.** Guard: Archivo at large sizes and generous space keep it editorial. Mono is restricted to machine-derived values — it never sets prose.
3. **Two projects is still two projects.** No design solves that. The five bespoke visuals are the mitigation: depth on each substitutes for breadth across many. If YottaBoost ships, sections slot straight into the existing strata.
4. **Five canvas visuals could cost performance.** Guard: all are Canvas 2D, none exceeds ~10KB, all pause off-screen via IntersectionObserver, all frozen under reduced motion. Budget: **≤180KB JS on first load**, LCP < 2.0s. If a visual can't fit, it becomes a static SVG.
5. **The Lock Window may be too technical for a recruiter.** Accepted deliberately — the target reader is an engineer. The section is written so the headline claim lands without the diagram, and the diagram rewards those who want it.

---

## 11. Approve before Phase 3

1. **Direction** — does *the layer underneath / cross-section* feel right?
2. **Palette** — warm amber on cold blue-black, or would you rather see an alternative?
3. **Type** — Archivo + JetBrains Mono?
4. **R3F** — I've cut it (§7.3). Overrule if you want it in.
5. **Signature visuals** — all five, or trim?

On approval I'll build Phase 3: Next.js + TypeScript + Tailwind, tokens wired, components, real content, everything static and accessible before any motion goes in.
