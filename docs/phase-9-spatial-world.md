# Phase 9 — Spatial world

The city was alive and it was still a backdrop. Phase 9 makes it the
portfolio's spatial language: routes become places, places have landmarks, and
the landmark you are standing in front of is the one lit.

No new generator, no new geometry system, no new draw calls, no dependency.

---

## The camera was a function of the wrong thing

`cameraTargetForLevel(level)`. Four levels, four shots. Every route at the same
depth produced a **byte-identical** camera — `/dossier` and `/systems` are both
Interface, so opening one after the other changed the text and nothing else.
Four of the site's routes share Substrate; all four looked the same way.

That is the whole reason the world read as decoration rather than as
organisation, and it is a one-line diagnosis: the level decided everything and
the route decided nothing.

**Now the level decides where the camera stands; the route decides what it
faces.** Standing position, eye height, pitch and lens are untouched — only the
heading moves, and it is clamped to 30°:

```
MAX_TURN = π / 6
```

Enough that two routes on one level are unmistakably two views. Little enough
that the shaft, the far wall and the drop stay in frame, because those are what
make a level read as that level. Past about this the camera starts facing a
wall, and a portfolio that turns to face a wall when you open a page has made
navigation into something that happens *to* the reader.

A route with no landmark gets the level's own shot. Not every page needs a
place, and inventing one for each would make none of them mean anything.

### Contracts keep their own depth

Contracts share one route record and genuinely sit at different depths —
deadlockd is substrate work, the other two are engine work. `cameraTargetForRoute`
takes an optional level override for exactly that, and an anchor is only used
when it is actually on the level being stood on. Otherwise the camera would
face a landmark two hundred metres above it.

---

## The landmarks existed and nobody drew them

`EnvironmentAnchor` has been in the model since Phase 5: a route id, a level, a
position, an importance. The laboratory counted them. Nothing rendered them.
The city therefore had four levels and no destinations in it.

Two things were wrong, and the second only became visible once the first was
fixed.

**They had no body.** Each anchor kind now has an authored silhouette built
entirely from kit kinds that already exist — mast, platform, ring, tank, pipe,
fin, mass, sign — so the whole set joins `InstancedMesh`es the city was drawing
anyway and costs **no draw call at all**. That constraint is also why they are
assemblies of boxes and one ring: a landmark has to be recognisable at two
hundred metres in fog, and at that range a silhouette is the only thing that
survives.

```
communication-tower   a needle with a collar and a hazard light
terminal              a wide deck under a tall flat face
network-node          four equal drums wired together
contract-hub          a stack of filed layers
infrastructure-core   a heavy drum with services going into it
archive               low, long, closed
ledger                a thin vertical index
relay                 a canted dish on a post
```

Distinct in *shape*, not in colour. A test asserts no two kinds share a
silhouette.

**They were all behind the camera.** The `bearing` field was an absolute
compass heading, which was harmless for four phases because nothing drew them:
the anchors sat correctly around a circle and every single one was out of
shot. `bearing` is now a signed offset in turns from the direction its level's
camera faces — zero is dead ahead — and the specs were re-authored accordingly.

---

## One light, and it means something

Phase 8 built a vocabulary of lamps and reserved `subject` — `--accent` itself
— for navigation objects, then deliberately left it unused, because the city
had no navigation objects in it.

It does now. The anchor for the route you are reading has its emissive parts
switched to `subject` and brightened. Exactly one landmark is lit at a time:
the place you are currently in.

It is derived from the current route on each render rather than accumulated, so
it is **reversible by construction** — there is no state to put back when the
reader moves on, because there was never any state.

---

## What it does not do

No hover, no click, no picking, no raycast, no pointer handling of any kind.
The environment is still `aria-hidden`, still `pointer-events: none`, still
contains nothing focusable and no text. Every destination remains a real link
in server-rendered HTML, reachable by keyboard, and the camera never gates
anything — the page is complete before the city has drawn a frame.

Spatial navigation that the reader cannot use is not a feature, and spatial
navigation that the reader *must* use is a worse one.

---

## Cost

| | before | after |
|---|---:|---:|
| Initial JS (gz) | 190.4 KB | **190.4 KB** |
| Lazy environment (gz) | 242.9 KB | 243.1 KB |
| CSS (gz) | 11.0 KB | 11.0 KB |
| Dependencies | 6 | **6** |

The landmarks are roughly sixty extra instances across nine anchors, in meshes
that already existed. The camera change is arithmetic.

---

## Tests

`tests/spatial.test.ts` — 13 assertions on the claim rather than the pixels:
that a route stands where its level stands and only turns; that two routes on
one level never return the same heading; that the turn never exceeds the bound;
that an unanchored route gets the level's shot; that a contract stands at its
own depth; that every landmark is in front of the camera that has to see it;
that every landmark is made of kit the city already draws; that no two kinds
share a silhouette; that no landmark is born with the subject's colour; and
that the same city builds the same landmarks every time.

The Phase 6 handoff test now asserts against `cameraTargetForRoute("signal")`,
because the resting transform the opening lands on is route-aware — if those
two ever diverged, a five-second reveal would end on a jump.
