"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { CITY_GEOMETRY } from "@/lib/environment/generate";
import type { City, LightSource, Part, Structure } from "@/lib/environment/types";
import type { DistrictId } from "@/data/city-identity";
import { FACADE_TILE, FACADE_VARIANTS, type CityTextures } from "./textures";
import { lightSourceColour, type Palette } from "./palette";

/**
 * What a lit part is, when it has not said.
 *
 * The signal still carries the meaning — warm is people, cold is the machine
 * — and this turns that meaning into the ordinary fixture that would be
 * there. Practical warm light for occupied frontage; a machine indicator for
 * everything the city runs itself with.
 */
function defaultSource(signal: Part["signal"]): LightSource {
  return signal === "amber" ? "interior" : "machine";
}

/* ---------------------------------------------------------------------------
 * The city's architecture, in two techniques.
 *
 * MASSES ARE MERGED, not instanced. Every building volume of a given facade
 * variant becomes one `BufferGeometry` with its UVs baked at world scale — so
 * a 27-metre-wide podium and a 9-metre crown show the same size of window,
 * and the texture never stretches.
 *
 * That is the whole reason for merging rather than instancing here. An
 * instanced box shares one set of UVs between every copy, so either every
 * building shows exactly one tile of facade (windows the size of the building)
 * or they all show the same count regardless of size. Fixing that with
 * instancing means a per-instance attribute and a shader injection into
 * three's UV chunks — which works until three reorganises those chunks, and
 * then fails silently. Merged geometry costs about sixteen thousand vertices
 * for the entire city, which is nothing, and it is correct by construction.
 *
 * KIT PIECES ARE INSTANCED. Fins, roof plant, tanks, masts, pipes and signs
 * are small, repeated and untextured, so they have nothing to gain from having
 * their own UVs and everything to gain from sharing a draw call.
 *
 * Together: four merged facade meshes plus six instanced kit meshes, for a
 * city of any size.
 * ------------------------------------------------------------------------- */

/** Per-face UV spans of a unit box, in the order BoxGeometry emits them. */
const FACE_SPAN: readonly (readonly ["w" | "h" | "d", "w" | "h" | "d"])[] = [
  ["d", "h"], // +X
  ["d", "h"], // -X
  ["w", "d"], // +Y
  ["w", "d"], // -Y
  ["w", "h"], // +Z
  ["w", "h"], // -Z
];

/**
 * A mass, plus what the renderer needs to know about where it stands.
 *
 * Shading a building correctly needs three facts the part itself does not
 * carry: which floor it rises from, how crowded its patch of city is, and
 * which district it belongs to. All three are known at the point the
 * structures are walked, so they are collected there rather than looked up
 * again here.
 */
interface Placed {
  part: Part;
  floor: number;
  /** 0..1 — how enclosed this footprint is by its neighbours. */
  occlusion: number;
  district: DistrictId;
}

/**
 * How much light a district's fabric returns.
 *
 * The economic hierarchy, stated as reflectance. A corporate tower is washed,
 * glazed and maintained; an undercity structure is none of those. This is a
 * multiplier on albedo rather than a change of hue, because what separates
 * the two in life is how clean they are, not what colour they were painted.
 */
const DISTRICT_ALBEDO: Record<DistrictId, number> = {
  corporate: 1.16,
  commercial: 1,
  residential: 0.9,
  industrial: 0.84,
  undercity: 0.76,
};

/**
 * Merges building masses into one geometry with world-scaled UVs.
 *
 * Runs once per variant at mount and never again — the city does not change
 * shape, so this is build cost, not frame cost.
 */
