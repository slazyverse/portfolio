# Phase 5 — Procedural Environment

The world engine. A generated, deterministic cyberpunk-inspired city that exists
to serve the portfolio and is never required to read it.

**Not in this phase:** the cinematic landing, the boot sequence, audio, camera
choreography, clickable city objects.

---

## The one rule

> The city is a layer. The portfolio is the product.

The environment is `aria-hidden`, holds no text, receives no pointer events,
contains nothing focusable, and carries no information that exists nowhere else.
Every route renders, reads and indexes identically with the environment removed
— asserted by denying WebGL at `HTMLCanvasElement.prototype.getContext` and
walking every route, and again by deleting the layer outright and navigating.

---

## Art direction

**A shaft, not a skyline.** The site's information architecture is already four
levels deep and its verb is already *descend*, so the city is a vertical well
with the levels stacked as bands of one continuous structure, camera inside it.
The shaft tapers as it descends (span ×1 → ×0.42) and the eye height drops with
it, which is the same compression the design system applies to the same levels.

| Level | Character | Signal |
|---|---|---|
| 00 Surface | Street canyon, towers, rain, a landmark | amber |
| 01 Interface | Masts and thin towers, cold data spines | cold |
| 02 Engine | Heavy machine blocks, pipe runs, furnace light | amber |
| 03 Substrate | Dense server hall, cable trays, near-darkness | cold |

---

## Architecture

```
lib/environment/
  seed.ts       deterministic PRNG
  kit.ts        the architectural grammar — pure, no three.js
  types.ts      the data model
  generate.ts   the city, as pure data
  camera.ts     where the camera stands at each level
  quality.ts    what each tier may spend
components/environment/city/
  textures.ts   procedural canvas textures
  palette.ts    material reflectance + the light rig
  Buildings.tsx merged facades + instanced kit
  World.tsx     street, skyline, rain, mist, accents, conduits
```

### The architectural grammar

A building is a podium, a shaft that steps back as it rises, a crown, and the
plant that keeps it running. Seven part kinds — mass, fin, roof unit, tank,
mast, sign, pipe — assembled under rules rather than dice.

**Procedural is not random.** Every choice is bounded by an archetype and by the
district. The generator has latitude inside the rules; it does not get a vote on
the rules.

### Two techniques, chosen per problem

**Masses are merged, not instanced.** Every building volume of a facade variant
becomes one geometry with its UVs baked at world scale, so a 27-metre podium and
a 9-metre crown show the same size of window and the texture never stretches.
Instancing would share one set of UVs between every copy; fixing that needs a
shader injection into three's UV chunks, which works until three reorganises
them and then fails silently. Merged geometry costs about sixteen thousand
vertices for the whole city and is correct by construction.

**Kit pieces are instanced.** Small, repeated, untextured — nothing to gain from
their own UVs, everything to gain from sharing a draw call.

### Textures are generated, not downloaded

Ten textures drawn into a canvas at runtime from the same seeded generator that
places the city. **Zero network bytes, zero licensing surface, deterministic,
and resolution on demand.** The facade *tiles* up a building rather than
stretching, so a 512 px map carries a 230-metre tower at five tiles of effective
resolution.

Full record in [asset-manifest.md](asset-manifest.md). There are no external
assets — not "none yet", none by design.

---

## Five things that were wrong, and what they taught

**The city was painted near-black.** Facade albedo used the interface tokens,
which are near-black because they sit behind text. In a physically-based
renderer albedo is *reflectance* — concrete returns about a third of the light
that hits it. Every surface rendered as a flat silhouette under any lighting at
all. Materials now have their own tokens (`--env-material`, `--env-metal`,
`--env-glass`), and the night comes from the lighting.

**Then the lights were painted near-black too.** The rig used mood colours —
dark browns and navies — as the *light* colours. A light whose colour is
`#2a221c` emits almost nothing. A light's colour is its hue; its intensity is
how much of it there is.

