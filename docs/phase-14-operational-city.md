# Phase 14 — Operational city

The world had architecture, weather, materials, landmarks and people. Its
infrastructure still ran on nothing.

**No new draw calls, no new systems, and nothing new drawn.** Everything this
phase changed was already on screen; what changed is that the pieces now agree
about what time it is.

---

## The transit line was sixty-eight carriages in a chain

Measured before anything was touched, which is the only reason any of this got
found:

| | before |
|---|---|
| elevated vehicles | **68** on a 741 m ring |
| spacing | 10.9 m, for vehicles 11–17 m long |
| speed | 2.1–5.3 m/s (8–19 km/h) |
| circuit | 140–347 s |
| the deceleration | fixed 39.3 s period, **no relationship to the station** |

So the one genuinely interesting behaviour the lane had — a brake deep enough
to read as a stop — fired every thirty-nine seconds having travelled between a
ninth and a quarter of the way round. It stopped constantly, always somewhere
else. A reader could watch the station for a minute and never see a train do
anything there.

### Anchoring the brake to a place instead of a clock

The whole fix is the shape of one expression. A vehicle's angle was

```
angle = phase + t·speed + A·sin(t·swayRate + …)
```

a free sine whose minimum fell wherever the phases happened to put it. It is
now

```
u     = t·rate + offset
angle = anchor + (u − brake·sin(u·brakeMul))
```

Written as `u` minus a sine **of u**, the minimum of the derivative is at
`u = 0` by construction — and at `u = 0` the offset from the anchor is also
zero. The vehicle is therefore slowest exactly where its anchor is, every
circuit, with no phase to solve for and nothing to drift. Point the anchor at
the station and a train cannot do anything but arrive, slow, dwell and depart.

It never reverses as long as `brake · brakeMul ≤ 1`, which is asserted rather
than assumed.

| | after |
|---|---|
| trains | **4**, evenly spaced |
| line speed | 10.2 m/s (37 km/h) |
| circuit | 72 s |
| arrivals | every **18.0 s** |
| dwell | **0.00°** from the station, at **8%** of line speed |

The budget split is the reason this costs nothing: trains are a *service*
rather than a share of the road, and everything the viaduct stops spending
goes to the street. Sixty-eight carriages became four, and the vertex count
did not move — they changed lanes.

### And a train is only drawn where there is track

The guideway is a sweep of about ninety degrees centred on the station, not a
closed loop; the ring is how a vehicle is *computed*, not something the world
contains. One smoothstep on the angular offset hides a train past the end of
the viaduct, which turns a loop into a service that comes in from one end,
stops, and leaves by the other.

---

## The street queues at junctions now

The same change, applied to the road. A lane's brake minima fall at evenly
spaced *bearings* around its ring rather than at points in time, so traffic
slows at the same handful of places on every lap. That is what a junction
looks like from a distance, and it is free — the previous version bunched on a
timer, which means it bunched wherever it happened to be.

A different count per lane, so the lanes do not all queue together.

---

## The people on the platform are waiting for the train

Phase 13 put commuters on a platform and the trains went past them on an
unrelated clock. A reader could watch for a minute and never see the two facts
connect.

Platform figures now run on the service interval instead of their own cycles,
with their boarding phase set to the moment a train is at rest. The queue
steps forward as one arrives and the platform is empty while it dwells.

It costs **two numbers** and nothing is drawn that was not drawn before. The
stagger is kept — a platform empties over about three seconds rather than in
one frame — because even boarding a train is ragged.

This is the only place in the world where synchronised movement is correct,
and it is deliberately the only place: everyone else keeps their own clock,
which an existing test still enforces.

---

## The station says what it is doing

Six cells on the platform running on the service interval rather than on a
period of their own: the edge lighting comes up as a train arrives, holds
while it dwells, and drops to standby once it has gone. Whether that reads as
doors or as a signal is left to the reader — anything more literal at this
distance would be a modelled door nobody can see.

**Six, and why not nine.** The first draft had nine and failed an existing
guard: the city is not allowed to animate more than a fifth of its lights, and
it was already at **18.9%**. The station had about thirteen cells of headroom
in the entire world and the draft spent eighteen of them. The guard was right
and the draft was wrong — a departure indicator only means anything because
almost nothing else moves.

What went was the far side of the platform, which the camera never sees.
Three cells along the near edge, one departure indicator at the escalator
head, two where the core meets the street. **19.5%**, with the ceiling
untouched.

---

## Service vehicles

A small number of slow, low, amber-beaconed vehicles, anchored where the work
is. A service vehicle is not going anywhere in particular — it is attending to
something — so its brake sits at its own bearing and it spends most of its
cycle crawling there.

