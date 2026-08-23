# Sagar Tailor — Portfolio

An engineering portfolio built on one idea: **the layer underneath**. The site is a
cross-section rather than a page — it opens at the surface and descends through
interface, engine and substrate.

**Direction and rationale:** [`docs/phase-1-foundation.md`](docs/phase-1-foundation.md) ·
[`docs/phase-2-design-system.md`](docs/phase-2-design-system.md)

---

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript, `strict` + `noUncheckedIndexedAccess` |
| Styling | Tailwind CSS v4, CSS-first tokens |
| Fonts | Archivo + JetBrains Mono, self-hosted via `next/font` |
| Motion | Hand-built. No motion library, native scrolling |
| Visuals | Canvas 2D — no charting or 3D dependency |

Runtime dependencies: `next`, `react`, `react-dom`. Nothing else.

### Why there is no motion library

Phase 2 planned on GSAP + ScrollTrigger, Framer Motion and Lenis. All three were
dropped, each for its own reason:

- **Framer Motion (44 KB gzipped)** — the site asks it for a fade, a translate and a
  stagger. That is `Reveal.tsx`, about thirty lines of IntersectionObserver and a CSS
  transition. Shipping 44 KB to avoid writing them would contradict the argument the
  page itself makes.
- **GSAP + ScrollTrigger (27 KB+ gzipped)** — its `pin` injects a spacer element and
  rewrites layout. CSS `position: sticky` pins natively and correctly; what remains is
  arithmetic on a bounding rect, which is `useScrubbedSteps.ts`.
- **Lenis (5.3 KB gzipped)** — removed after testing on the target hardware. Smoothed
  scroll decouples the page from the OS scroller; at any easing setting there is a lag
  between the wheel stopping and the page settling, and on a low-power machine that
  reads as the whole site being slow. Native scrolling is instant and costs nothing.

**Scrolling is never intercepted.** The motion layer is entrance reveals, two
scroll-scrubbed diagrams and one canvas simulation — nothing that stands between the
reader and the scroller.

### Performance shape

This is built to run on a 2015 dual-core ultrabook with integrated graphics, because
that is what it was tested on. The rules that came out of that:

- **No permanently promoted layers.** `will-change` is set immediately before a
  transition and cleared on `transitionend`. Held in CSS, 71 revealing elements pinned
  71 GPU layers for the whole session.
- **No full-viewport per-frame compositing.** The ground deepens in four stepped
  `background-color` transitions keyed off `data-stratum`, not a fixed overlay whose
  opacity changes 60 times a second.
- **No `backdrop-filter`.** It sat on the sticky header, recompositing on every frame.
- **No canvas shadows.** `shadowBlur` ran per edge and per node, per frame; weight and
  colour carry the same meaning for free.
- **Scroll never re-renders React.** `DepthRail` writes progress to a custom property;
  state changes only when the stratum does — four times per page, not sixty per second.
- **One shared IntersectionObserver** for all 71 reveals, not one each.

## Commands

```bash
npm run dev
```

```bash
npm run build
```

```bash
npm run typecheck
```

## Structure

```
src/
  app/          layout, page, globals.css, robots, sitemap, 404
  components/
    layout/     DepthRail · SiteNav · Footer · Section · StratumMarker
    primitives/ ClaimCard · SourceLink · CodeExcerpt · MetricGrid · StateBadge
    sections/   Entry · Position · CaseStudy · HowItsBuilt · Stack · Record · Contact
    visuals/    AllocationGraph · LockWindow · AttributionCrossSection
                SafetySearch · RequestTrace   (scroll-scrubbed)
    effects/    Reveal · TextReveal · CountUp
    providers/  MotionProvider
  data/         All content. Components render it; none of it is hard-coded in JSX.
  hooks/        useScrubbedSteps
  lib/          cn · motion · revealObserver
```

## Two conventions worth knowing

**Content lives in `src/data`.** Every string on the site comes from there. Adding a
project means adding a `Project` object, not writing JSX.

**A claim cannot exist without its source.** The `Claim` type requires a `Source`
pointing at the file or commit that proves it, so the honesty rule from Phase 1 is
enforced by the type system rather than by discipline.

**Mono means machine-verifiable.** JetBrains Mono is reserved for values derived from a
repository — line counts, complexity bounds, file paths, commits. Archivo sets prose.
The distinction is load-bearing; don't set body copy in mono.

## Accessibility

- One `h1`; heading levels never skip; landmarks throughout
- Skip link first in tab order; visible focus rings
- Every palette pairing verified **≥4.5:1 (WCAG AA)** on all three surfaces — page
  ground, raised panel, *and the deepened ground at full scroll depth* — in both
  themes. 48 pairings; worst is 4.78:1
- All interactive targets ≥24×24px (WCAG 2.2 SC 2.5.8)
- State is carried by shape as well as colour
- The canvas announces its state as text via `aria-live` — no information exists only
  in pixels
- `prefers-reduced-motion` renders one static safe state and starts no animation loop

### The reduced-motion contract

Animation is **additive, never subtractive**. Elements are visible in the markup, and
JavaScript only hides them once it has confirmed it can bring them back — the
`data-reveal-armed` and `data-line-armed` attributes are that confirmation, and they are
never set when reduced motion is requested. With JavaScript disabled, before hydration,
or with the preference on, the page renders complete.

The scrubbed sequences follow the same rule: their tall scroll tracks collapse, the
sticky pinning is removed, and each renders its **final** state — because the conclusion
is the information. Verified: 0 hidden elements, 0 tall tracks, 0 sticky figures, and
both sequences reporting their result.

## The descent

`DepthRail` owns the page's single scroll listener and publishes two custom properties:

| Property | Meaning |
|---|---|
| `--depth` | 0 → 1 across the document |
| `--scrolled` | 0 or 1, once the page has moved |

A fixed `.descent` sheet reads `--depth` and fades in `--depth-floor`, so the ground
literally deepens as the reader descends. Opacity is compositor-only: the whole effect
costs one property write per frame and never triggers layout.

`--depth-amp` caps that fade per theme — **0.85 dark, 0.5 light**. Descending into dark
*gains* contrast; descending into light loses it, so light mode gets half the amplitude
and its `--fg-low` and `--accent` are tuned against the deepest ground rather than the
top of the page.

## Status

Phases 1–5 complete.

| Measure | Value |
|---|---|
| Initial JS | 177.8 KB gzipped |
| CSS | 7.6 KB gzipped |
| Fonts (preloaded) | 127.5 KB, 2 files |
| Routes | 5, all static |
| Runtime deps | 3 |

**On the 180 KB budget:** now met, at 177.8 KB. It got there by removing things rather
than by tuning them — the motion library, the custom cursor, the magnetic buttons and
the compositing overlay were all cost without corresponding meaning. Roughly 140 KB of
what remains is the React 19 + Next 16 baseline.

Code-splitting the two scrubbed sequences was tried and *increased* the total to
184.1 KB, because Next preloads the dynamic chunks anyway and adds loader machinery;
it was reverted.
