# Sagar Tailor — Portfolio

An engineering portfolio built on one idea: **the layer underneath**. The site is a
cross-section rather than a page — it opens at the surface and descends through
interface, engine and substrate.

**Live:** [sagar-tailor-portfolio.vercel.app](https://sagar-tailor-portfolio.vercel.app)

**Direction and rationale:** [`docs/phase-1-foundation.md`](docs/phase-1-foundation.md) ·
[`docs/phase-2-design-system.md`](docs/phase-2-design-system.md)

> Turn **Motion** on in the header to see the descent. It defaults to your
> operating system's reduced-motion setting, which on many Windows machines is
> off for performance reasons rather than accessibility ones.

---

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript, `strict` + `noUncheckedIndexedAccess` |
| Styling | Tailwind CSS v4, CSS-first tokens |
| Fonts | Archivo + JetBrains Mono, self-hosted via `next/font` |
| 3D | three.js + React Three Fiber + drei — the descent sequence |
| Motion | anime.js for orchestrated sequences; CSS for everything else |
| Visuals | Canvas 2D for the live simulation and diagrams |

Runtime dependencies: `next`, `react`, `react-dom`, `three`, `@react-three/fiber`,
`@react-three/drei`, `animejs`.

**Scrolling is never intercepted.** There is no smooth-scroll library and no custom
cursor — both were tried and removed after testing on the target hardware, because a
scroller decoupled from the OS reads as lag no matter how well it is tuned.

### What each dependency is for, and what was rejected

- **three / R3F / drei — the descent.** Not decoration: drei's `Text` is
  signed-distance-field text rendered on the GPU, so it scales without
  re-rasterising glyphs. Glyph re-rasterisation is exactly what made the CSS
  version of the zoom stutter, so WebGL removes that cost at its source. Loaded
  lazily — three.js is never in the initial bundle, and never loads at all if
  WebGL is missing or motion is off.
- **anime.js — orchestrated sequences.** Tree-shaken to `animate` and `stagger`.
  Used on discrete events (a layer arriving), never per frame.
- **Framer Motion — rejected (44 KB).** The site asks it for a fade, a translate
  and a stagger. That is `Reveal.tsx`, about thirty lines of IntersectionObserver
  and a CSS transition.
- **GSAP + ScrollTrigger — rejected (27 KB+).** Its `pin` injects a spacer and
  rewrites layout. `position: sticky` pins natively; what remains is arithmetic
  on a bounding rect.
- **Lenis — removed (5.3 KB).** Smoothed scroll decouples the page from the OS
  scroller; at any easing there is a gap between the wheel stopping and the page
  settling, which on a low-power machine reads as the whole site being slow.

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
  app/          layout, page, globals.css, robots, sitemap, 404, error, og-image
  components/
    layout/     DepthRail · SiteNav · Footer · Section · StratumMarker
    primitives/ ClaimCard · SourceLink · CodeExcerpt · MetricGrid · StateBadge
    sections/   Entry · Position · CaseStudy · HowItsBuilt · Stack · Record · Contact
    visuals/    AllocationGraph · LockWindow · AttributionCrossSection
                SafetySearch · RequestTrace          (scroll-scrubbed)
                DescentStory · DescentScene          (WebGL, lazy)
    effects/    Reveal · TextReveal · CountUp
    providers/  MotionProvider
  data/         All content. Components render it; none of it is hard-coded in JSX.
  hooks/        useScrubbedSteps · useScrollCamera
  lib/          cn · motion · revealObserver
public/fonts/   Archivo.ttf · JetBrainsMono.ttf   (the GPU text needs real files)
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

Two mechanisms share the name, and they are separate:

**The page ground.** `DepthRail` owns the single scroll listener and publishes
`--depth` (0 → 1) as a CSS custom property, plus a `data-stratum` attribute. The
ground steps between four background colours as the reader descends — four CSS
transitions across the whole page, not a full-viewport overlay recompositing every
frame. Every ink colour is contrast-checked against the *deepest* ground, not just
the top of the page.

**The 3D sequence.** `DescentStory` maps scroll onto a camera depth and hands it to
`DescentScene`, where four layers of one real request stand six units apart along Z.
Scroll dollies the camera through them; the pointer orbits it. The renderer runs
`frameloop="demand"`, so it is idle unless scroll or pointer requests a frame — which
means every input that moves the camera has to call `invalidate()` explicitly.

The fade between layers is deliberately asymmetric: 1.25 units of run-up as a layer
approaches, 0.42 to clear out once passed. A layer you have just passed is enormous
and directly in front of the camera, so it has to leave fast or it covers whatever is
arriving behind it.

## Status

Phases 1–5 complete.

| Measure | Value |
|---|---|
| Initial JS | 194.2 KB gzipped |
| three.js chunk | 267 KB gzipped — lazy, loads only near the descent |
| CSS | ~7.6 KB gzipped |
| Fonts (preloaded) | 127.5 KB, 2 files |
| Routes | 5, all static |
| Deploy | Vercel, auto-deploys from `main` |

**On the 180 KB budget:** the initial bundle sat at 177.8 KB after a round of removing
things rather than tuning them — the motion library, the custom cursor, the magnetic
buttons and the compositing overlay were all cost without corresponding meaning. Adding
the 3D descent put it back to 194.2 KB. Roughly 140 KB of that is the React 19 + Next 16
baseline. The 267 KB of three.js is deliberately *not* in it: it is fetched only when the
descent section comes within a screen, and never on a device without WebGL.

Code-splitting the two scrubbed sequences was tried and *increased* the total to
184.1 KB, because Next preloads the dynamic chunks anyway and adds loader machinery;
it was reverted.
