# Phase 2 — Design System

The visual foundation SUBSTRATE is built on. **No pages were redesigned.** This
phase creates the language; the pages that speak it come later.

Live reference: `/system` — internal, noindex, disallowed in robots.txt, not
linked from navigation.

> Note on naming: `docs/phase-2-design-system.md` documents the *original*
> portfolio's design system, from before the SUBSTRATE transformation. It is
> kept because the reasoning in it is still load-bearing. This file is the
> SUBSTRATE system.

---

## Decisions executed

### Light mode removed

A diegetic system interface with a daylight mode is incoherent, and maintaining
two verified palettes doubled the contrast surface for no gain — it was also
the source of the worst defect Phase 0 found, where light-theme ink landed on a
dark ramp value at 1.07:1.

Removed: the `:root[data-theme="light"]` block, `ThemeToggle`, the theme half
of the no-flash script, `data-theme` on `<html>`, and the two `data-theme`
MutationObservers in `AllocationGraph` and `DescentScene`.

Retained, because these are the things a light theme was never the right answer
to anyway: the print stylesheet, `forced-colors` support (new this phase),
reduced motion, and a dark palette where every pairing is verified.

### Back under 200 KB, by subtraction

Phase 1 ended at 202.3 KB because of a mandatory security patch. The gate was
temporarily held at 205. That was paid back before a single new component was
written, which is the order the rule requires.

`anime.js` cost **21.5 KB gzipped in the initial bundle** and had exactly one
call site: a two-element fade-and-rise on the descent readout. The native Web
Animations API does that for nothing, and `staggerIn` in `lib/motion.ts`
replaces it in fourteen lines. Its easing is now the system's own
`--ease-out-expo` rather than the library's `outExpo` approximation of it.

The gate is back at **200 KB** with a comment stating it must not be raised
again to make a feature fit.

### useSyncExternalStore, where it is actually the right primitive

Six `react-hooks/set-state-in-effect` warnings are now **zero**. They were not
all the same problem, so they did not all get the same fix:

| Site | Was | Now | Why |
|---|---|---|---|
| `MotionProvider` | matchMedia + localStorage synced into state | `useSyncExternalStore` | A genuine external store, and another tab can change it |
| `DescentStory` | WebGL probe in an effect | `useSyncExternalStore` | A capability the server cannot know; needs a defined server snapshot |
| `DescentScene` | palette + MutationObserver | lazy `useState` initialiser | With no theme, the palette is immutable. A store with no changes is not a store |
| `CountUp` | `setDisplay(value)` when motion off | derived during render | Never was external state |
| `useScrubbedSteps` | `setStep(last)` when motion off | derived during render | Never was external state |
| `ThemeToggle` | DOM attribute read in an effect | deleted | No themes to toggle |

Reaching for `useSyncExternalStore` in all six would have been cargo-culting.
Two of them were derived state wearing a `useState`.

---

## The four tiers

```
src/styles/tokens.css    TIER 1 raw values  +  TIER 2 semantic aliases
src/styles/levels.css    TIER 3 per-level overrides
src/styles/recipes.css   TIER 4 component recipes
src/app/globals.css      imports, reset, type scale, motion, print, forced-colors
```

**Tier 1 (`@theme`)** — the substrate ramp (`--color-l0`..`l4`), ink steps,
amber signal, cold secondary, semantic states, fonts, easing curves. Nothing
outside `tokens.css` may name these.

**Tier 2 (`:root`)** — what components actually read: `--deep --ground --panel
--raised --edge`, `--hair-*`, `--fg-*`, `--accent --accent-dim --accent-wash
--on-accent`, `--cold*`, `--state-*`, plus geometry, motion durations and the
z-index scale.

The tier boundary is load-bearing, not decorative. Phase 1 shipped a bug
precisely because four components reached past it.

**Tier 3 (`[data-level]`)** — the four levels are the information architecture,
so they are a token scope. Descending does three things, all inherited by any
component placed inside:

| Level | Ground | Rhythm | Hairlines |
|---|---|---|---|
| `surface` | `#090d13` | 8rem | faint |
| `interface` | `#070a10` | 7.5rem | faint |
| `engine` | `#05080d` | 7rem | firm |
| `substrate` | `#04060a` | 6rem | firm |

At the surface the system is suggestive; at the substrate it is exact. The
metaphor does layout work rather than being described in copy.

**Tier 4 (recipes)** — `.panel` `.bracket` `.notch` `.system-label` `.readout`
`.chip` `.verify` `.data-row` `.divider` `.btn` `.scanline` `.vignette`
`.lift`. No raw colour appears in any of them.

