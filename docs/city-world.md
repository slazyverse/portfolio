# The world of SUBSTRATE

Art direction for the procedural city. What it is meant to communicate, and how
the generator is arranged so that it does.

This is the companion to [phase-5-procedural-environment.md](phase-5-procedural-environment.md),
which covers the engineering. This one covers the place.

---

## The thesis

A city with a floor you can stand on and a floor you cannot see, and a very
clear account of who is on which.

Everything below exists to make that legible **without a word of copy inside the
scene**. There is no text in the environment at all — not one glyph — so every
statement the world makes has to be made in geometry, material and light.

---

## Districts

A district is a social fact before it is a visual one. Each carries a
maintenance standard, a commercial density and a lighting character, and every
visual difference between two buildings falls out of those.

| District | Fabric | Signage | Services | Reads as |
|---|---|---|---|---|
| **Corporate** | Kept: wear 0.05–0.30 | Skyline-scale, sparse | Concealed | Somebody pays for this |
| **Commercial** | Patched: 0.35–0.75 | Saturated, 92% of frontages | Half exposed | Public space, occupied by selling |
| **Residential** | Worn: 0.50–0.95 | Modest | Bolted on outside | People live here |
| **Industrial** | Dirty: 0.60–1.00 | Almost none | Entirely exposed | Process, not frontage |
| **Undercity** | 0.70–1.00 | Minimal | Exposed | Maintained when it fails |

**Which district a building stands in is decided by distance from the central
shaft, not by chance.** The expensive, controlled ground is nearest the core and
everything else is pushed outward — so a premium tower and a patched residential
stack end up in the same frame. That is the high-tech-over-low-life contrast
expressed as a placement rule rather than as a mood.

The level decides which two districts are in play:

```
00 SURFACE     corporate core, commercial edge
01 INTERFACE   corporate core, residential edge
02 ENGINE      industrial throughout
03 SUBSTRATE   undercity throughout
```

---

## Corporations

Five, all invented for SUBSTRATE. Not real companies, and not the corporations
of any published game. Their names are built from vocabulary the portfolio
already uses, so the world reads as an extension of it rather than as pastiche.

| | Mark | Signal | Owns |
|---|---|---|---|
| **Allocation Holdings** | bars | cold | Corporate towers |
| **Meridian Interchange** | chevron | amber | Transit, commercial |
| **Corrigan Power & Cooling** | ring | amber | Industrial plant |
| **Vantage Substrate Group** | grid | cold | Deep infrastructure — and the landmark |
| **Keelson Residential Trust** | wedge | amber | Residential stacks |

A corporation is a visual identity, not a story. `mark` is a **shape family**,
never a glyph: the city renders no text, which is both an accessibility rule and
the reason none of these can ever be mistaken for a real brand.

Ownership is assigned by district — infrastructure belongs to the power company,
stacks to the housing trust — which is what makes signage read as ownership
rather than as decoration. Only buildings over 34 m get an owner at all.

---

## Signage hierarchy

Four scales, each with a spatial reason to exist. Scattering neon at random is
the difference between a city that has been advertised at and a city that has
had lights put on it.

| Tier | Needs a host of | Where | Who |
|---|---:|---|---|
| **Skyline** | 90 m | Across the top of its own tower | Corporations only |
| **District** | 28 m | Frontage bands and corner blades | Anyone |
| **Local** | 10 m | Storefront strip at street level, plus shop signs above | Commercial |
| **Micro** | 4 m | Maintenance plates and hazard markings | Everywhere |

The storefront strip is the single strongest cue that a street has businesses on
it: a continuous lit band at eye level, present on 85% of commercial frontages
and 5% of industrial ones.

---

## The landmark

**The Vantage tower.** 268 m, 62 × 54 m in plan, standing 150 m down the surface
camera's line of sight.

It is authored rather than sampled: its position is derived from where the
camera is already looking, its proportions are fixed, and it is the only
building in the city that does not take its size from the grid. A landmark the
generator might or might not have produced is not a landmark.

It carries a skirt of seven lower masses around its base — a podium complex. A
tower standing alone on a plane reads as a model; one growing out of its own
foundation reads as a place that was built around something.

Phase 6 composes the landing camera on this.

---

## Colour

The Phase 2 semantics are not negotiable and the city gets no exemption:

- **Amber** — the subject. People, occupancy, the work.
- **Cold** — the machine. Infrastructure, telemetry, data.

Deliberately **not** a cyan-and-magenta palette. The generic cyberpunk colour
scheme would have been the easy read and it would have said nothing; two signals
that already mean something say more.

Materials are separate from signals and physical rather than semantic:
`--env-material` (concrete), `--env-metal`, `--env-glass`. Using interface
tokens as albedo rendered the whole city as silhouettes, which is recorded in
the phase document as one of the mistakes worth remembering.

---

## Making it feel occupied

The brief is explicit that the answer is not thousands of animated agents. It is
movement and grounding, and all of it is GPU-animated from a single time
uniform:

- **Traffic** — 340 vehicles at HIGH, four street lanes and one elevated, both
  directions. Two triangles each, one draw call, positions computed in the
  vertex shader. Amber runs one way and cold the other.
- **Steam** — rising from the vents the generator actually placed, so it comes
  out of something.
- **Rain** — 2200 GPU-animated streaks, surface and interface only.
- **Contact shade** — a soft dark quad under every building. Not a shadow map,
  but it buys what a shadow map is *for*: it attaches a mass to the ground.
- **Street furniture** — cabinets, bollards, railings, vents at 1–2 m. The scale
  reference that makes a 268 m tower read as 268 m.

---

## What the world does not do

- **No text.** Not in signage, not on buildings, not anywhere.
- **No real brands**, and no corporation from any existing game.
- **No external assets.** See [asset-manifest.md](asset-manifest.md).
- **No gating.** Nothing in the portfolio is reachable only through the city.
  Every route works with the environment deleted.