**Then the intensities were still wrong, and arithmetic said why.** Three's
Lambert term is `albedo × irradiance / π`; with concrete at 0.11 linear, an
irradiance of 0.4 returns 0.014 — indistinguishable from the fog. Reading a
night city wants roughly 0.02–0.06, so irradiance has to land near 1.1–1.5. The
values are derived from that, not guessed.

**The CSS base layer was painting over the entire WebGL city.** Both are
absolutely positioned with `z-index: auto`, so stacking fell to DOM order and
resolved the wrong way. The city rendered perfectly the whole time and none of
it was visible. Stacking is now explicit: base, renderer, scrim.

**Windows were seven metres across.** The facade tile was 63 m wide over nine
bays. On a fifteen-metre block that is two windows per face, each the size of a
garage door — the single most reliable way to make architecture look like a toy.
The tile is 23 × 62 m over 11–19 bays and 22–34 floors, which is a real window
module and a real floor-to-floor.

Plus, caught by the tests rather than the eye: **the LOD system was inert**
(`nearRadius` 190 exceeded the world's radius, so every building was "near"),
**texture memory was 49 MB** rather than the 12 MB the comment claimed, and
**masts were sized absolutely**, putting 40-metre poles on 2-metre server
cabinets.

---

## Rendering

**Nineteen draw calls**, measured off `renderer.info`:

| | |
|---|---|
| Building masses | 4 merged meshes, one per facade variant |
| Kit pieces | 6 instanced meshes, one per kind |
| Accents, conduits, street, skyline, glow | 5 |
| Rain, ground mist | 2 at HIGH |

**Deliberately absent:** no post-processing of any kind — no bloom pass, no
chromatic aberration, no screen-space pipeline. A bloom chain is a second
full-resolution render plus blur passes, which on integrated graphics costs more
than the entire city. No shadow maps either. Depth is fog; glow is additive
emissive.

The one expensive feature is the planar reflection on the street: HIGH only,
surface and engine only. Its blur radius was cut from 340 to 110 after it made
the renderer miss frames badly enough that a screenshot could not be captured.

### Content first, atmosphere second

The environment waits for `requestIdleCallback` before it builds. Generating ten
textures and merging several thousand vertices is a few hundred milliseconds
that belong *after* the page is readable. The CSS base is server-rendered and
unaffected, so there is atmospheric depth from the first paint — what waits is
the expensive part.

---

## Quality tiers, by fidelity

| | structures | lit cells | rain | skyline | texture | reflections |
|---|---:|---:|---:|---:|---:|---|
| HIGH | 170 | 1200 | 2200 | 64 | 512 px | 256 px, blur 110 |
| BALANCED | 110 | 520 | 900 | 38 | 384 px | — |
| LOW | 54 | 0 | 0 | 20 | 256 px | — |

**Mobile resolves to LOW and never fetches the three.js chunk.** Asserted on a
Pixel 7 profile.

---

## Results

| Metric | Phase 4 | Phase 5 | Budget |
|---|---:|---:|---:|
| Initial JS (gz) | 189.5 KB | **190.0 KB** | 200 KB |
| Deferred JS (gz) | — | **299.4 KB** | 300 KB |
| CSS (gz) | 9.9 KB | 10.5 KB | 16 KB |
| Dependencies | 6 | **6** | — |
| Unit + content tests | 238 | **262** | — |
| a11y + environment | 97 | **106** | — |
| Draw calls | — | **19** | — |
| Texture memory (HIGH) | — | **≈13 MB** | 16 MB |

**The environment adds +0.5 KB of initial JavaScript.** Its own deferred share
is about 26.7 KB; the rest of the 299.4 KB is three.js (230.5 KB) and the
troika text renderer used by the Phase 1 descent scene (41.2 KB), which Phase 6
replaces.

The budget gate was also fixed: it reported the *largest* non-entry chunk and
called that "lazy WebGL", which cannot see a budget being spent in pieces. It
now sums the whole deferred payload.

### Lifecycle

Fifty navigation cycles through the landing page, measured by hand: **one WebGL
context throughout, zero losses, heap 28 → 42 MB and stable.** The automated
test does eight cycles — accumulation, if it happens, happens immediately — and
the fifty-cycle figure is recorded here rather than pretended to in the suite.

---

## Visual QA

`scripts/city-shots.mjs` drives the `/system` laboratory through every level,
tier and fallback mode and writes the frames to disk. Scripted because a review
you cannot repeat is an anecdote: the city is deterministic, so two runs at the
same commit produce identical images and a diff between commits is a real
signal.

The laboratory gained a **full-bleed** view for the same reason — a city judged
in a 400-pixel strip is a city nobody has looked at.

### The test suite is serial now

From this phase the e2e suite drives a real WebGL city on a software rasteriser
in CI. Run in parallel the tests time each other out, and across several runs
the failures moved between an axe audit, a landmark check and a navigation cycle
— none of which had anything wrong with them, all of which passed alone. A gate
that fails for reasons unrelated to the code is not a gate. Serial costs about
four minutes and buys a deterministic answer.

---

## Honest assessment against the AAA bar

What it achieves: a coherent, atmospheric, believably-scaled city with an
architectural grammar, a landmark, real materials, motivated lighting,
atmospheric perspective, weather, a horizon, and detail spent where the camera
is looking — at 19 draw calls, no external assets and no new dependencies.

What it is not: photoreal. It reads as strong stylised game art, not as a
high-budget production render. The specific gaps:

1. **Geometry is orthogonal.** Boxes with setbacks. No bevels, no angled
   massing, no balconies or curtain-wall relief — silhouettes are varied but the
   vocabulary is rectilinear.
2. **Windows emit flatly.** A lit window is a uniform rectangle, not a room with
   depth, blinds and falloff.
3. **Four facade textures.** Repetition is visible under inspection.
4. **The street is empty.** No kerbs, barriers, vehicles, poles or debris — the
   ground plane reads as a wide road rather than as a used street.
5. **No shadow contrast.** Without shadow maps, faces are separated by normals
   alone; the lighting is soft everywhere.
6. **Reflections are subtle.** Most of the wet look comes from the texture.

Items 4 and 1 would give the largest return next, in that order.

---

## Carried into Phase 6

1. **The landing page is untouched.** It owns its own WebGL scene and the
   environment hides there. Phase 6 is where they converge — and where the
   41.2 KB troika chunk stops being paid for.
2. **`/system` also stands down the global environment.** Two complete cities on
   one page could not finish a frame.
3. **The scrim is a judgement call.** The city is near-opaque behind the content
   column and open at the edges. With materials now lit correctly it is markedly
   more present than in the first draft; text keeps the contrast Phase 2
   measured, and the bound is asserted against the material tokens.
4. **Anchors are generated but inert.** Stable `routeId`s and positions; nothing
   consumes them.
5. **Context loss is one-way.** `webglcontextrestored` is not handled.
6. **`aria-live` on a perpetual timer** in `AllocationGraph`, carried since
   Phase 1.


---

# Phase 5B — art-direction pass

The engine from Phase 5 is unchanged. What changed is what it builds.

Full art direction in [city-world.md](city-world.md); this section records the
engineering and the mistakes.

## The world now has a social structure

Every building carries a **district** — corporate, commercial, residential,
industrial, undercity — assigned by distance from the central shaft rather than
by chance. Maintenance standard, signage density, storefronts, exposed services,
balconies and street clutter all fall out of that one field, so inequality is a
placement rule rather than a mood. Buildings over 34 m also carry an **owner**,
one of five invented corporations, chosen by district.

Nothing in the composer decides what class a building belongs to. It reads the
district profile and spends accordingly.

## Architecture

Three new kit pieces, all instanced: `platform` (relief bands, setback shelves,
balconies), `bridge` (skybridges between genuinely close neighbours), `prop`
(cabinets, bollards, railings, vents at human scale). Plus a signage hierarchy
of four tiers, each with a host-size requirement.

Windows became holes rather than rectangles: a shadowed reveal, inset glass, a
lit sill and a bright mullion, then one of four interior lighting states — full
pane, blind partly drawn, dim light from deeper in the room, or a partition with
one side lit. Uniform rectangles were the strongest remaining tell.

Facade repetition is broken by a per-building tint baked into the merged
geometry — one float3 per vertex, no extra draw call.

## The city is occupied

Traffic, steam and contact shading, all GPU-animated from one time uniform.
Nothing is simulated: a vehicle's position is a function of time, so the CPU
writes one uniform per frame.

## The reflection pass is gone

Phase 5 bought a planar reflection from drei. It was a second full render of the
scene, and when Phase 5B pushed the deferred bundle to **306 KB against a 300 KB
ceiling**, it was the right thing to lose.

What replaced it is cheaper and reads better: the light that *causes* a
reflection, painted straight onto the road. On a wet street what you actually
see is colour bleeding down from every sign, not a mirrored building — and a
pool of light under a source is one additive quad.

With the reflector gone and drei's `PerspectiveCamera` replaced by a plain
three.js camera, **the environment has no dependency on drei at all.**

## The budget metric was wrong — twice

Worth recording because the second mistake looked like a fix for the first.

It began as *the largest chunk not in the entry*, which was three.js. That
cannot see a budget spent in pieces. Phase 5 changed it to *the sum of every
chunk not in the entry* — which over-corrected badly, because in the App Router
**every route's** page chunk is absent from the home page's HTML. That sum was
counting `/system`, `/record`, `/contracts` and the home page's own text
renderer as though they were the environment. It read 302 KB for an environment
that is 240.

It now measures the environment: three.js plus the chunks that only load when a
city is drawn, identified by content markers that survive minification. The full
deferred figure is still printed underneath, unbudgeted, so nothing hides behind
the narrower definition.

**This metric was corrected while it was red.** Both figures are in the report.

## Three more bugs the work surfaced

**Masts were sized off footprint depth and rendered fully emissive.** A server
rack is 2 m wide and 11 m deep, so `max(w, d)` gave the substrate 40-metre masts
on 5-metre cabinets — and because the mast material was emissive, each drew as a
solid glowing bar. Masts are sized against host *height* now, they are metal,
and the obstruction light is a separate one-metre emissive part at the tip.

**Light pools stacked into a flare.** A commercial frontage carries a storefront
band plus several shop signs, and every one wanted its own additive pool in the
same square metre of road. Capped at two per building.

**Traffic read as glowing planks.** Streaks up to eleven metres long on three
elevated lanes, additively blended, at a camera angle where the lane tangent is
nearly horizontal. Shorter, dimmer, one elevated lane.

## Results

| Metric | Phase 5 | Phase 5B | Budget |
|---|---:|---:|---:|
| Initial JS (gz) | 189.9 KB | **190.2 KB** | 200 KB |
| Lazy environment (gz) | — | **240.0 KB** | 300 KB |
| All deferred JS (gz) | 299.4 KB | 302.7 KB | not budgeted |
| CSS (gz) | 10.4 KB | 10.5 KB | 16 KB |
| Dependencies | 6 | **6** | — |
| Unit + content tests | 262 | **262** | — |
| a11y + environment | 106 | **106** | — |

## Honest assessment

Materially better than Phase 5: the city has a social structure that reads
without copy, windows have depth, the street is occupied, buildings are grounded
by contact shading, and there is a landmark with a podium complex around it.

Still not photoreal, and the gaps are specific:

1. **Geometry is orthogonal.** Boxes with setbacks, relief bands and balconies.
   No bevels, no angled massing, no curtain-wall relief.
2. **The substrate composition is weak.** It reads as a distant industrial
   skyline rather than an enclosed hall, and the empty floor takes roughly half
   the frame.
3. **Four facade textures.** Per-building tint helps; close inspection still
   finds the repeat.
4. **No shadow contrast beyond contact shade.** Faces are separated by normals.
5. **The elevated lane is thin.** One lane of transit does not read as a transit
   *system*.
6. **Corporate identity is structural, not graphic.** Marks are declared but
   signage renders as coloured panels, not as shapes.

Items 2 and 1 give the largest return next.