function buildMassGeometry(placed: readonly Placed[]): THREE.BufferGeometry {
  const masses = placed.map((p) => p.part);
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const srcPos = unit.attributes.position!.array as Float32Array;
  const srcNor = unit.attributes.normal!.array as Float32Array;
  const srcUv = unit.attributes.uv!.array as Float32Array;
  const srcIdx = Array.from(unit.index!.array);
  const vertCount = srcPos.length / 3;

  const positions = new Float32Array(masses.length * srcPos.length);
  const normals = new Float32Array(masses.length * srcNor.length);
  const uvs = new Float32Array(masses.length * srcUv.length);
  const colors = new Float32Array(masses.length * srcPos.length);
  const indices: number[] = [];
  const tint = new THREE.Color();

  const matrix = new THREE.Matrix4();
  const normalMatrix = new THREE.Matrix3();
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const axis = new THREE.Vector3(0, 1, 0);
  const scale = new THREE.Vector3();
  const translate = new THREE.Vector3();

  masses.forEach((mass, m) => {
    const context = placed[m]!;
    const [w, h, d] = mass.size;
    translate.set(mass.position[0], mass.position[1], mass.position[2]);
    scale.set(w, h, d);
    quat.setFromAxisAngle(axis, mass.rotation);
    matrix.compose(translate, quat, scale);
    normalMatrix.getNormalMatrix(matrix);

    const span = { w, h, d };

    /*
     * Per-building tint, baked into the vertices.
     *
     * Four facade textures across a whole city is visible repetition, and the
     * cheapest cure is not a fifth texture — it is to stop every copy being
     * the same colour. Wear desaturates and darkens; a small deterministic
     * hue shift does the rest. One float3 per vertex, no extra draw call, and
     * the identical-facade tell largely disappears.
     */
    const grime = 1 - mass.wear * 0.42;
    const drift = ((Math.sin(mass.position[0] * 0.37 + mass.position[2] * 0.21) + 1) / 2) * 0.16;
    const albedo = DISTRICT_ALBEDO[context.district];
    tint.setRGB(
      grime * (0.9 + drift * 0.6) * albedo,
      grime * (0.93 + drift * 0.3) * albedo,
      grime * (1.0 + drift * 0.1) * albedo,
    );

    /*
     * A deterministic offset into the facade tile, per mass.
     *
     * Four textures across a whole city is visible repetition, and the fix
     * that costs nothing is not a fifth texture — it is to stop every copy
     * starting at the same pixel. Sliding the tile by an arbitrary fraction
     * and mirroring half of them turns four maps into effectively unlimited
     * variations of four maps, because what the eye catches is not the
     * texture, it is the *alignment*: two neighbouring towers whose service
     * floors line up exactly.
     *
     * Derived from position so it is as reproducible as everything else.
     */
    const hash = Math.abs(
      Math.sin(mass.position[0] * 12.9898 + mass.position[1] * 4.1414 + mass.position[2] * 78.233) *
        43758.5453,
    );
    const uOffset = hash % 1;
    const vOffset = (hash * 0.618) % 1;
    const mirror = hash % 2 < 1 ? 1 : -1;

    for (let i = 0; i < vertCount; i += 1) {
      const o = m * srcPos.length + i * 3;
      v.set(srcPos[i * 3]!, srcPos[i * 3 + 1]!, srcPos[i * 3 + 2]!).applyMatrix4(matrix);
      positions[o] = v.x;
      positions[o + 1] = v.y;
      positions[o + 2] = v.z;

      n.set(srcNor[i * 3]!, srcNor[i * 3 + 1]!, srcNor[i * 3 + 2]!)
        .applyMatrix3(normalMatrix)
        .normalize();
      normals[o] = n.x;
      normals[o + 1] = n.y;
      normals[o + 2] = n.z;

      // Four vertices per face, in face order — so the face index is simply
      // the vertex index over four, and each face gets the UV scale that
      // matches the two world dimensions it actually spans.
      const face = FACE_SPAN[Math.floor(i / 4)]!;
      const uo = m * srcUv.length + i * 2;
      uvs[uo] = srcUv[i * 2]! * (span[face[0]] / FACADE_TILE.width) * mirror + uOffset;
      uvs[uo + 1] = srcUv[i * 2 + 1]! * (span[face[1]] / FACADE_TILE.height) + vOffset;

      /*
       * Baked ambient occlusion, per vertex.
       *
       * The review named weak shadow hierarchy as a real failure, and the
       * honest answer to it is not a shadow map — that is another full render
       * of the scene, which this environment has refused throughout — but the
       * fact a shadow map would have produced: in a dense city, the bottom of
       * a canyon receives almost no sky.
       *
       * So the shade is a function of two things that are both known here:
       * how far up the facade a vertex is, and how enclosed the footprint is
       * by its neighbours. A tower standing in the open is barely touched; a
       * street-level wall in the densest part of a district loses half its
       * light. That gradient is what separates the bright tops from the dark
       * bases, and it is doing the compositional work shadows were missing.
       *
       * Downward-facing vertices — the underside of a podium overhang or a
       * cantilever — go darker still, which is the local version of the same
       * idea and is where "under-bridge darkness" comes from.
       */
      const above = Math.max(0, v.y - context.floor);
      const canyon = Math.max(0, 1 - above / 62);
      const under = n.y < -0.5 ? 0.62 : 1;
      const shade = (1 - context.occlusion * 0.55 * canyon) * under;

      colors[o] = tint.r * shade;
      colors[o + 1] = tint.g * shade;
      colors[o + 2] = tint.b * shade;
    }

    for (const index of srcIdx) indices.push(index + m * vertCount);
  });

  unit.dispose();

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * How enclosed each patch of a level is, on a coarse grid.
 *
 * Built once per level from the structures that stand on it, weighted by
 * height — a forty-storey neighbour occludes far more sky than a machine
 * block does. Sampled with bilinear-ish smoothing so neighbouring buildings
 * do not step between shade values at a cell boundary.
 *
 * 24-metre cells: fine enough that a dense block and the open street beside
 * it get different answers, coarse enough that the whole grid is a few
 * hundred floats.
 */
const OCCLUSION_CELL = 24;

function occlusionField(structures: readonly Structure[]): (x: number, z: number) => number {
  const span = CITY_GEOMETRY.SPAN * 1.2;
  const cells = Math.ceil(span / OCCLUSION_CELL);
  const half = span / 2;
  const grid = new Float32Array(cells * cells);

  const index = (i: number, j: number) => j * cells + i;
  const cellOf = (v: number) => Math.floor((v + half) / OCCLUSION_CELL);

  for (const s of structures) {
    const i = cellOf(s.position[0]);
    const j = cellOf(s.position[2]);
    if (i < 0 || j < 0 || i >= cells || j >= cells) continue;
    // Weight by height, and spread into the eight neighbours: a tall
    // building shades the street in front of it, not only its own footprint.
    const weight = Math.min(1, s.size[1] / 90);
    for (let di = -1; di <= 1; di += 1) {
      for (let dj = -1; dj <= 1; dj += 1) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= cells || nj >= cells) continue;
        const k = index(ni, nj);
        grid[k] = grid[k]! + weight * (di === 0 && dj === 0 ? 1 : 0.45);
      }
    }
  }

  return (x, z) => {
    const i = cellOf(x);
    const j = cellOf(z);
    if (i < 0 || j < 0 || i >= cells || j >= cells) return 0;
    // Saturating: past about three tall neighbours it is as dark as it gets.
    return Math.min(1, grid[index(i, j)]! / 3.2);
  };
}

