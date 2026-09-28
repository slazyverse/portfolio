# Phase 10 — World fidelity

Not another layer. A focused pass on the things that still said *generated*.

Three of them, and the first two were defects named at the end of Phase 9.

---

## Landmarks own their ground

Phase 9 put authored landmarks into a generator that had never been told they
existed. The placement grid rejected cells inside the shaft and inside the
camera's own room, and knew nothing about the nine anchors — so a procedural
tower could be, and was, generated straight through one.

The fix is a radius check against a handful of known points:

```
LANDMARK_CLEARANCE = 22
```

Sized against the landmarks rather than picked — the widest is the contract hub
at sixteen metres, a structure cell carries a footprint reaching about
fourteen, and twenty-two clears both with margin for a jittered neighbour. It
is deterministic, consumes no randomness, and costs nine comparisons per
candidate cell. A collision system would be a great deal more code for a
problem with nine instances of it.

A test asserts the separation at every tier, and a second asserts the city is
still as full as its budget asks — a clearance that quietly emptied the skyline
would be a worse bug than the one it fixed.

---

## A corporation is an institution, not a colour

Five corporations that differ only in the shape of a logo and one of two signal
colours are five colour-coded markers. What makes an institution recognisable
in a real city is duller and more specific: the temperature of the light in its
lobbies, whether its mark sits on a dimmer or a hazard circuit, whether its
frontage is maintained.

Each now runs its own fixture from the Phase 8 vocabulary, and no two are the
same:

```
Allocation Holdings      machine   steady    clinical, always on. The landlord.
Meridian Interchange     interior  breathe   warm frontage on a dimmer
Corrigan Power & Cooling warning   blink     its plant is hazard-lit because its plant is a hazard
Vantage Substrate Group  utility   steady    data. Green service indicators, nothing moves
Keelson Residential      sodium    steady    older stock, still on the sodium it was built with
```

`corporateMark` lights its members from the owner's fixture rather than from
the signal family. A test asserts the five fixtures are distinct and that none
of them claims `subject` — the colour that marks the route the reader is on,
which a corporation wearing it would be indistinguishable from.

---

## Every mass is a box

The most-cited remaining weakness, and the one with the least obvious cheap
fix. Buildings already stack with setbacks, tapered crowns, braces,
cantilevers and retrofits — so the silhouette was not a single box. What was
left was the **arris**: every volume in the city presented a bare 90° corner,
and a skyline of those reads as generated however well it is lit.

Two treatments, both made of kit kinds the city already instances:

**Chamfer.** Four thin plates set at 45° across each vertical corner. Still
boxes, and the outline gains eight edges instead of four — and the corner
catches the key light at an angle neither face does, which is what actually
sells it. Lower tiers only: a chamfer on top of a stack is four instances
nobody can resolve against the sky, and the corner that matters is the one at
eye level.

**Recess.** One full-height slot down a single face — a service riser, a stair
core, the gap between two structural bays. A facade with no depth reads as a
printed surface, and one shadow running the whole height fixes it. One, not
two: two would be a pattern.

Applied to near and hero buildings, never to `far`, and a test asserts that.

---

## What it cost

Measured with `scripts/city-metrics.mjs`, peak per frame at 1280×800:

| | draw calls | triangles |
|---|---:|---:|
| surface HIGH | 27 → **27** | 89,400 → 92,888 (+3.9%) |
| surface BALANCED | 27 → **27** | 38,568 → 44,612 (+15.7%) |
| interface HIGH | 27 → **27** | 89,440 → 92,908 |
| engine HIGH | 26 → **26** | 89,408 → 92,904 |
| substrate HIGH | 23 → **23** | 89,116 → 92,616 |

**No new draw calls.** Chamfers are `fin` parts and recesses are `pipe` parts,
both of which already had an `InstancedMesh` — the whole trade depends on that,
and a test pins the kit vocabulary so a future treatment cannot quietly add a
mesh. Frame rate unchanged within the noise of a software rasteriser.

Bundles untouched: initial JS **190.4 KB** / 200, environment **243.1 KB** /
300, CSS 11.0 KB, **six dependencies**.

BALANCED takes the larger proportional hit because it has fewer base triangles,
not because it does more work; the treatments are distance-gated identically.

---

## What this phase did not do

Stated plainly, because the brief asked for more than one pass can honestly
deliver and the gap matters more than the list of what was done:

- **Secondary anchor readability** is unchanged. They are still small at
  distance.
- **Street and ground quality** is unchanged — no service covers, road seams,
  patched sections or drainage. The foreground road remains the weakest
  surface in the frame.
- **Material authenticity** gained the recess wear response and nothing else;
  roughness and albedo variation are Phase 8's.
- **Weather and surface interaction**, shadow/occlusion, and hero-landmark
  silhouette work are all untouched.

Those are the next fidelity pass, not this one.

---

## Tests

### The accessibility suite, and why it changed

The full gate failed twice on this branch and neither failure was a violation.
Both were axe runs exceeding their ninety-second timeout: the run took 21.4
minutes against 11.6 for the previous phase, and Playwright's own artefact
reads `Test timeout of 90000ms exceeded` rather than naming a rule.

That is worth being careful about, because the easy response — raise the
budget — hides the next real failure behind it. Run alone on a quiet machine
all four axe tests passed, the worst at **72 seconds of its 90**; re-running
the two specs together reproduced the failure. So it was contention, not a
flake, and the margin had been thin for some time rather than newly broken.

What was competing was the city. The environment is decorative — `aria-hidden`,
no focusable children, no text — so it contributes nothing an audit can see,
while rasterising in software on the same cores axe walks the DOM with. The
three long-page audits now run against a device with no WebGL, which is a
configuration the site explicitly supports and the fallback chain guarantees is
complete. The assertion is unchanged; only the irrelevant competitor is gone.
Coverage of a page *with* the environment stays in `environment.spec.ts`.

Measured: the two specs went from `2 failed` in 11.5 minutes to **0 failed in
5.1**.

`tests/environment-fidelity.test.ts` — 9 assertions: no structure within the
clearance of a landmark at any tier; the city still fills its budget; the five
corporate fixtures are distinct; no corporation claims the subject's colour;
the treatments use only kit kinds that already have meshes; `far` buildings get
none of them; and the same seed builds the same city, chamfers included.