The same arithmetic that makes a train dwell at a station makes a cart loiter
at a loading bay, which is the argument for having only one of it.

---

## The interface, by framing rather than by population

The brief asked for better framing, not more people, and the answer is one
line of sorting.

A figure is read as a shape against a background, so the candidate skybridges
are now ranked by how much light is on them and the best two are kept. That
changes what a silhouette is standing in front of, which is the only thing
that was ever wrong with it. Two, not five: a group on one bridge reads as
people, the same number spread over five reads as specks.

The level also gained its transit. Measured with the trains rendered in a
debug colour: **717 px across two clusters**, running on the guideway below
the camera. The interface is the one level where the line is unobstructed.

---

## What it cost

Measured with `scripts/city-metrics.mjs`, peak per frame at 1280×800, against
the Phase 13 merge:

| | draw calls | triangles |
|---|---:|---:|
| surface HIGH | 28 → **28** | 93,242 → **93,246** |
| surface BALANCED | 28 → **28** | 45,096 → **45,096** |
| interface HIGH | 28 → **28** | 93,252 → **93,250** |
| engine HIGH | 27 → **27** | 93,208 → **93,212** |
| substrate HIGH | 24 → **24** | 92,908 → **92,912** |

Draw calls identical; triangles move by at most four, which is 0.004%. The
trains and the service vehicles ride in the traffic mesh and the station's
signals ride in the accent mesh, because both already existed.

Initial JS **190.5 KB** / 200, environment 251.3 KB / 300, six dependencies.
No new texture memory at all.

---

## A critical advisory, which was not this phase's doing

`npm audit` turned up a **critical** RCE in `next/og` affecting Next 16.2.0 –
16.3.5, and this project serves an `/opengraph-image` route. The lockfile was
byte-identical to `main`, so `main` fails the same way; the advisory was
published between phases.

Fixed lockfile-only, to 16.3.8 — and the Phase 12 lesson applied exactly as
before: `npm audit fix --package-lock-only` run on Windows still pruned four
Linux-only optional entries (`@emnapi/core` and `@emnapi/runtime`, each at top
level and under `@tailwindcss/oxide-wasm32-wasi`), which would have broken
`npm ci` on the Linux runner. They were restored and the lockfile diffed entry
by entry: **562 packages either way, nothing added or removed, exactly ten
version changes** — `next` and its nine platform `swc` packages. `npm ci` then
verified against a clean `node_modules`.

---

## Reduced motion and accessibility

Everything added here is behind the same `motion` gate as the traffic, the
steam and the people. Under reduced motion the trains, the carts and the
commuters are all absent, and the station's lights resolve to a constant —
measured at **zero** changed pixels between two frames a second apart, which
the existing end-to-end test already enforces.

Nothing operational is exposed to an accessibility API. A vehicle has no
identity and a figure still has no name, id or route.

---

## Tests

`tests/environment-operation.test.ts` — 21 assertions in five groups:

- **a train stops at the station** — it runs a line rather than a chain, moves
  at a speed a train moves at, is slowest within one degree of the platform at
  under a tenth of line speed, arrives on an interval a reader will see one on,
  and is drawn only where there is track.
- **nothing in the street ever runs backwards** — the `brake · mul ≤ 1` bound
  holds for every vehicle, sampled over four minutes of motion, and the street
  bunches at bearings rather than at times.
- **the city sends somebody to look after itself** — service vehicles exist,
  are few, are slow, and the budget the viaduct released went to the street.
- **the people on the platform are waiting for the train** — the queue is on
  the service interval, boards when a train is at rest, is still staggered, and
  everyone *not* on a platform keeps their own clock.
- **the station says what it is doing** — six cells, exempt, in phase with each
  other, at the station, on the two levels that have one, and still under the
  animation ceiling.

The one that earned its place fails with *"a train dwells away from the
station: expected 51.57 to be less than 1"* if the anchor is ever pointed
anywhere but the platform.

---

## What this phase did not do

- **The surface station is partly occluded.** The viaduct passes behind the
  central tower cluster at that level, so the trains read at the right-hand
  frame edge rather than at the platform dead ahead. Giving the station a
  sight-line clearance the way Phase 10 gave the landmarks one would fix it,
  and would relay every building on every level — too large a blast radius to
  take on at the end of a phase, and squarely in the generator-rebuild
  territory the brief rules out.
- **No building operational cues.** Lift indicators, door states and machinery
  cycles were listed as options and none were built; the animation budget that
  would have paid for them went to the station, which is the more legible
  signal.
- **The dwell is a deep brake, not a stop.** A vehicle that actually stops
  needs telling when to leave, which is a state machine. At this distance the
  difference between stationary and creeping at 0.8 m/s is invisible, and the
  difference between stopping and not stopping is not.