/** Every building volume, grouped by which facade it wears. */
export function Masses({
  city,
  textures,
}: {
  city: City;
  textures: CityTextures;
}) {
  const geometries = useMemo(() => {
    const byVariant: Placed[][] = Array.from({ length: FACADE_VARIANTS }, () => []);
    for (const level of city.levels) {
      const occlusion = occlusionField(level.structures);
      for (const structure of level.structures) {
        const occ = occlusion(structure.position[0], structure.position[2]);
        for (const p of structure.parts) {
          if (p.kind !== "mass") continue;
          byVariant[p.variant % FACADE_VARIANTS]!.push({
            part: p,
            floor: level.floor,
            occlusion: occ,
            district: structure.district,
          });
        }
      }
    }
    return byVariant.map((parts) => (parts.length ? buildMassGeometry(parts) : null));
  }, [city]);

  useEffect(
    () => () => {
      for (const g of geometries) g?.dispose();
    },
    [geometries],
  );

  return (
    <>
      {geometries.map((geometry, i) =>
        geometry ? (
          <mesh key={i} geometry={geometry} frustumCulled>
            <meshStandardMaterial
              map={textures.facades[i]}
              emissiveMap={textures.facadeEmissives[i]}
              emissive={new THREE.Color(0xffffff)}
              // Windows are the brightest thing in the city and they are a
              // texture, so this multiplier is the master control for how lit
              // the skyline reads. Restraint here is the palette holding.
              emissiveIntensity={1.15}
              // White. The map is the albedo; tinting it by a near-black
              // interface token was what made these render as silhouettes.
              color={0xffffff}
              vertexColors
              roughnessMap={textures.grime}
              roughness={0.82}
              metalness={0.12}
            />
          </mesh>
        ) : null,
      )}
    </>
  );
}

/* ----------------------------------------------------------- kit pieces --- */

