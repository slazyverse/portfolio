# Phase 5 — Procedural Environment

The world engine. A generated, deterministic cyberpunk-inspired city that exists
to serve the portfolio and is never required to read it.

**Not in this phase:** the cinematic landing, the boot sequence, audio, camera
choreography, clickable city objects. Phase 5 builds the world; Phase 6 directs
the shot.

---

## The one rule

> The city is a layer. The portfolio is the product.

Everything below is downstream of that. The environment is `aria-hidden`, holds
no text, receives no pointer events, contains nothing focusable, and never
carries information that exists nowhere else. Every route renders, reads and
indexes identically with the environment removed — which is asserted, not
asserted-to: `tests/e2e/environment.spec.ts` denies WebGL at the
`HTMLCanvasElement.prototype.getContext` level and walks every route, and
another test deletes the layer outright and navigates.

---

## Art direction

**A shaft, not a skyline.**

The obvious cyberpunk image is a city seen from above or across. It would have
illustrated nothing. This site's information architecture is already four levels
deep and its central verb is already *descend* — so the city is a vertical well
with the four levels stacked as bands of one continuous structure, and the
camera is inside it. The level rail in the chrome and the camera's Y position
are now the same fact.

| Level | Character | Signal |
|---|---|---|
| 00 Surface | Slender towers and slabs, rain, the most lit of the four | amber |
| 01 Interface | Masts and thin towers carrying cold data spines | cold |
| 02 Engine | Heavy, low machine blocks; horizontal pipe runs; furnace light | amber |
| 03 Substrate | A dense server hall in near-darkness, cable trays | cold |

The shaft **tapers** as it descends (`spanScale` 1 → 0.64) and the camera's eye
height drops with it (19 → 3.6). The design system already compresses its
vertical rhythm at each level; the camera doing the same thing physically is the
metaphor paying rent rather than being described in copy.

**Darkness is the material.** Most of this city is unlit. Amber remains the
subject and cold remains the machine — the city gets no exemption from the
Phase 2 semantics, and a test enumerates the colours it is allowed to draw.

---

## Architecture

```
lib/environment/
  seed.ts       deterministic PRNG, seeded from a readable string
  types.ts      the data model — no three.js anywhere in it
  generate.ts   the city, as pure data
  camera.ts     where the camera stands at each level
  quality.ts    what each tier may spend, and the mode resolver
data/environment.ts   the authored navigation anchors
components/environment/
  Environment.tsx          mounted in the root layout; decides and persists
  CityScene.tsx            WebGL (lazy, ssr:false)
  CanvasAtmosphere.tsx     2D fallback, same model
  EnvironmentLab.tsx       the /system laboratory
  EnvironmentDiagnostics   development only, compiled out of production
```

### Generation is data, rendering is geometry

The load-bearing decision. Nothing in the generator imports a rendering library,
so the whole city can be unit-tested in Node, hermetically, in about a second —
no WebGL, no canvas, no headless browser. Determinism becomes provable rather
than eyeballed, and the Canvas fallback reads the *same model* as the WebGL
path, so the fallback is the same city drawn more cheaply rather than a second
thing that drifts.

### Anchors carry route ids, never paths

An anchor declares `routeId` and nothing else about where it goes. Its **level
is not stored** — it is read from the route table, because a second copy is a
second thing to keep in sync, which is exactly the class of defect Phase 4 found
between the status bar and the page header. A test asserts no anchor spec
contains a `/`.

### Determinism

Same seed, same city, on any machine, forever. No `Math.random`, no clock, no
DOM. That is what makes screenshots comparable between commits, makes a layout
regression visible, and makes the tests mean something. The rain is seeded off
its own index, so the weather is reproducible too.

---

## Quality tiers

Consumes the Phase 2 contract (`QUALITY`) rather than inventing a second one.
`QUALITY` still answers "may WebGL mount, what is the DPR ceiling"; this phase
adds only "how much city".

| | structures | lit cells | rain | conduits/level |
|---|---:|---:|---:|---:|
| HIGH | 260 | 3200 | 1400 | 7 |
| BALANCED | 140 | 1100 | 0 | 4 |
| LOW | 60 | 0 | 0 | 2 |

Both budgets are **city-wide and distributed by authored share**, not split
evenly between levels — density is character. The substrate is a server hall and
reads as one only when crowded; the engine floor is meant to be sparse and
heavy.

**Mobile resolves to LOW and never starts WebGL.** A coarse pointer means the
three.js chunk is not fetched at all. Asserted on a Pixel 7 profile.

---

## Fallback chain

```
WEBGL    procedural city                 high / balanced tier, WebGL present
CANVAS   2D silhouette of the same city  no WebGL, but headroom
CSS      gradients only, zero JS/frame   low tier, or no drawing context
NONE     nothing renders                 context loss, or deliberately off
```

The CSS base layer is **server-rendered and always present**, so a visitor with
JavaScript disabled still gets atmospheric depth. The mode is resolved by one
pure function with one table of outcomes, tested directly — not by three
`useEffect`s that can disagree.

Reduced motion is deliberately **not** an input to that function. It decides
whether the city moves, never whether it exists.

---

## Rendering

**Five draw calls**, measured off `renderer.info`, not asserted:

| | |
|---|---|
| structures | one `InstancedMesh`, all four levels |
| lit cells | one `InstancedMesh`, additively blended |
| conduits | one merged `LineSegments` |
| ground | one merged geometry, four planes |
| rain | one `LineSegments`, animated entirely in a vertex shader |

