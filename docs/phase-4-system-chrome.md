# Phase 4 — System Chrome

The persistent interface layer. Mounted once in the root layout, it surrounds
every route and survives navigation — which is the property the procedural
environment will need in Phase 5, since that has to persist too.

**Not in this phase:** the city, the cinematic landing, audio, live telemetry.

---

## Architecture

```
MotionProvider
└── RouteAnnouncer          focus + announcement on route change
└── SystemChrome            ← Phase 4
    ├── LevelRail           desktop, fixed left
    ├── StatusBar           sticky top
    │   └── page content
    ├── MobileBar           fixed bottom + <dialog> drawer
    └── CommandPalette      <dialog>, Ctrl/Cmd+K
```

`SystemChrome` lives in `app/layout.tsx`. App Router keeps layout components
mounted across navigation, so the chrome is never remounted, never
re-initialised and never flashes. Route content changes beneath it.

### One route context, resolved once

`useRouteContext()` is called once at the top of `SystemChrome` and the result
is passed down. Each piece of chrome could subscribe to the pathname itself,
but then three components would hold three subscriptions and independently
compute the same answer — with the option of disagreeing. One resolution, one
truth.

### DepthRail was replaced, not kept

`DepthRail`, `SiteNav` and `PrimaryNav` are deleted. The `data-stratum`
compatibility shim in `levels.css` is gone with them.

Keeping the old rail alongside the new one was never an option: two navigation
systems that could disagree about where the visitor is would be worse than
either alone. The old rail also had nothing to point at — it tracked scroll
position on a single page. With a real route architecture, depth is something
you navigate.

---

## Components

### StatusBar

Identity, current level, current location, search trigger, motion toggle.
Compact by deliberate constraint: **the chrome frames the site, it does not
become the site.** A persistent HUD that pushes content down is a HUD that cost
the reader the thing they came for.

**Every value shown is real.** There is no fabricated CPU, memory or network
readout. A number that looks like data and is not one would undermine the only
thing this site is built on, and it would be the easiest possible thing to add.
Measured diagnostics come later, from a real source.

### LevelRail

Desktop. Four levels, each a link to that level's entry route:

| Level | Destination |
|---|---|
| 00 Surface | `/` |
| 01 Interface | `/dossier` |
| 02 Engine | `/contracts` |
| 03 Substrate | `/record` |

Destinations come from `routeForLevel()`, which reads the route table, so
adding a route at a level cannot leave the rail pointing somewhere stale.

State is carried by shape as well as colour — the mark widens from 12px to
24px at the current level — so it survives greyscale and forced colors.

### MobileBar

Not a shrunken rail. On a phone the reachable area is the bottom of the screen,
targets must survive a thumb rather than a cursor, and there is no hover state
to hide anything behind. So the four levels sit along the bottom at 48px tap
height and everything else lives in a drawer.

The drawer is a **native `<dialog>`** opened with `showModal()`. That is a
deliberate choice over a hand-built overlay: it gives a focus trap, Escape to
dismiss, an inert background and focus return to the trigger — correctly, with
no library and no custom key handling to get subtly wrong.

Both registers are visible in the drawer. There is no hover on touch to reveal
the plain name behind the in-world one, so both are shown.

### CommandPalette — foundation only

`Ctrl+K` / `Cmd+K`. Filter, arrow-key selection, Enter to navigate, Escape to
dismiss, focus returned. Also a native `<dialog>`, for the same reasons.

It is **an accelerator, never a gate.** Everything it reaches is reachable from
the visible navigation, and nothing depends on knowing the shortcut. Richer
commands come later; building a large command system before there is anything
to command would be guessing.

---

## A real inconsistency caught by visual review

The status bar reported **03 SUBSTRATE** on `/contracts/deadlockd` while the
page header said **02 ENGINE**.

Both were behaving as written: the chrome took the level from the contract
record, and `PageShell` took it from the route table. Contracts genuinely sit
at different depths — deadlockd is substrate work, the other two are engine
work — so the chrome was right and the page was wrong.

`PageShell` now accepts a `level` override and the contract page passes its
own. Verified across all three: chrome, page header and rail agree.

Worth recording that the automated suite did not catch this. Every individual
assertion passed; the defect was two correct components disagreeing, which only
showed when both were on screen at once.

---

## Accessibility

Two undersized targets were found by the suite and fixed:

| Element | Was | Now |
|---|---|---|
| Level rail links | 23.6px wide | 44px square |
| `SUBSTRATE` home link | 18.1px tall | 36px min-height |

Both were under the WCAG 2.2 SC 2.5.8 floor of 24px. The visible mark is a
hairline and a two-digit readout; the thing a pointer has to hit is not.

Also fixed: the fixed mobile bar covered the footer. The bottom clearance was
on the content wrapper, but the footer is a sibling outside it — the padding
now sits on the chrome's own column so everything clears.

**Reduced motion**: the chrome holds its stable state. No animated rail, no
scan, no glitch, no decorative transition. Navigation is untouched — a visitor
who asked for less motion asked for less motion, not for an interface that
stops working.

---

## Results

| Metric | Phase 3 | Phase 4 | Budget |
|---|---:|---:|---:|
| Initial JS (gz) | 187.6 KB | **189.5 KB** | 200 KB |
| CSS (gz) | 9.5 KB | 9.8 KB | 16 KB |
| Routes | 11 | 11 | — |
| Unit + content tests | 172 | 172 | — |
| a11y + chrome assertions | 56 | **70** | — |
| Dependencies | 6 | **6** | — |

**The entire chrome costs +1.9 KB gzipped** — status bar, level rail, mobile
bar with drawer, and command palette. No UI library, no icon library, no
animation library, no state management. Both dialogs are native elements; the
palette filter is `Array.filter`.

---

## Future environment contract

Recorded again because Phase 5 is where it gets tested.

```
SYSTEM CHROME  ── current level, navigation, route context, commands
      │
      ▼
PROCEDURAL CITY  ── atmosphere, depth, world
      │
      ▼
PORTFOLIO ROUTES ── the actual content
```

The chrome now provides the stable surface the environment talks to:

- **`useRouteContext()`** — current level, route, contract designation
- **`routeForLevel()`** — level to destination, from the route table
- **`data-level`** — the token scope, already on every page
- **stable route ids** — the join key a city location would use

**The environment must never become the only way to reach information.** Every
route works, is readable and is indexable with no environment at all — which is
the state Phase 4 leaves it in, and the state it has to stay in.

---

## Carried into Phase 5

1. **The home page is untouched.** Still the single-page descent; it does not
   yet use `PageShell` or the level scope. The cinematic landing is Phase 6.
2. **`--scrolled` is finally gone** — it died with `SiteNav`. The status bar
   does not condense on scroll, deliberately: it is already compact, and
   scroll-driven chrome resizing causes layout shift for no gain.
3. **`aria-live` on a perpetual timer** in `AllocationGraph` still announces
   every 2.6 to 4.2 seconds. Needs a design decision, not a repair.
4. **The palette is navigation-only.** Real commands (`diag`, `verify --all`)
   wait for the systems they would drive.
