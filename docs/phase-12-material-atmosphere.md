# Phase 12 — Material and atmosphere

The last environmental fidelity pass. Four changes, all of them about whether
surfaces and weather know anything about each other, and none of them visible
in a diff — which is why three of the four were wrong for six phases without
anyone noticing.

No new system, no new dependency, **no new draw calls and no new triangles**.

---

## Rain fell through the bridges

The loudest way weather can announce that it is an effect rather than a
condition. The viaducts, the station canopy and every skybridge in the city
are modelled, lit, and drawn in front of the reader — and the water went
straight through all of them.

Each drop is now asked what is above it, using the same rule the contact
shadows already use: long and narrow covers, broad does not. A roof over the
room you are standing in is not shelter; it is the room.

- A drop under a span **starts at the soffit** rather than at the cloud base.
- **Four in five of them are not drawn at all.** The dry patch under a bridge
  is the observation, and it is also what makes the shelter legible from
  outside it — the edge of the dry patch is where the rain starts again.
- The fifth becomes a **drip**: water running off the underside, slower and
  shorter than rain, because a streak is a function of speed.

Depth got the other half of it. A drop's streak length now scales with how
close it is, so the foreground reads as long bright strokes and the far shaft
as ticks dissolving into the haze. Rain that is the same length at every
distance is a screen overlay however well it fades.

The rules live in `src/lib/environment/weather.ts`, which imports no rendering
library. The component is left with the buffers and the shader, and `rainfall()`
is asserted in Node like everything else the world is built from.

---

## Rain is the colour of whatever is lighting it

Phase 11 gave the steam this argument; the rain had the same problem. Each
drop takes the colour of the strongest lamp near it, weighted by brightness
over distance, and keeps the cold of the sky where nothing is lighting it.

**The reach is measured rather than picked.** At forty metres — roughly how
far a street lamp throws enough light to read by — **85% of the drops on the
surface level came back tinted**, which is not lit rain, it is a colour wash
over the whole frame. The test that caught it now holds the line at half:

```
reach 40m -> 85.3% of drops tinted
reach 30m -> 66.9%
reach 24m -> 49.7%
reach 18m -> ~28%      <- chosen
reach 12m -> 15.0%
```

Rain near a lamp goes orange; rain between lamps stays the colour of the sky.

---

## Two levels were standing on the same anonymous slab

The engine and substrate floors shared the generic grime map, tinted by one
near-black token — correct, in that a road map would have put a dashed centre
line through a plant hall, and useless, in that it said nothing. The ground is
most of the lower half of every frame at those depths.

Each has its own surface now, and they differ because the places do:

**Engine — a working deck.** Structural bays with a proud lip on one side,
open grating over the services, a painted walkway worn through in the middle
where people actually walk, access hatches off the traffic route, an arc
scuffed by something that swings, and the oil that has been dripping under it
for years.

**Substrate — older, deeper, wetter.** Big poured slabs, a drainage channel
with damp margins either side, spalling where the concrete has lost its face
and the aggregate shows through, efflorescence from salts carried out by
water, and patch over patch in mixes that never matched.

Both carry a roughness map, so oil and standing water are the only places a
highlight forms. `FLOOR_ALBEDO` is asserted deeper-is-darker, which is the
ordering that was lost when depth was carried entirely by the light rig.

---

## A window returned the same reflection as the wall

The facades took the **shared grime map** as a roughness map — a texture with
no relationship to them, tiled at its own rate. In a night city where almost
every highlight is a window, glass and precast came back identical.

There is now a roughness map per variant, painted in the same pass as the
albedo and the emissive so all three stay in register. Glass is the only
genuinely smooth thing on an elevation; metal sills sit between; painted
structure, concrete and louvred plant floors climb from there; and grime is
rough wherever it lands, including straight across the glazing — which is most
of what separates a maintained frontage from a neglected one. The windows of a
building nobody washes stop being windows.

---

