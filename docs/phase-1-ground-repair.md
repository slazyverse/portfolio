# Phase 1 — Ground Repair

First phase of the SUBSTRATE transformation. **No visual change.** The purpose
was to make the foundation trustworthy before nine further phases are built on
top of it.

Every finding from the Phase 0 audit was re-opened and re-verified against the
code before being acted on. Two of the fixes below came out of that
re-verification rather than the audit, and four more were found by the gates
introduced here.

---

## Why this phase existed

`npm run lint` had never executed successfully. There was no `eslint.config.*`
and no `.eslintrc.*`; ESLint 9 exited 2 on every invocation since the
repository was created. Three pieces of dead code and two real accessibility
defects reached production behind that gap.

The rule going forward: **a gate that has never run is not a gate.**

---

## Fixes

### 1. Light-theme contrast collapse — the `--deep` alias

`--color-l0` was a tier-1 ramp value used directly as a surface by four
components. The light theme re-grounds every *alias* but cannot re-ground a raw
ramp value, so in light mode the code excerpt rendered `--fg-hi` on
`--color-l0` at **1.07:1** — effectively invisible. Measured in the live DOM,
not inferred from the stylesheet.

Introduced `--deep` as a tier-2 semantic alias (`#05070a` dark, `#efece4`
light) and repointed `Footer`, `CodeExcerpt`, `DescentStory` and `LockWindow`.
No component references `--color-l0` any more.

### 2. Skip-link contrast — the `--on-accent` token

Found while fixing the above; **not in the original audit**. The skip link and
`::selection` set `color: var(--color-l0)` on an `--accent` background. In
light mode the accent is a dark brown, so this was near-black on dark brown at
**3.43:1** — on the one control a keyboard user depends on most.

Added `--on-accent`, which inverts per theme: `#05070a` dark, `#ffffff` light
(5.88:1).

### 3. `--fg-low` on `--raised` — 4.41:1

Caught by the new contrast suite. `--raised` carries hover states and was
absent from the original 48-pairing check. `--color-ink-low` moved from
`#788495` to `#7c8899`, clearing AA on every surface at 4.66:1 worst.

### 4. Canvas did not repaint on theme change under reduced motion

`AllocationGraph` registered its `data-theme` MutationObserver *after* the
reduced-motion early return, so a visitor with motion off who switched theme
kept a canvas painted in the old palette. Verified by sampling canvas pixels
before and after a toggle. The observer now precedes the early return and is
disconnected on both paths — a repaint is correctness, not animation.

### 5. Opacity-based dimming put real text below AA

Found by the new axe gate. `RequestTrace` dimmed unreached steps with
`opacity-40`, rendering layer names at **2.2:1** and file paths and log lines
at **1.77:1**. `SafetySearch` had the same pattern at `opacity-45`.

Measured the minimum compliant alpha over `--panel`:

| Ink | Minimum alpha for 4.5:1 |
|---|---|
| `--fg-hi` | 0.49 |
| `--fg-mid` | 0.74 |
| `--fg-low` | **0.93** |
| `--state-safe` | 0.61 |

`--fg-low` needs alpha >= 0.93, so **opacity is not a usable de-emphasis
mechanism for text on this palette** — any perceptible fade breaks AA. Both
components now carry de-emphasis in verified colour tokens. State is still
signalled by the node, the thread and the border.

**Standing rule: de-emphasise with tokens, never with opacity.**

### 6. `<dd>` emitted before `<dt>` in `MetricGrid`

Found by axe. The metric value came before its label, so a screen reader
announced "6/6" with no indication of what 6/6 measured. Terms now precede
descriptions in the DOM; the visual order is restored with flex `order`. The
provenance note became a second `<dd>` rather than a `<p>`, which is invalid
inside a definition list.

### 7. Scrollable regions unreachable by keyboard — mobile only

Found by the new axe gate running at mobile width; **invisible at desktop
width**, which is why the Phase 0 manual pass missed it. Seven horizontally
scrollable regions (tables, code blocks, log output) could not be scrolled
without a pointer. All now carry `tabIndex={0}`; the record table also gained
`role="region"` and a label.

### 8. Fabricated source line

The `banker.go` excerpt rendered an author's annotation as line 32. The real
line 32 is `finish := make([]bool, np)`. The excerpt's own declared range was
`L14 — L30`, so the line was outside its stated bounds as well.

Removed. The excerpt is now character-exact against the real file, and a test
asserts that permanently.

### 9. `<a href="/">` used for internal navigation

`error.tsx` and `not-found.tsx` triggered full page reloads. Now `next/link`.
This matters more from Phase 3, when there are nine routes.

### 10. Render-phase ref write

`useScrollCamera` assigned `callback.current` during render. Moved into an
effect; the scroll loop only reads it after paint.

### 11. Dead code

- `use3D ? "sr-only" : "sr-only"` — identical branches, shipped to production
- `palette.grid` — computed on every theme change, never read
- `@types/animejs@3.1.13` — typed anime.js **v3** while the project runs v4,
  which ships its own types. Shadowed and wrong. Removed; typecheck still
  passes, which confirms it was dead.

### 12. Security — two critical RCEs

`npm audit` had never been run. It reported **5 vulnerabilities, 1 critical**:

- **next 16.0.0 to 16.3.2** — unauthenticated RCE on Windows-hosted servers,
  and unauthenticated RCE in the Image Optimization API via AVIF.
  `next.config.ts` explicitly enables AVIF. The app uses no `next/image`, so
  the path is not reachable from application code, but the optimizer endpoint
  exists on the platform regardless.
- `sharp <0.35.4` and `js-yaml 4.0.0 to 4.3.1` — transitive, high severity.