---

## Colour

Amber `#ff9e2c` is the identity and the **only warm value in the system**. The
cyan-and-magenta palette is the genre default and would have made this look
like every other cyberpunk portfolio.

The cold secondary `#7fb4cf` is reserved for one thing: telemetry the site
reports about itself. So **amber always means the subject, cold always means
the machine**. That distinction is what will let the diagnostics work in a
later phase read as a different kind of claim rather than more decoration.

The two are 167 degrees apart in hue. A test asserts that separation rather
than their contrast ratio, because their contrast ratio is 1.09:1 — they are
deliberately close in lightness and separated almost entirely by hue, which is
exactly what a WCAG contrast ratio does not measure.

### Contrast

**72 pairings — 9 inks against 8 surfaces, including all four level grounds.
Worst in the system: 4.66:1.**

`tests/contrast.test.ts` parses `tokens.css` and `levels.css` and enumerates
the full cross-product, so a new ink, surface or level cannot be added without
being checked. It also asserts the surface ramp is strictly ordered — if two
surfaces ever collide, a panel becomes indistinguishable from its ground.

**Opacity is not available as a de-emphasis mechanism.** Measured minimum alpha
over `--panel` to hold 4.5:1: `--fg-hi` 0.49, `--fg-mid` 0.74, **`--fg-low`
0.93**. Any fade a reader can perceive puts text below AA. De-emphasis is a
colour token, always.

---

## Typography

Archivo sets prose and signage; its `wdth` axis at 78 gives condensed signage
without a third family. JetBrains Mono means **MACHINE / VERIFIED / SYSTEM
DATA** and nothing else.

That rule is what stops the interface becoming costume: if a figure is set in
mono, a reader is entitled to ask where it came from and get an answer. Do not
set body copy in mono.

Scale: `.t-display .t-h1 .t-h2 .t-h3 .t-lead .t-body .t-small .t-mono .t-label
.t-cond`.

---

## Geometry

Maximum radius is **2px, everywhere, permanently**. There are no shadows: a
live check of the reference page confirms **zero non-inset box-shadows**.

Depth comes from three things — hairline borders, the delta between surface
tokens, and an optional inner top highlight (`.panel-lit`). Cheaper to
composite than a shadow, and it reads as machined rather than soft.

Brackets are corner marks (two pseudo-elements) rather than a second frame — a
targeting reticle or a technical drawing's crop marks. `.notch` provides a cut
corner for filled elements where no border has to survive the clip.

---

## Motion

Primitives: **REVEAL, SCAN, SETTLE, SIGNAL, GLITCH, ROUTE.**

Architecture is roughly 85% CSS. `lib/motion.ts` holds the curves and durations
so the CSS and JS layers cannot drift, plus `staggerIn` on the Web Animations
API for the one discrete orchestration that needs it. No animation library.

Under reduced motion the system renders its resting state: nothing armed, no
tall scroll tracks, no sticky figures, and `.scan` / `.scanline` are removed
outright rather than slowed down.

`GLITCH` is deliberately scoped to labels and chrome. There is no glitch
primitive for prose, because a heading a reader cannot finish is a defect.

---

## Effect budget

Allowed: scanline (capped at 3% so it cannot affect the contrast of anything
beneath it), vignette, single-sweep scan on arrival, controlled glow, signal
pulse, brief glitch on state change, route signal-drop.

Not allowed, and not implemented: effects over body text, constant glitch, RGB
separation over content, heavy blur, loading screens between routes.

Every atmospheric element is `aria-hidden`, carries no information, and is
removed under both reduced motion and forced colors — which is what makes
removing it safe.

---

## Quality tiers

A contract, defined here and consumed in Phase 5. Building the detection
heuristics now would be guessing ahead of the thing that needs them.

| Tier | WebGL | Max DPR | Atmosphere | Glow |
|---|---|---|---|---|
| `high` | yes | 1.5 | yes | yes |
| `balanced` | yes | 1.0 | yes | no |
| `low` | no | 1.0 | no | no |

Reduced motion is orthogonal rather than a fourth tier: it removes decorative
movement at any tier. `detectQualityTier()` is deliberately conservative — a
coarse pointer defaults to `low` until Phase 11 has measured thermal cost on
real mid-range hardware, and the 2015 dual-core the site's performance shape
was set on gets a working page rather than the full environment.

---

## Z-index

Named, ordered, and defined in exactly one place. An arbitrary z-index anywhere
else is a bug.