## What it cost, and what it nearly cost

Measured with `scripts/city-metrics.mjs`, peak per frame at 1280×800, against
the Phase 11 merge:

| | draw calls | triangles |
|---|---:|---:|
| surface HIGH | 27 → **27** | 93,168 → **93,168** |
| surface BALANCED | 27 → **27** | 45,056 → **45,056** |
| interface HIGH | 27 → **27** | 93,188 → **93,188** |
| engine HIGH | 26 → **26** | 93,184 → **93,184** |
| substrate HIGH | 23 → **23** | 92,896 → **92,896** |

Identical. Everything here is texture and shader work; the only geometry that
changed is which rain drops exist, and rain is lines.

Bundles: initial JS **190.4 KB** / 200 unchanged, environment 244.5 → **246.7
KB** / 300, CSS 11.0 KB, six dependencies, 0 vulnerabilities.

### Texture memory, which is where this phase nearly went wrong

Six new maps — four facade roughness, two floors with their own roughness —
and at full resolution they put the HIGH set at **19.8 MB against a 16 MB
ceiling**. The memory test went on passing, because it carried a *copy* of the
arithmetic that knew about neither those maps nor the road roughness map added
in Phase 11.

The fix was the maps, not the budget:

- every roughness map is generated at **half the edge length** of the thing it
  describes, because roughness varies far more slowly than albedo — a facade's
  is "glass, wall, louvre, dirt", not every mullion and sill;
- the deep floors **scale with the tier** instead of being pinned at 256,
  which is what pushed BALANCED and LOW past their own ceilings;
- the test now asserts `textureMemoryMB` itself rather than a copy of it, so
  the two cannot drift apart again.

| tier | texture set | ceiling |
|---|---:|---:|
| HIGH | 15.79 MB | 16 |
| BALANCED | 8.88 MB | 9 |
| LOW | 3.95 MB | 4 |

No ceiling was raised.

---

## What this phase did not do

- **Shadow and occlusion** is unchanged. Contact shadows under every mass and
  every spanning viaduct already existed, and facade side-lighting is handled
  by the standard material and the light rig — a per-instance orientation term
  would double-count it. The shelter rule reuses that same geometry, which is
  the only thing §6 asked for that was missing.
- **Water on metal** got an ordering and a vocabulary (`WET_RESPONSE`), not a
  per-kind rework. The kit pieces keep the roughness and metalness values an
  earlier pass tuned by hand against specific failures; replacing them
  wholesale would have discarded that tuning to satisfy a table.
- **Runoff** stops at the ground. Water gathers at the kerbs and gullies
  painted into the road in Phase 11 and drains down the substrate channel, but
  nothing connects a drip to a puddle — that would want a simulation, and the
  brief rules one out.
- **Facade maintenance by district** is carried where it always was: per
  building, through wear and vertex colour. This phase changed how a facade
  *reflects*, not how dirty it is.

---

## Tests

`tests/environment-atmosphere.test.ts` — 18 assertions in four groups:

- **rain knows what is above it** — shelter finds spans and ignores rooms; a
  sheltered drop starts at the soffit and an open one at the cloud; most drops
  under a cover are not drawn; a drip is slower and shorter than rain; no drop
  is drawn with under four metres to fall; the storm is identical across runs;
  under half of it is tinted; and it scales with the tier.
- **water does not make everything shiny** — the five materials stay in the
  order water actually puts them in, metalness stays on its own axis, and
  nothing becomes a mirror.
- **a floor says where you are** — each level gets the surface it has, deeper
  is darker, every floor value clears the specular floor, and a highlight
  forms only where oil and water are.
- **a window is not the wall it is set into** — glass is the smoothest thing
  on an elevation, the order runs glass → metal → painted → concrete → louvre,
  and dirt is rougher than what it lands on.

The tinted-rain assertion is the one that earned its place: it failed on first
run at 85%, which is how the lamp reach came to be measured instead of assumed.
