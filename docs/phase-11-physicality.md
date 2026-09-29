# Phase 11 — Physicality

Phase 8 made the city alive. Phase 9 made it mean something. Phase 10 made it
authored. This pass is about the gap between a scene and a place, which is
almost entirely a question of whether surfaces behave like materials.

Four changes, no new system, no new dependency, no new draw call.

---

## The road had markings and no history

The foreground road was named as the weakest surface in the frame at the end
of three separate phases, and the diagnosis was always the same: it was one
46-metre tile with a centre line, two kerb lines, a hazard hatch and some
grime, repeated across the whole ground plane. Nothing had ever happened on
it.

A road that has been driven on for thirty years is almost entirely incident.
The tile now carries:

- **wheel tracks** — four polished strips where the tyres go, lighter in
  albedo as the binder wears off the aggregate. This is the single addition
  that does most for physical scale, because it states how wide a vehicle is
  without drawing one.
- **construction joints** — longitudinal between paving lanes, transverse
  where one day's work stopped, with a lip on one side that catches light
  along its whole length.
- **patched asphalt** — a trench cut for a service and filled back in, newer
  and darker, outlined by the sealant run round the cut.
- **access covers**, off the wheel tracks, because that is where the services
  actually run.
- **drainage** — a gully at each kerb and the damp fan of road draining into
  it. Water on a road goes somewhere; a uniformly wet surface is one nobody
  has thought about.
- **cracks**, thin and going somewhere. A straight crack reads as a scratch.

---

## Wet is a specular property, not a colour

The bigger half of the same change. All of the above painted into an albedo
is a picture of a road. What makes a surface read as wet is how it returns
light, and that was a single scalar — `roughness={0.52}` — for the entire
ground plane.

`buildRoad` now emits a **roughness map** alongside the albedo, drawn in the
same pass so the two agree: a puddle that is dark in one map and smooth
somewhere else in the other is worse than no puddle at all. Standing water is
the smoothest thing on the surface, sealant and fresh patching the roughest,
paint and cast iron in between.

### What that nearly cost

The first draft put standing water at an effective 0.35 roughness. Measured
over the road half of the surface shot, blown-out pixels went from **0.018% of
the frame to 0.416%** — a twenty-three-fold increase, and the beginning of the
exact specular blow-out that an earlier phase had already fixed once by hand.

Raising the floor to an effective 0.43 brought it to **0.141%**, with **nothing
clipped to white** in either build and every hot pixel confined to the sodium
lamp's own wash, where a bright specular belongs. Mean road luminance moved
52.18 → 52.90, so the road is not brighter; its highlights are.

Those numbers are now a test. `ROAD_ROUGHNESS` and the value below which the
key light blows out live in `src/lib/environment/materials.ts`, which imports
no rendering library, and `tests/environment-physicality.test.ts` asserts that
no painted value reaches the floor, that the base still averages the 0.52 that
fixed the original bug, and that water is smoother than asphalt while sealant
is rougher. The same file holds the rule that only the surface level is a
street — the other failure this ground plane has had, when a server hall two
hundred metres underground was given a dashed centre line.

---

## Steam is the colour of whatever is lighting it

Plumes were drawn in the fog colour, which is the one colour guaranteed to
make them invisible: fog is what the *distance* looks like, not what the vent
looks like. Each plume now takes the colour of the strongest lamp within
thirty metres, weighted by brightness over distance, and keeps the fog colour
where nothing is lighting it. One vertex attribute, no new draw call.

That change immediately exposed something that had survived four phases: the
plume was a **flat quad at constant alpha**. A hard-edged rectangle the same
colour as the distance is a hard-edged rectangle nobody can see — but the
moment it took a lamp's colour, the engine level picked up a warm haze of
brown slabs laid over the whole mid-ground.

Two instructions in the fragment shader fixed it, using a varying that was
already there. Measured against the previous phase on the engine shot after
the fix: blown-out pixels 0.055% → 0.058%, mean luminance **identical at
24.30**, 95th percentile **identical at 50**. The haze is gone and the tint
stayed.

The cast is mixed three quarters of the way back toward the fog. Steam is a
diffuser, not a gel.

---

## A landmark you cannot find is data

Phase 9 built nine landmarks out of kit pieces and Phase 10 stopped buildings
being generated through them. Neither addressed the note that kept coming
back: several of them read as smudges. A four-drum cluster seven metres high,
standing among buildings of two hundred and eighty, is not a landmark.

The answer was not to make them big. It was to give each one something
vertical to be seen against the sky by, and to stop the low ones being unlit:

- **communication tower** — 34 m of mast on three splayed legs with two
  collars. A single collar is a lollipop; two read as something engineered.
- **terminal** — a lintel across the two piers. A gateway closes a silhouette;
  two piers leave it as a pair of sticks.
- **contract hub** — a mast on the crown, because the layers alone were being
  read as another setback on another tower.
- **node array** — raised on a plinth, a mast up the middle, and green service
  indicators at its head. It was the only landmark in the world with nothing
  lit on it at all, which a test now forbids.
- **infrastructure core** — one stack tall enough to find it by.
- **archive** — stays low, because that is what it is. Readability comes from
  a mast and a lit band along the frontage instead.
- **ledger** — a crown, so it stops reading as an unfinished column.
- **relay** — a longer post, clearing the buildings around it.

Three assertions hold the line in both directions: every landmark tops out
above twelve metres, none reaches forty-five, and only the communication tower
is the tallest. *Do not make every anchor huge* is the easier half of the
brief to get wrong.

---

## What it cost

Measured with `scripts/city-metrics.mjs`, peak per frame at 1280×800, against
the Phase 10 merge:

| | draw calls | triangles |
|---|---:|---:|
| surface HIGH | 27 → **27** | 93,000 → 93,168 |
| surface BALANCED | 27 → **27** | 44,888 → 45,056 |
| interface HIGH | 27 → **27** | 93,020 → 93,188 |
| engine HIGH | 26 → **26** | 93,016 → 93,184 |
| substrate HIGH | 23 → **23** | 92,728 → 92,896 |

**No new draw calls and 168 triangles**, all of them landmark silhouette. The
road work is texture, the wetness is a roughness map, and the steam changes
are one attribute and two shader instructions.

Bundles: initial JS **190.4 KB** / 200 unchanged, environment 243.1 → **244.5
KB** / 300, CSS 11.0 KB, six dependencies, 0 vulnerabilities. GPU texture
memory gains the roughness map at half the road's edge length — about 0.35 MB
at HIGH — and the stated ceilings are unchanged.

---

## One thing that was not physicality

The accessibility gate failed on this branch with a real WCAG violation
rather than a timeout: `html-has-lang`, serious, on an unknown contract slug.

It was not a Phase 11 regression. Production, running the Phase 10 merge, had
it too — a mistyped contract URL was served as Next's own error shell,
`<html id="__next_error__">`, with no `lang` attribute, so a screen reader
arriving there was handed a document in no stated language. The route
declares `generateStaticParams` but left `dynamicParams` at its default, so
an unknown slug was still rendered at request time, reached `notFound()`, and
fell out of the root layout entirely.

`export const dynamicParams = false` makes an unknown slug a routing miss
instead of a render failure, so it resolves to the site's own 404 inside the
root layout — chrome, skip link, language and all. The set of contracts
genuinely is closed, and is known at build time.

Outside the brief, and fixed anyway: it is one line, it is serious, and our
own gate is what found it.

---

## What this phase did not do

The brief asked for more than one pass can honestly deliver, and the gap
matters more than the list of what was done.

- **Shadow and occlusion** is unchanged. Contact shadows under every mass and
  under every spanning viaduct already existed from an earlier phase, and
  facade side-lighting is handled by the standard material and the light rig —
  adding a per-instance orientation term would double-count it. Nothing here
  improved that, and nothing here needed to.
- **Rain** is untouched. Depth variation, runoff, and different exposure
  between sheltered and open areas are all still to do; only the *ground* got
  wetter.
- **Water behaviour on metal** is unchanged. The roughness map is the road's
  alone; kit pieces still carry a single roughness per kind.
- **The non-paved floors** — engine and substrate — got no roughness map. A
  worked concrete slab is uniformly rough, so a map there would be memory
  spent to say nothing, but it also means those two levels gained nothing from
  this phase.
- **Facade material variation** is Phase 8's and Phase 10's. Glass versus
  painted panel is still carried by the facade atlas rather than by a material
  response.

---

## Tests

`tests/environment-physicality.test.ts` — 11 assertions across three groups:
every painted roughness stays clear of the blow-out floor; the base still
averages the value that fixed the original bug; water is smoother than asphalt
and sealant rougher; the map varies enough to be worth its memory; exactly one
level is a street; every landmark tops out above twelve metres and below
forty-five; the communication tower is the tallest; every landmark has a lit
element; and the same seed builds the same landmarks.

The lit-element assertion found the node array unlit on the first run, which
is the kind of thing a screenshot of a dark city does not show you.