interface KitSpec {
  kind: Part["kind"];
  geometry: THREE.BufferGeometry;
  roughness: number;
  metalness: number;
  /** Base colour; signs and masts override per instance. */
  tint: (palette: Palette) => string;
  /**
   * How much of that colour this kind actually returns.
   *
   * Painted street furniture is not the same material as a galvanised roof
   * unit, and before this existed they were: every kit piece took the metal
   * token at full value, so a row of bollards and a maintenance deck came out
   * as the brightest surfaces in a night city and read as polystyrene. Value
   * is what separates "dark painted steel" from "bare aluminium" when both
   * are the same hue.
   */
  value: number;
  emissive: boolean;
}

function kitSpecs(): KitSpec[] {
  return [
    {
      kind: "fin",
      value: 0.78,
      geometry: new THREE.BoxGeometry(1, 1, 1),
      roughness: 0.68,
      metalness: 0.45,
      tint: (p) => p.structure,
      emissive: false,
    },
    {
      kind: "roofUnit",
      value: 0.7,
      geometry: new THREE.BoxGeometry(1, 1, 1),
      roughness: 0.75,
      metalness: 0.55,
      tint: (p) => p.metal,
      emissive: false,
    },
    {
      // Eight sides is plenty: a rooftop tank is a silhouette long before it
      // is a cylinder, and the extra segments would be paid for on every one.
      kind: "tank",
      value: 0.74,
      geometry: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
      roughness: 0.7,
      metalness: 0.6,
      tint: (p) => p.metal,
      emissive: false,
    },
    {
      kind: "mast",
      value: 0.8,
      geometry: new THREE.BoxGeometry(1, 1, 1),
      roughness: 0.6,
      metalness: 0.8,
      tint: (p) => p.metal,
      emissive: false,
    },
    {
      kind: "pipe",
      value: 0.66,
      geometry: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
      roughness: 0.85,
      metalness: 0.5,
      tint: (p) => p.metal,
      emissive: false,
    },
    {
      kind: "sign",
      value: 1,
      geometry: new THREE.BoxGeometry(1, 1, 1),
      roughness: 0.4,
      metalness: 0.1,
      tint: (p) => p.structure,
      emissive: true,
    },
    {
      // Floor bands, setback shelves and balconies. Painted steel: smoother
      // and more specular than concrete, so a relief band catches a highlight
      // where the wall beside it does not. That contrast is the whole reason
      // these exist.
      kind: "platform",
      // 0.47. At 0.6 a balcony caught so much more light than the unlit
      // facade behind it that the residential blocks read as rows of pale
      // slabs hanging in the dark rather than as things attached to
      // buildings. The contrast is the point; twice the contrast is not.
      value: 0.47,
      geometry: new THREE.BoxGeometry(1, 1, 1),
      roughness: 0.48,
      metalness: 0.62,
      tint: (p) => p.metal,
      emissive: false,
    },
    {
      // Skybridges. Structural, weathered, and read as silhouette against the
      // haze more often than as surface.
      kind: "bridge",
      value: 0.58,
      geometry: new THREE.BoxGeometry(1, 1, 1),
      roughness: 0.66,
      metalness: 0.55,
      tint: (p) => p.metal,
      emissive: false,
    },
    {
      /*
       * The one ring in the kit, and the reason it exists: a corporation
       * whose mark is a closed loop. Sixteen segments on the tube and six
       * around it — at the distance a sign is read, a ring is a circle and
       * not a torus, and every extra segment is paid for on every instance.
       */
      kind: "ring",
      value: 1,
      geometry: new THREE.TorusGeometry(0.42, 0.09, 6, 16),
      roughness: 0.4,
      metalness: 0.1,
      tint: (p) => p.structure,
      emissive: true,
    },
    {
      // Street furniture. Painted plastic and galvanised box, the scale
      // reference that makes a 200-metre tower read as 200 metres.
      kind: "prop",
      value: 0.38,
      geometry: new THREE.BoxGeometry(1, 1, 1),
      roughness: 0.82,
      metalness: 0.2,
      tint: (p) => p.metal,
      emissive: false,
    },
  ];
}

/**
 * Every fin, roof unit, tank, mast, pipe and sign in the city.
 *
 * One instanced mesh per kind, across all four levels. A building with thirty
 * kit pieces costs thirty instance matrices and no draw call of its own.
 */
