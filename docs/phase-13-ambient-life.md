# Phase 13 — Ambient life

The city had architecture, depth, weather, materials and route-aware
landmarks, and the only thing in it moving under its own power was traffic —
which is people in boxes. Nobody waited for the train that runs through the
middle of every shot. Nobody operated the plant floor. The reader could see
that the place had been built and could not see that anyone used it.

**One new draw call across the whole city, and two triangles per person.**

---

## The argument for not building a character system

At the distance this is actually viewed from, a figure is between ten and
forty pixels tall. What carries *a person is there* at that size is the
proportion of the silhouette and the fact that it is going somewhere. What
carries nothing at all is topology, skinning, a texture or a face.

So a person here is two triangles and a fragment shader. The silhouette —
head, tapering torso, two legs whose feet swing apart and together — is carved
out of the quad arithmetically rather than sampled, which costs about fifteen
instructions and no memory, no atlas and no licensing surface. Everything
animates from the same single `uTime` uniform the traffic and the steam
already use: no CPU work per frame, nothing uploaded after construction.

The proportions are metres divided by the quad: shoulders 0.44 m across, a
0.20 m head, hips at 0.84 m on a person of 1.75. Getting those wrong by a
little is what makes a silhouette read as a bollard or as a child.

---

## The placement is the whole content

A person standing in the middle of a road is a bug. The same person at the
edge of a platform is a commuter, at the face of a machine is an operator, and
under a lit frontage at midnight is someone leaving late. None of that is in
the figure. All of it is in where the figure is and what it does there — which
is why it lives in `src/lib/environment/occupancy.ts`, imports no rendering
library, and is asserted in Node like everything else the world is built from.

Five kinds of place, and one behaviour each, expressed as two numbers:

| zone | travel | dwell | what it reads as |
|---|---:|---:|---|
| platform | 9 m | 0.52 | arrive, wait most of a cycle, step to the edge, gone |
| crossing | 17 m | 0 | cross the frame and keep going |
| service | 3.4 m | 0.62 | stay with the machine you are working on |
| entrance | 7.5 m | 0.18 | arrive, turn in, orderly |
| maintenance | 2.6 m | 0.78 | one person, barely moving, a long way from anyone |

One cycle is an arrival, a wait and a departure, and `dwell` is how much of it
is the wait. That single number is every behaviour in the layer; there is no
state machine anywhere. Standing still is not stillness — a waiting figure
shifts its weight, which is one sine and the difference between a person and a
bollard.

---

## Density is the characterisation

The brief asks that density communicate hierarchy, and the first measured run
failed it outright: the figure budget was per level, so the substrate — a
sealed hall four hundred and sixty-five metres down — carried exactly as many
people as a street under a transit station, spread over twenty-six maintenance
posts. That is not a city. It is a uniform scattering with a hierarchy painted
on the documentation.

Three things fix it, and all three are measured rather than picked:

- **A level scalar.** A street under a station is the most used place in the
  city; a substrate service run is the least.
- **A cap per place.** Without one the budget divides by however many zones
  happen to exist, which put thirty people on a single pedestrian crossing and
  twenty-four around one machine — a protest and a shift change, rather than a
  street and a plant floor. It is also the bound: a level can never hold more
  than the sum of its zones' caps, whatever a tier asks for.
- **A limit per kind.** The substrate offered twenty-six maintenance posts,
  because it is a server hall and every rack is something somebody looks
  after. The nearest few to the camera survive; the rest are places nobody
  happens to be tonight.

Nothing in the world states any of this in words.

---

## Three things that were wrong, and how they were found

None of these were visible in a diff. All three were found by rendering the
frame and looking at it.

### Every pedestrian was behind the camera

`cameraBearing` is where the camera *stands*, as a bearing from the middle of
the world. The camera looks back *across* the middle rather than out of it, so
the direction it faces is half a turn from that — and the generator has said
so in one line since the fixtures were written.

The first version used the bearing directly. Both pedestrian crossings — the
single most valuable human presence in the layer, a figure between the reader
and a lit street — were placed a hundred and eighty degrees off, directly
behind the lens. It typechecked, it was deterministic, it produced a sensible
count, and it was invisible.

### Twenty-nine people standing on nothing

The interface camera is on a maintenance deck thirteen metres across, ninety-six
metres up, with a hundred and fifty-five metres of air under everything past
its front edge. It was given the same pair of crossings the surface gets, at
twenty-six and fifty-two metres ahead: a line of commuters walking on open sky
across the middle of the skyline.

That level has no street. It has a station, so it gets the people a station
has, and nothing else.

### The plant floor had twelve operators and none of them were in shot

Service zones are derived from the plant they belong to, and every machine
block in this world stands in a buildable band starting sixty-six metres out.
So the engine level's operators were all between seventy-seven and a hundred
and eighteen metres away — dark shapes against a dark mid-ground, and the
rendered frame contained no visible person at all. The level read exactly as
unstaffed as it had before the layer existed.

A worker among the foreground hardware fixes it and is truer anyway: the
cabinets, gantry and cable runs a few metres from the camera are precisely the
things somebody has to come and open.

---

## What colour a person is at night

Mostly the colour of whatever is lighting them, at a quarter of its brightness
and still carrying most of the dark they started with. A figure is read almost
entirely as a shape against a background, so the one thing it must not be is a
flat grey cut-out belonging to no part of the scene.

The first render took the lamp at 0.38 and nothing else, which under the
street's sodium produced solid orange figures — lit objects rather than people
catching a light, closer to a row of bollards than to a crowd. A person under
a sodium lamp is a dark shape with a warm edge.

The lamp test is also three-dimensional here, which the weather module's is
not, and the difference is not pedantry. Rain falls down a column to the
floor, so it asks which lamps are low enough to light the column — a flat
question with a height filter on it. A person is at a point, and the
interface's people are on decks thirty-five and sixty-two metres above the
floor. Measured with the weather rule, not one figure on that entire level was
lit by anything: the platform edge lighting they were standing directly under
was filtered out for being too far above a floor nobody was standing on.

---

## Accessibility and reduced motion

A figure carries no name, no id, no route and nothing addressable. That is not
an attribute someone could forget to set — the type has no field for it, which
is asserted.

Reduced motion removes them rather than freezing them, behind the same `motion`
gate as the traffic, the steam and the rain. That is the right answer and not
merely the convenient one: a frozen crowd is a set of mannequins standing in a
street, which reads worse than an empty one. Nothing is lost by their absence,
because no content has ever lived in the environment.

The existing `the environment holds still` end-to-end test already guards this
— it compares two canvas frames a second apart and requires them byte
identical, so a figure that animated under reduced motion would fail it.

On a phone the question does not arise. A phone is LOW, LOW never starts a
WebGL context, and no part of understanding this site has ever depended on the
city being drawn at all.
