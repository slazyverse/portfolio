# Phase 8 — Living city

The city had the right bones and read as a dark 3D background. Phase 8 is a
visual fidelity and environmental life pass on the world that already exists:
no new generator, no new geometry system, no post-processing.

Two problems, and the second was the one nobody had named.

---

## The monochrome was in the data, not the lighting

Every lit thing in the world was `--accent` or `--cold`. Not *most* things —
every one. Facade windows, street lamps, shopfronts, signage, the pools of
light on the road, both directions of traffic. Two colours, applied to a
hundred different objects, and no amount of work on the light rig could
produce a third.

That is why it read as a monochrome render with two filters on it, and it is
why the fix had to be a vocabulary rather than a palette tweak.

**`Signal` says what a light means. `LightSource` says what it is.**

```
sodium     old orange street lighting — undercity and industrial, sparse
interior   occupied floors and frontage — warm white, most of the warmth
machine    data, plant, telemetry — --cold
warning    hazard, obstruction, restricted — red
utility    powered, clear, in service — green, always small
subject    --accent. Navigation only, and the city never touches it.
```

The Phase 2 rule is untouched and is in fact what the vocabulary is derived
from: warm means people are here, cold means the machine is. A sodium lamp
over a loading bay and a lit office floor are both "people are here"; a hazard
beacon and a service indicator are both the machine reporting its state. The
semantics did not need more colours. The city did.

`interior` is a warm **white**, not an amber. That distance is the point — it
is what keeps `--accent` legible as the subject when both are in frame.

### Where the window colour actually comes from

Most of the lit pixels in any frame are the generated facade atlas, not the
accent lights, and the atlas painted every window from one of two colours
chosen by the variant. Windows are now tinted per floor from six interior
colours — domestic warm, office ceiling grid, equipment floor, plant cold,
older sodium stock, and a room lit only by a screen — with roughly one window
in two hundred being something else entirely, a lit exit sign or a panel in
alarm.

Per floor rather than per window, for the same reason occupancy already ran in
floor-length runs: one tenant lights one floor, and a facade where every window
is a different colour is a Christmas tree.

### Traffic is headlights and tail lights

It ran `--accent` one way and `--cold` the other. A vehicle coming towards you
shows white and one going away shows red, and that single fact is most of what
makes a moving light read as a car rather than as a decoration travelling along
a line. It is also the only red at street level, at the only scale where red
belongs there.

---

## Life after the camera stops

Phase 6 moves the camera. Phase 8 is about the frame *after* it stops.

**Lamps do things.** Every cell carries a behaviour and a seeded phase:
`steady` for the overwhelming majority, `breathe` for plant under load,
`flicker` for a failing sodium fixture, `blink` for hazards. Under a fifth of
the city animates, and a test enforces that ceiling — motion is convincing in
proportion to how little of it there is.

**Obstruction beacons.** Four faces at the crown of the six tallest structures
per level, red, blinking on their own period. Real tall buildings carry them; a
skyline with them reads as a city that aircraft fly over, and one without them
reads as a model. Exempt from the light quota and hard-capped, because the
effect is not proportional to the count — a dozen beacons is a runway.

**Traffic bunches; trains stop.** The vehicle position gained a sine term,
which means what it modulates is *speed*. The amplitude is derived from the
speed and the rate rather than picked, so the derivative never crosses zero and
nothing ever runs backwards. Street traffic opens out and closes up; a train
decelerates to about a twelfth of cruise and holds there, which is what
arriving at a platform looks like from across a city.

**Steam at the middle tier.** `groundFx: boolean` became `steam: number` — 90
plumes at HIGH, 38 at BALANCED, 0 at LOW. A street with nothing moving on it
read as dead rather than as cheaper, which is the one failure a tier reduction
is supposed to avoid.

All of it is GPU-animated from a single time uniform. Nothing is simulated,
nothing is uploaded per frame, and the whole animated environment is still
three draw calls.

---

## What it cost

Measured rather than declared, with `scripts/city-metrics.mjs`, which wraps
every `draw*` entry point on both WebGL prototypes before the page's scripts
run. Peak per-frame cost at 1280×800:

| | draw calls | triangles |
|---|---:|---:|
| surface HIGH | 27 → **26** | 89,482 → **87,272** |
| surface BALANCED | 26 → 26 | 37,790 → 37,016 |
| interface HIGH | 27 → **26** | 89,474 → **87,312** |
| engine HIGH | 27 → **26** | 90,426 → **88,240** |
| substrate HIGH | 23 → **22** | 89,182 → **86,988** |

A draw call *fewer*, which was surprising enough to be worth chasing. Dumping
the per-draw triangle counts for a single frame either side explains it:

```
before: … 1134, 1134, 2246, 2246, 680 …
after:  … 1134, 1134, 2298,       680 …
```

The old accent lights were an `InstancedMesh` with a double-sided transparent
material, and three.js was rendering it **twice**. Rebuilding it as one merged
quad buffer — the pattern `Traffic` already used here — draws the same lights
once, and buys per-cell attributes and a shader for free.

Frame rate is unchanged within the noise of a software rasteriser (1.3–1.6 fps
at full bleed, both before and after); it is a relative figure on this machine
and nothing more.

Bundles: initial JS 190.3 → **190.4 KB** against its 200 KB ceiling, lazy
environment 241.5 → **242.9 KB** against 300, CSS unchanged at 11.0 KB, **six
dependencies**. Nothing was added.

LOW is unchanged and still draws nothing animated, because LOW never starts a
WebGL context at all — it gets the 2D atmosphere, which is a different renderer.

---

## The slow-connection hold

Carried forward from Phase 6: on a slow machine or connection the subject could
be withheld far too long. Reproduced by holding the static chunks back six
seconds — the subject was **still hidden at twelve seconds**.

The cause is precise and is not the deadline's value. The head script withholds
the subject before first paint and expires its own hold after
`SIGNAL_DEADLINE_MS` — but a synchronous inline script does not run until the
stylesheets before it have loaded, because it might ask for a computed style.
So the clock started when the CSS arrived rather than when the navigation did,
and the wait compounded with the thing that had caused it.

The fix is one expression, and it is the deadline being counted from the moment
it was always supposed to be counted from:

```js
setTimeout(release, Math.max(0, SIGNAL_DEADLINE_MS - performance.now()));
```

`performance.now()` is time since the navigation began. The landing store takes
the same ownership on mount through `holdSignal()`, using the same remainder,
so the two cannot disagree. No new timeout, no new constant, and no change to
the Signal architecture.

Measured after: subject readable at **7.6 s** under the same six-second delay,
against still-hidden at twelve. An end-to-end test holds the chunks back and
asserts it.

---

## Tests

`tests/environment-life.test.ts` — 14 assertions on the things a screenshot
cannot show: that the city uses at least four fixture colours, that no facade
cell ever claims the subject's colour, that warm lamps stay on warm signals,
that under a fifth of the city animates, that only hazards blink, that beacons
are whole and capped, that every cell has its own phase, that the same seed
produces the same behaviour *and the same timing*, and that every moving system
reduces at BALANCED without reaching zero.

`tests/e2e/signal.spec.ts` gains the slow-bundle regression above.
`tests/environment-detail.test.ts` now asserts the tiered steam count rather
than the old boolean.