export function KitPieces({
  city,
  palette,
  textures,
}: {
  city: City;
  palette: Palette;
  textures: CityTextures;
}) {
  const groups = useMemo(() => {
    const specs = kitSpecs();
    const byKind = new Map<Part["kind"], Part[]>();
    for (const spec of specs) byKind.set(spec.kind, []);
    for (const level of city.levels) {
      for (const structure of level.structures) {
        for (const p of structure.parts) {
          byKind.get(p.kind)?.push(p);
        }
      }
      // The authored set pieces — foreground street, transit spine, the
      // enclosure overhead — are the same kind of data as a building's kit
      // and share the same meshes, so none of them costs a draw call.
      for (const p of level.fixtures) {
        byKind.get(p.kind)?.push(p);
      }
    }
    return specs
      .map((spec) => ({ spec, parts: byKind.get(spec.kind) ?? [] }))
      .filter((g) => g.parts.length > 0);
  }, [city]);

  useEffect(
    () => () => {
      for (const g of groups) g.spec.geometry.dispose();
    },
    [groups],
  );

  return (
    <>
      {groups.map(({ spec, parts }) => (
        <KitMesh
          key={spec.kind}
          spec={spec}
          parts={parts}
          palette={palette}
          grime={textures.grime}
        />
      ))}
    </>
  );
}

function KitMesh({
  spec,
  parts,
  palette,
  grime,
}: {
  spec: KitSpec;
  parts: Part[];
  palette: Palette;
  grime: THREE.Texture;
}) {
  // A callback ref: the instance data is written once, when the mesh appears.
  // There is nothing to hold onto afterwards, because the city does not move.
  const setup = (mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;

    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const pitch = new THREE.Quaternion();
    const axis = new THREE.Vector3(0, 1, 0);
    const lateral = new THREE.Vector3(1, 0, 0);
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const colour = new THREE.Color();

    const base = new THREE.Color(spec.tint(palette));

    parts.forEach((p, i) => {
      position.set(p.position[0], p.position[1], p.position[2]);
      scale.set(p.size[0], p.size[1], p.size[2]);
      // Yaw, then pitch about the part's own lateral axis. The second half
      // of that is what a diagonal brace, a canted module, a leaning mast, a
      // sloped awning and a chevron all have in common.
      quat.setFromAxisAngle(axis, p.rotation);
      if (p.tilt !== 0) {
        quat.multiply(pitch.setFromAxisAngle(lateral, p.tilt));
      }
      mesh.setMatrixAt(i, matrix.compose(position, quat, scale));

      if (spec.emissive && p.emissive > 0) {
        /*
         * A lit part is a lamp, and a lamp's colour is its own.
         *
         * This read `p.signal === "amber" ? --accent : --cold`, which made
         * every street lamp, shopfront and awning the same colour as the
         * subject. The signal still decides the *family* — warm means people
         * are here — but the fixture decides the hue, and a part that knows
         * what it is says so.
         */
        colour
          .set(lightSourceColour(p.source ?? defaultSource(p.signal), palette))
          .multiplyScalar(0.55 + p.emissive * 0.9);
      } else {
        // Wear desaturates and darkens, and the kind decides how much light
        // the material returns at all. A city where every surface is the same
        // shade of grey is a city nobody has ever used.
        colour.copy(base).multiplyScalar(spec.value * (0.62 + (1 - p.wear) * 0.5));
      }
      mesh.setColorAt(i, colour);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  };

  return (
    <instancedMesh
      ref={setup}
      args={[spec.geometry, undefined, parts.length]}
      frustumCulled
    >
      {spec.emissive ? (
        // Signs and obstruction lights are their own light source, so they are
        // unlit by the scene and never shadowed by it. `toneMapped` off keeps
        // them at the exact token value.
        <meshBasicMaterial toneMapped={false} />
      ) : (
        /*
         * The grime map, reused as a roughness map.
         *
         * Materials read as materials when their roughness is uneven, and
         * the previous pass gave every instance of a kind exactly one
         * roughness value — so painted steel, a galvanised cabinet and a
         * concrete pier all returned light identically and the eye could not
         * tell them apart by anything except colour. This texture is already
         * in memory for the facades; applied here it scratches and weathers
         * every kit surface for nothing.
         */
        <meshStandardMaterial
          roughness={spec.roughness}
          metalness={spec.metalness}
          roughnessMap={grime}
        />
      )}
    </instancedMesh>
  );
}