Patched to `next@16.3.5` (inside the existing caret range) and cleared the
transitives. **`npm audit` now reports 0 vulnerabilities**, and CI fails on any
new high.

---

## Gates introduced

| Gate | Command | Blocks merge |
|---|---|---|
| Types | `npm run typecheck` | yes |
| Lint | `npm run lint` | yes |
| Unit + data integrity | `npm run test` | yes |
| Build | `npm run build` | yes |
| Performance budget | `npm run budget` | yes |
| Accessibility (axe, 2 viewports) | `npm run test:a11y` | yes |
| Vulnerabilities | `npm audit --audit-level=high` | yes |
| Evidence still resolves | `npm run test:evidence` | **no — monitor** |

`npm run verify` runs the local subset. The evidence suite depends on other
repositories being reachable, so it reports rather than blocks, and also runs
weekly on a schedule.

### What the tests actually protect

**`tests/contrast.test.ts`** parses the tokens out of `globals.css` and checks
the full cross-product — 8 inks by 7 surfaces by 2 themes, plus text-on-accent.
112 pairings, against the original 48. It reads the stylesheet rather than a
hand-maintained copy, because a hand-maintained copy is how the palette
documentation drifted in the first place.

**`tests/data-integrity.test.ts`** enforces the content model's invariants:
every claim carries a usable source, displayed paths match the links they open,
excerpt line numbers fall inside their declared range and never repeat, nav ids
resolve, slugs are unique, and the attribution cross-section still credits
someone other than Sagar.

**`tests/evidence.test.ts`** fetches every cited source and **compares quoted
code against the real file line by line**. The line-32 defect cannot recur.

**`tests/e2e/a11y.spec.ts`** runs axe plus structural assertions on desktop and
mobile: heading order, landmarks, `aria-labelledby` integrity, skip-link focus
order, 24x24 targets, and the reduced-motion contract (nothing armed, no tall
tracks, no orphaned sticky figures).

---

## Performance

| Metric | Before | After | Budget |
|---|---:|---:|---:|
| Initial JS (gz) | 195.0 KB | **202.3 KB** | 205 KB |
| Lazy WebGL (gz) | 268.1 KB | 269.0 KB | 300 KB |
| CSS (gz) | 7.8 KB | 7.9 KB | 16 KB |
| Fonts preloaded | 127.5 KB | 127.5 KB | 130 KB |

**The +7.3 KB is entirely the mandatory `next@16.3.5` security patch.** No
feature code was added in this phase.

This breaches the 200 KB target set in the brief. The gate is set at 205 KB to
reflect the post-patch reality, and the config states explicitly that it must
not be raised again to make a feature fit. Phase 11 has a concrete path to
reclaim it: the two WebGL TTFs are 826 KB unsubsetted, which is a far larger
win than 7 KB.

---

## Risks found, not fixed

Recorded rather than acted on, because they fall outside Phase 1 scope.

1. **The build requires network access to Google Fonts.** `next/font/google`
   fetches at build time; the build failed once during this phase when the npm
   cache was cleared. A CI runner without egress, or a Google Fonts outage,
   breaks the build. The fix is `next/font/local` against subsetted files —
   schedule alongside Phase 11.
2. **`--scrolled` is never written.** `SiteNav` interpolates it, so the nav
   never condenses and its `transition-[padding]` never fires. Harmless today;
   `SystemChrome` in Phase 4 replaces this component, so it was left alone.
3. **`aria-live` on a perpetual timer.** `AllocationGraph` announces its state
   every 2.6 to 4.2 seconds, forever. Not a WCAG failure, but hostile to
   screen-reader users. Needs a design decision, not a repair.
4. **Six `react-hooks/set-state-in-effect` warnings.** All the same SSR-safe
   capability-detection shape. `useSyncExternalStore` is the right primitive;
   deferred to Phase 2, when the provider layer is rebuilt anyway.
5. **`min-h-[88vh]` is caught by the print stylesheet's `[class*="vh]"]`
   selector**, collapsing the hero in print. Cosmetic; note for Phase 12.
6. **Disk pressure on the development machine.** C: sits at roughly 2 GB free
   of 140 GB. `npm install` failed silently once because of it. Not a
   repository problem, but it will interrupt later phases.

---

## Git discipline

Established for every phase from here.

```
main                              always deployable; the live site
  |
  +-- substrate/phase-N-<name>    one branch per phase
        |
        +-- preview deploy -> review -> squash merge -> tag
```

**Rules**

- One phase is **one squash-merged commit** on `main`, so any phase reverts
  with a single `git revert`.
- **Tag before every merge**: `pre-phase-N`. Phase 1's rollback point is
  `pre-substrate-phase-1` at `7fe2ca0`.
- `main` is never force-pushed, reset, or rewritten.
- Nothing is deleted without understanding it. Every piece of dead code removed
  in this phase was verified unreachable first.
- The live site must never be broken by an in-progress phase.

---

## Phase 2 readiness

The design system can now be built on a foundation that:

- **lints** — and fails on constant binary expressions, the exact class of
  defect that shipped here
- **proves its own contrast** from the stylesheet, across every surface, so new
  tokens cannot be added unverified
- **checks accessibility at two viewports automatically**, including the
  mobile-only class of defect that manual review missed
- **holds a measured performance budget** that fails the build on breach
- **verifies its own evidence**, so the thesis is machine-enforced rather than
  a convention

Open decisions carried into Phase 2:

1. **Light theme removal** is approved but **not executed** — it is a design
   change, not a repair. When it happens, `--deep` and `--on-accent` simply
   lose their light overrides; the alias layer is already correct for it.
2. **`useSyncExternalStore`** for the provider layer, retiring 6 warnings.
3. **The 200 KB target versus the 205 KB gate** needs an explicit decision.
