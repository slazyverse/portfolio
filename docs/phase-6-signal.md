# Phase 6 — Signal

The city was finished and the landing page did not know it existed. Phase 6 is
the introduction: an authored camera move that establishes the world, hands the
frame to the subject, and gets out of the way.

Nothing about the environment was rebuilt. The generator, the renderer, the
quality tiers and the fallback chain are exactly as Phase 5 left them; what is
new is a shot, a state machine, and a hero composed against both.

---

## The one rule

**The portfolio is the product.** Every decision below was taken against a
single test: does the page still work with the cinematic removed? It does —
with JavaScript off, with WebGL unavailable, with reduced motion on, on a
phone, and for a crawler. The opening changes *when* the subject appears, never
whether.

That is not a caveat bolted on at the end. It is why the hero is server-rendered
markup rather than something the camera reveals, why nothing scroll-locks, and
why `ready` — the finished page — is both the default state and the server
snapshot.

---

## The five states

| | What it is | What drives it |
|---|---|---|
| **signal** | A dark field and one line of real telemetry | The environment has not started drawing |
| **wake** | Ankle height, 34° lens: wet asphalt, a barrier, rain | The camera's first move |
| **reveal** | Street, viaduct, depth, landmark | Three more moves |
| **subject** | Sagar becomes the subject; the heading arrives | The camera begins its settle |
| **ready** | The portfolio behaves normally | The camera reached rest |

Nothing here is on a timer that pretends to be progress. The phase advances
because the camera reported reaching a move, or because the renderer said it
cannot start. The readout says `initialising`, `environment synchronised`,
`resolving structure`, `signal established`, `interface ready` — each
corresponding to something that genuinely happened. No percentage, no byte
count, no invented frame rate.

---

## The shot

Six moves, 5.25 seconds, composed against the geometry the generator actually
built: the camera rests at (14, 6.5, 0) looking down −X, the transit deck
crosses at 34 m on a ring of radius 118, and the Vantage tower stands at
(−136, 0) and is 290 m tall.

```
wake      0 ms   ankle height, 34° — a place, before any architecture
street    1050   standing up: the signal column, the kerb, the frontage
transit   2100   tilt to the viaduct — the city is used, not just built
scale     3150   widen to 56°: the verticals converge, depth arrives
landmark  4200   up the one building that is not on the grid
subject   4650   the settle begins, and the heading arrives with it
          5250   the resting transform, exactly
```

Three properties make this testable rather than watchable:

**It is data.** Keyframes in a plain array, sampled by a pure function, with no
rendering library in the file. The sampler is a function of elapsed time, so a
dropped frame changes how smooth the move looks and never where it ends up.

**It lands exactly on the resting transform.** The last keyframe *is*
`cameraTargetForLevel("surface")`, spread in. If it were even slightly off, the
cinematic would end on a jump — the one thing a five-second reveal cannot
afford at its final frame. A test asserts the identity.

**A keyframe names the move that begins at it.** That is why there are two
`subject` keyframes: without the first, the camera would still report
`landmark` while easing into rest, and the heading would arrive on the same
frame the camera stopped — two events where there should be one.

---

## Who gets one

```
reduced motion      none      not "the same thing, faster"
no WebGL / LOW      none      no city is being drawn, so there is nothing to move
internal return     none      they never left the world
seen this session   short     three moves, 2.5 s
BALANCED tier       short     renders the city with less headroom
otherwise           full
```

`internal` is a module counter, not the Navigation Timing API — an App Router
route change creates no navigation entry, so every return looks like a fresh
arrival to `performance`. A full page load resets a module; a client-side
route change does not. That is exactly the distinction needed.

---

## Four things that were wrong

**The hero appeared during the first move.** The landing resolved the opening
the moment it mounted, while `mode` was still `none` — and `none` means both
"not yet" and "never". It concluded there was no cinematic, revealed the
subject, and *then* started a camera move behind a page that had already
introduced itself. `useEnvironment` now reports whether it has finished
deciding, and the landing waits for that.

**The shot finished before it was drawn.** The clock started when React decided
to play it; the renderer's first frame arrives after the city's textures are
generated and its geometry merged. On a slow machine the whole opening had
elapsed before a single frame of it existed, so the visitor got the last
keyframe and nothing else. The clock starts on the first frame now.

**The same arrival was counted four times.** The decision effect re-runs as the
device facts settle — tier, then WebGL, then the idle gate — and the arrival
counter was being incremented inside it. The second count reported "you came
back through the site" and cancelled the opening about a second and a half in.
A lazy `useState` initialiser runs once per mount, which is the granularity the
question actually has.

**The initial bundle went over its ceiling.** Importing `entryLength` from the
keyframe module pulled in the camera module, which pulls in the generator,
which is the entire city: 190.2 KB became 201.0 KB against a 200 KB budget held
since Phase 1. The policy — five booleans and a string — now lives in its own
module with no imports at all. The budget was not raised.

---

## What the landing page gave back

Removing the old hero and letting the descent scene yield the GPU took more out
of the initial bundle than the opening put in:

| | Before Phase 6 | After |
|---|---:|---:|
| Initial JS (gz) | 190.2 KB | **190.1 KB** |
| Lazy environment (gz) | 240.8 KB | 241.5 KB |
| CSS (gz) | 10.5 KB | 10.8 KB |
| Dependencies | 6 | **6** |

The descent scene further down the landing page now falls back to its stacked
HTML, which it has had since Phase 1 — because two live WebGL contexts on one
document is precisely what made `/system` unable to finish a frame in Phase 5.
One context per page, and on this page the city is the one that matters.

---

## Accessibility

- **Reduced motion** gets no camera at all and the finished page immediately.
  The inline head script reads the motion contract before first paint, so the
  hero is never hidden from anyone who asked for less movement.
- **The telemetry readout is `aria-hidden`.** It describes a camera. A screen
  reader hearing "resolving structure" would be told about decoration while the
  heading it needs sits directly below.
- **Nothing is focus-trapped, scroll-locked or gated.** Every destination is a
  real link in the served HTML from the first frame.
- **The safety net**: if the bundle never executes, the attribute that holds
  the hero back expires on its own after seven seconds and the page is simply
  the page.

---

## The signature frame

Name, positioning, five destinations in both registers, the GitHub link, and
the evidence note — all above the fold at 720 px, with the city behind and the
chrome around it.

The five destinations are selected on the page and described by the route
table. `nav: true` marks eight routes, and eight rows in a signature frame is a
menu rather than a way in; Colophon and Verify stay one keystroke away in the
palette, in the footer, and on the level rail.

The legibility scrim lifts during the three moves that reveal the world and
returns on the move that introduces the subject. It exists to hold text over a
moving city, and during the opening there is no text over it — at its resting
strength it was dimming the one shot the phase is built around. The resting
values, which the contrast suite asserts, are untouched.
