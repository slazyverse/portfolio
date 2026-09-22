# Asset manifest

Every asset in the SUBSTRATE environment, where it came from, and under what
licence.

The brief requires this record for any external resource. The record is short,
because there are no external resources.

---

## External assets

**None.**

Not "none yet" — none by design. No model packs, no texture libraries, no
HDRIs, no sprite sheets, no sound. Nothing in the environment was downloaded,
purchased or adapted from anything.

That is a deliberate position rather than a shortage of options, and it is worth
stating why, because the brief explicitly permits properly licensed commercial
assets:

1. **Nothing to get wrong.** A world with no third-party assets cannot contain a
   mis-attributed one, cannot inherit a licence that forbids commercial use, and
   cannot quietly include something derived from a game. On a site whose entire
   premise is that every claim is checkable, an environment assembled from
   sources I could not fully account for would undercut the thesis harder than
   any visual gain could repay.

2. **It is the cheaper answer.** Texture packs are the largest single payload in
   most 3D web work. Generating them costs bytes nobody downloads.

3. **It is reproducible.** A generated texture is a function of a seed. An asset
   is a file that someone has to keep.

---

## Generated at runtime

All of these are drawn into a `<canvas>` on the client, from the same seeded
generator that places the city, and uploaded as textures. **Zero network
bytes.**

| Asset | How it is made | Memory (HIGH) |
|---|---|---|
| Facade albedo × 4 | Canvas 2D: structural grid, service floors, glazing, grime, rain streaking | 4 × 1.4 MB |
| Facade emissive × 4 | Same pass, lit windows only, in register with the albedo | 4 × 1.4 MB |
| Grime / roughness | Layered blob noise plus vertical streaking | 1.4 MB |
| Road | Asphalt, lane markings, hazard hatching, wear, standing water | 1.4 MB |
| **Total** | | **≈ 13 MB** |

Sizes are per quality tier: 512 px at HIGH, 384 px at BALANCED, 256 px at LOW.
The figure is asserted in `tests/environment-detail.test.ts` — an earlier
version used 1024 px maps, which multiply out to 49 MB, and the test is there
because nobody had done that multiplication.

Facade textures **tile** up and across a building rather than stretching to fit,
so a forty-storey tower shows the tile about five times over. The effective
resolution is the tile's multiplied by the repeat, which is how a 512 px map
carries a 230-metre building.

---

## Generated geometry

Every object in the world is procedural. There is no imported mesh.

| Object | Primitive | Technique |
|---|---|---|
| Building masses | Box | Merged per facade variant, UVs baked at world scale |
| Fins, relief bands, balconies, roof plant, signage, skybridges, street furniture | Box | Instanced, one mesh per kind |
| Water tanks, pipework | Cylinder (8 and 6 sided) | Instanced |
| Conduits | Line segments | Merged into one geometry |
| Rain | Line segments | Animated entirely in a vertex shader |
| Skyline | Plane | Instanced impostors, tinted toward fog by depth |
| Traffic | Quads | Position computed from time in a vertex shader |
| Steam | Quads | Vertex shader, placed at generated vent positions |
| Street | Plane | Textured; light pooling painted by `WetSheen` |
| Contact shade | Plane | Instanced, multiply-blended radial falloff |

---

## Fonts

Inherited from the site, unchanged by this phase: **Archivo** and **JetBrains
Mono**, both SIL Open Font License 1.1, self-hosted at build time by
`next/font`. Neither is used inside the environment — the city contains no text
at all, which is both an accessibility requirement and the reason no font is
uploaded to the GPU.

---

## Shaders

Three, all written for this project, all of the same shape: the object's
position is a function of time, so the CPU writes one uniform per frame and
touches nothing else.

- **Rain** — falling streaks.
- **Traffic** — vehicles on circular lanes, elongated along travel in view space.
- **Steam** — rising, expanding, fading plumes.

Everything else uses three.js stock materials.

No post-processing stack: no bloom, no chromatic aberration, no screen-space
pipeline. **And, since Phase 5B, no planar reflection** — that was a second full
render of the scene for a blurred grey mirror, replaced by light pooling painted
directly onto the road for one instanced draw call.

**The environment has no dependency on drei at all.** Removing the reflector and
replacing drei's `PerspectiveCamera` with a plain three.js camera took the
deferred bundle back under its ceiling and left the environment depending on
three.js and React Three Fiber alone.

---

## Colour

Every colour in the world is read at runtime from the Phase 2 stylesheet. The
city has no palette of its own — if a token changes, the city changes with it.

Two sets, and the distinction matters:

- **Signals** — `--accent` (amber, the subject) and `--cold` (the machine).
  Semantic, and the city gets no exemption from them.
- **Materials** — `--env-material`, `--env-metal`, `--env-glass`. Physical
  reflectance values, not interface colours. Concrete returns about a third of
  the light that hits it; the interface tokens are near-black because they sit
  behind text. Using the latter for the former rendered the entire city as flat
  silhouettes under any lighting at all.

Both sets are bounded by the contrast suite, because both can end up as pixels
behind a paragraph.

---

## What this phase deliberately did not add

- No asset or model loading framework. The brief permits one with a concrete
  reason; there was none, since there are no assets to load.
- No post-processing library.
- No audio of any kind. Audio is a later phase and will be original or licensed,
  optional, and recorded here when it exists.
- No new runtime dependency at all. The environment is built from three.js and
  `@react-three/fiber`, both of which predate this phase — and Phase 5B removed
  its last use of `@react-three/drei`, so the environment now depends on fewer
  packages than when it started.
