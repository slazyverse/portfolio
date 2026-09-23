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

## The shot, and the city behind it

Every level is composed as three layers, and the generator spends in that
order:

| Layer | Distance | What is there |
|---|---|---|
| **Foreground** | 6-20 m | Barriers, cabinets, cables, a drain, parked vehicles, a framing column running out of frame, a gantry crossing overhead |
| **Midground** | 20-160 m | Buildings with the full kit, the transit viaduct and its station, skybridges, street-level signage |
| **Background** | 225-480 m | Impostor silhouettes in haze, five of the sixty-four a megastructure two to three times the size of anything in the playable footprint |

The foreground is the layer that was missing, and its absence was the single
largest compositional failure of the previous pass. The cause was structural:
the camera kept a **circular** clearance of sixty-six metres, so the nearest
object in any direction was two-thirds of the way across the shaft. There was
nothing to occlude the frame and nothing at human scale to measure the towers
against, and a city with no foreground reads as a model on a table however
large its numbers are.

A street does the opposite of a circle. It is open along its length and closed
across it, so the clearance is now **a cone**: wide and deep down the line of
sight, shallow at the flanks. Buildings crowd to within about thirty metres at
the edges of the frame while the view down the shaft stays open.

## Interiors

Two of the four levels are inside something, and they have a ceiling.

- **02 ENGINE** - spanned rather than roofed: crane rails, walkways and duct
  runs at forty-four metres, above a camera that stands at twenty-one.
- **03 SUBSTRATE** - a hall. Ceiling plates on a coarse grid with a gap over
  the shaft, square piers with capitals, duct runs, and strip lighting that is
  dim because a service ceiling is lit enough to work under and no more.

The substrate read as a distant industrial skyline until it had something over
it. The fix was one move - a ceiling - and the reason it works is that the
piers state the span of the room, and the span of the room is what makes it a
megastructure rather than a basement.

Neither interior has a horizon. A distant skyline inside a room would be a
hole in the wall, so the substrate has none at all and the engine's sits close
enough to read through its own fog. That relationship — impostor ring inside
the fog range the level is lit with — is asserted by a test, because for two
phases it was not true and nothing said so: the rings stood at 520 to 840
metres against a fog that reached 430, and the entire background layer
rendered as fog colour on fog.

The shaft **tapers with the level**, too. Holding the void at a constant
radius while the substrate's footprint narrowed left that level a buildable
band twenty-three metres wide, which is how a hall becomes a ring around an
empty floor.

## Transit

One viaduct and one station, not a network.

The guideway runs at a hundred and eighteen metres from the shaft - midground,
past the near buildings - at thirty-four metres above the street, on columns
every third bay with canted braces and a lit soffit. The station sits **dead
ahead on the camera's own sight line**: a platform longer and wider than the
deck, a canted canopy on its own columns, edge lighting on both faces, service
machinery, a vertical core down to the ground with the escalator run canted off
it, and Meridian Interchange's chevron on the end wall.

The elevated traffic lane takes its radius and height from the same constants
the generator builds the deck from, so the vehicles are **on** the track by
construction. Previously they were a line of lights in the air with nothing
underneath, which reads as a bug rather than as infrastructure.

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

Each mark is **drawn as geometry** - three stacked bars, a chevron of two
canted members, a ring, a lattice, a canted wedge - assembled from the emissive
parts the kit already instances plus one torus. Geometry rather than a texture
on purpose: a logo texture needs a per-instance UV region, which needs a shader
injection into three's UV chunks, which breaks silently the next time those
chunks are reorganised. Four tilted boxes are five instances, no new material,
no new memory, and a silhouette survives at a distance where a 32-pixel logo
does not.

Each corporation also has an **architectural signature**, which is the more
convincing of the two because it is in the structure rather than stuck to it:

| | Mark | Signature |
|---|---|---|
| **Allocation Holdings** | bars | Deep horizontal banding every few floors |
| **Meridian Interchange** | chevron | Canted bracing, as on its own viaducts |
| **Corrigan Power & Cooling** | ring | Rooftop plant under a lit ring |
| **Vantage Substrate Group** | grid | An exoskeleton: verticals on all four flanks, tied horizontally |
| **Keelson Residential Trust** | wedge | Balconies all the way up, canted canopy over the entrance |

## Grammars

The district also picks a **grammar** - a small table of architectural rules
about how that class of building is put together. This is the difference
between variation and randomness: a district reads as a district because its
buildings are visibly related to each other and visibly unlike the ones one
ring out.

| Grammar | Setback | Accretion | Crown |
|---|---|---|---|
| **Corporate megastructure** | Deep, concentric | Almost none | Tapered |
| **Commercial block** | Shallow, continuous frontage | Awnings, modules over the pavement | Plant |
| **Residential density block** | Barely any - every square metre is floor area | Heavy; whatever will not fit inside is hung outside | Plant |
| **Industrial / service block** | Low and heavy | Externally braced | Lattice |
| **Patched structure** | None to speak of | One original volume and three generations of addition | None |

What the grammars add is **angle and accretion**. Every mass in this city is a
box, and a city of axis-aligned boxes reads as generated however good its
textures are - what it is missing is not detail but angle. One extra number per
part (`tilt`) buys diagonal braces, canted service modules, leaning masts,
sloped awnings, chevron marks and cantilever struts, and costs nothing at
render time because a quaternion was already being composed per instance.

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
foundation reads as a place that was built around something. It is owned by
Vantage Substrate Group and wears that company's exoskeleton over its lower
half: verticals on all four flanks, tied horizontally. The ties stop at the
midpoint deliberately — they are sized to the footprint at the base, and
carried to full height they hang clear of a facade that has stepped back away
from them.

The second landmark is not a building. It is the **transit station**, which
stands dead ahead on the camera's sight line on the two levels that have one,
and is the only place in the city where a piece of infrastructure states its
operator at the point of use.

Phase 6 composes the landing camera on the tower.

---

## Light as hierarchy

Lighting carries the economic structure, and it does it in three ways that cost
nothing:

- **Occupancy.** A corporate tower burns light all night at 0.88; a residential
  stack at 0.42; a plant floor at 0.34. The gap is the hierarchy, stated in the
  one currency a night city has.
- **Reflectance.** District fabric returns different amounts of light -
  corporate 1.16, undercity 0.76 - as a multiplier on albedo rather than a
  change of hue, because what separates the two in life is how clean they are.
- **Baked occlusion.** Shade is a function of how far up a facade a vertex sits
  and how enclosed its footprint is by its neighbours. A tower in the open is
  barely touched; a street-level wall in the densest part of a district loses
  half its light, and downward-facing surfaces lose more. That gradient is what
  separates the bright tops from the dark bases, and it is doing the work a
  shadow map would have done - without a second render of the scene.

Contact shade extends under everything elevated as well: a viaduct thirty
metres up, a skybridge, a cantilever over the pavement. Each spreads wider and
softer the higher it is, which is what a shadow from a diffuse sky does.

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
- **Street furniture, in clusters** - not scatter. Scattering props evenly along
  a frontage produces decoration; grouping them answers the question the world
  is actually being asked: *who uses this place, and what do they do here?*
  Five clusters, chosen by district: a **loading** apron with a skip and a
  barrier run, a **utility** group of cabinets and bollards with a cable drop,
  a lit **vendor** kiosk with a crate stack, a **repair** pit ringed by
  barriers under a warning lamp, and **parked vehicles** at the kerb. Plus
  pedestrian-scale lamp posts, which are what put pools of light on the
  pavement between the shopfronts. All of it at 1-2 m: the scale reference that
  makes a 268 m tower read as 268 m.

---

## What the world does not do

- **No text.** Not in signage, not on buildings, not anywhere.
- **No real brands**, and no corporation from any existing game.
- **No external assets.** See [asset-manifest.md](asset-manifest.md).
- **No gating.** Nothing in the portfolio is reachable only through the city.
  Every route works with the environment deleted.