Rain is line segments rather than points because rain is a streak and
`gl_PointSize` cannot make one. The fall happens in the vertex shader, so a
frame of rain costs one uniform write rather than fourteen hundred CPU position
updates.

**Deliberately absent:** post-processing of any kind. No bloom pass, no
chromatic aberration, no full-screen effect stack — a bloom pipeline is a second
full-resolution render plus blur passes, which on integrated graphics costs more
than the entire city. The glow is additive blending on the lit quads. Depth is
fog, which is one line.

`frameloop` is `demand` unless rain is running, and `never` while hidden. A
still page costs nothing.

---

## Four things that were wrong, and what they taught

**The light budget starved a level.** A single city-wide probability gave the
substrate 961 lit cells and the interface 60 — a level that renders as black.
The substrate's cell grid is four times finer, so it offers an order of
magnitude more candidates and swallowed the budget. Fixed by allocating per
level, to authored shares. Every level now fills 95–100% of its quota.

**The candidate estimate was 90% wrong.** The first per-level version still
under-filled the engine to 53%, because `floor()` on per-structure dimensions is
sharply non-linear at the sizes that level uses. Replaced with an exact count —
pure arithmetic over the structures that already exist — so the probability is
derived rather than guessed.

**The camera stood inside a building.** Carving the void around the *origin* was
not enough: the camera stands off-centre, so the nearest machine block could end
up ten units from the lens and fill the entire frame. The void that matters is
the one around the viewer, so the generator now owns the camera's standing point
and keeps it clear.

**Fifty navigation cycles killed the WebGL context.** The environment originally
unmounted on the landing page and rebuilt on the way out — the tidier-looking
choice. Repeatedly creating and destroying GPU contexts is exactly what makes a
browser drop one, and when it did, the failure path worked perfectly: the
environment stepped down to `none` and stayed there, permanently, for the rest
of the session. The context is now created once, lazily, and kept; hiding stops
the render loop instead of tearing anything down. Re-measured: one context
across 50 cycles, zero losses, heap 28 → 42 MB and stable.

---

## The legibility scrim

The one that matters most, because nothing would have caught it.

A full-viewport city behind a text-heavy page means every paragraph composites
over whatever is drawn there. Phase 2 verified all 72 ink-on-surface pairings —
but it measured *computed CSS colours*, so it would have gone on passing while
real rendered contrast behind a paragraph fell to roughly **2.6:1**.

The first fix was a flat scrim. Working out its required strength is what showed
the approach was wrong: protecting `--fg-low` over an amber window needs about
90% coverage, which leaves the city at a tenth of its brightness — invisible,
and still paid for in full.

So the city is **framing, not texture**: near-opaque across the content column
where every line of text lives, open at the outer edges where none does. Text
keeps exactly the contrast Phase 2 measured. `tests/contrast.test.ts` now
composites the brightest colour the renderer can draw through the scrim and
asserts AA against every ink, with the worst pairing held above 5:1.

The honest consequence, stated rather than hidden: on a narrow viewport the
column is nearly the whole screen and the city is mostly covered. That is
correct. A phone is where legibility matters most and where the GPU can least
afford the work — which is also why a phone never renders this at all.

---

## `/system` — the environment laboratory

Internal, noindex, not in navigation. Switch level, tier, render mode and
motion against a live scene; read the generated model's own numbers; see the
anchor table resolve route ids to paths.

It earns its place immediately: **the surface level is the richest of the four
and no route can show it**, because its only route is `/`, where this layer
defers to the existing descent scene. Without the lab, the surface city could
not be looked at at all before Phase 6.

One canvas, switched — not four previews. Four live WebGL contexts on one page
to compare four levels would demonstrate exactly the carelessness this phase is
meant to avoid.

---

## Results

| Metric | Phase 4 | Phase 5 | Budget |
|---|---:|---:|---:|
| Initial JS (gz) | 189.5 KB | **189.9 KB** | 200 KB |
| Lazy WebGL (gz) | — | **230.5 KB** | 300 KB |
| CSS (gz) | 9.9 KB | 10.4 KB | 16 KB |
| Dependencies | 6 | **6** | — |
| Unit + content tests | 172 | **238** | — |
| a11y + environment | 70 | **94** | — |
| Draw calls (whole city) | — | **5** | — |

**The entire environment costs +0.4 KB of initial JavaScript.** Everything that
draws or generates a city lives behind `next/dynamic`, including the generator —
a visitor whose device resolves to LOW downloads none of it. No new
dependencies: no asset framework, no post-processing library, no state manager.

---

## Carried into Phase 6

1. **The landing page is still untouched.** It owns its own WebGL scene and the
   environment hides there. Phase 6 is where the two converge, and where the
   surface city — currently visible only in the lab — becomes the first thing
   anyone sees.
2. **Anchors are generated but inert.** They carry stable `routeId`s and
   positions, and nothing consumes them yet. The interaction layer is a later
   phase; building it now would mean guessing at an input model that does not
   exist.
3. **The camera has a model, not a choreography.** `cameraTargetForLevel` and
   `descentDuration` define where it stands and how long a move takes, for every
   pair of levels. The cinematic entry is authored on top of that.
4. **Context loss is one-way.** A lost context steps the environment down
   permanently rather than retrying. With the churn removed this is now rare and
   genuinely exceptional, but `webglcontextrestored` is not handled — a driver
   reset costs the visitor their atmosphere until reload.
5. **`aria-live` on a perpetual timer** in `AllocationGraph` is still there,
   carried since Phase 1. Needs a design decision, not a repair.