`--z-base 0` · `--z-content 10` · `--z-chrome 30` · `--z-rail 40` ·
`--z-overlay 60` · `--z-palette 80` · `--z-skip 100`

---

## Components

`src/components/system/` — `Panel` `PanelHead` `PanelBody` `Readout`
`ReadoutRow` `StatusChip` `VerifyChip` `SystemLabel` `Divider` `DataRow`
`SectionMarker` `ScanLine` `Vignette` `Scan`.

Every primitive: reads Tier 2 tokens only, de-emphasises with colour rather
than opacity, carries no information that is not also in the DOM as text, is
keyboard-reachable where interactive, and survives reduced motion and forced
colors without losing meaning.

`VerifyChip` is the foundation of the site's signature interaction and is
styled as a control rather than a footnote — a reader should be able to tell at
a glance that every statement is checkable, then check one.

`ReadoutRow` renders as a definition group with the term before the
description, because Phase 1 shipped the inverse and it announced values with
no terms at all.

---

## Accessibility

A real defect was found and fixed this phase, and it was a **Phase 1
regression**: the `tabIndex={0}` added to scrollable regions had landed on a
`<pre>` inside the descent's `aria-hidden` track, making it keyboard-focusable
but invisible to screen readers — `aria-hidden-focus`. It only reproduces under
reduced motion, which is why the Phase 1 gate never saw it. The snippets now
wrap instead of scrolling, so no scroll region and no tabindex is needed.

**The axe suite was restructured, and the reasoning matters.** It was
intermittently reporting 16 to 179 contrast violations that did not reproduce.
The cause: reveals are additive, so a freshly loaded page holds ~80 elements at
`opacity: 0` below the fold in a state no reader ever sees, and axe scores them
inconsistently depending on whether it samples mid-transition. The suite was
passing or failing on timing rather than on the page.

Contrast is now audited **with motion off**, which is the site's guaranteed
resting state and the only state whose colours a reader actually reads.
Everything else — roles, names, labels, landmarks, structure — is audited with
motion on, with `color-contrast` disabled there because it is the one rule
whose result is a function of transition timing. Token-level contrast remains
the primary guarantee.

`/system` is in the a11y suite: it exercises every primitive at once, so it is
the cheapest place to catch one that is inaccessible in isolation.

New this phase: `@media (forced-colors: active)` restates borders in system
colours, removes pure decoration, and forces the focus ring to `Highlight`.

---

## Results

| Metric | Phase 1 end | Phase 2 end | Budget |
|---|---:|---:|---:|
| Initial JS (gz) | 202.3 KB | **189.4 KB** | 200 KB |
| Lazy WebGL (gz) | 269.0 KB | 268.9 KB | 300 KB |
| CSS (gz) | 7.9 KB | 9.3 KB | 16 KB |
| Fonts preloaded | 127.5 KB | 127.5 KB | 130 KB |
| Runtime dependencies | 7 | **6** | — |
| Lint errors / warnings | 0 / 6 | **0 / 0** | — |
| Unit + data tests | 181 | **142** | — |
| Contrast pairings | 112 (2 themes) | **72 (1 theme, + levels)** | — |
| a11y assertions | 22 | **28** | — |
| Routes | 5 | 6 | — |

Test count fell because removing the light theme halved the contrast matrix
while adding the level grounds to it. Coverage went up, not down: the matrix
now includes surfaces the old one never checked.

---

## Deliberately not built

Per the phase brief: no landing page, no persistent WebGL environment, no
SystemChrome, no contract pages, no route transitions, no command palette, no
live diagnostics, no redesign of existing sections. Phase 2 creates the
language those will be written in.

---

## Carried into Phase 3

1. **The `data-stratum` compatibility shim** in `levels.css` keeps the existing
   `DepthRail` working. It goes when `SystemChrome` lands in Phase 4.
2. **`--scrolled` is still never written**, so the nav's condense-on-scroll is
   still inert. `SiteNav` is replaced in Phase 4; not worth touching twice.
3. **`aria-live` on a perpetual timer** in `AllocationGraph` still announces
   every 2.6 to 4.2 seconds. Needs a design decision.
4. **The build still needs network access to Google Fonts.** `next/font/local`
   against subsetted files fixes it and pairs with Phase 11.
5. **The 826 KB of unsubsetted WebGL TTFs** remain the largest single
   performance win available.
6. **Playwright cold-start**: the first `page.goto` against a cold server can
   exceed the 30s default. Worth a modest timeout in CI config if it recurs.
