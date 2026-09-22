"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { City, Part } from "@/lib/environment/types";
import { FACADE_TILE, FACADE_VARIANTS, type CityTextures } from "./textures";
import type { Palette } from "./palette";

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
 * Merges building masses into one geometry with world-scaled UVs.
 *
 * Runs once per variant at mount and never again — the city does not change
 * shape, so this is build cost, not frame cost.
 */
function buildMassGeometry(masses: readonly Part[]): THREE.BufferGeometry {
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const srcPos = unit.attributes.position!.array as Float32Array;
  const srcNor = unit.attributes.normal!.array as Float32Array;
  const srcUv = unit.attributes.uv!.array as Float32Array;
  const srcIdx = Array.from(unit.index!.array);
  const vertCount = srcPos.length / 3;

  const positions = new Float32Array(masses.length * srcPos.length);
  const normals = new Float32Array(masses.length * srcNor.length);
  const uvs = new Float32Array(masses.length * srcUv.length);
  const indices: number[] = [];

  const matrix = new THREE.Matrix4();
  const normalMatrix = new THREE.Matrix3();
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const axis = new THREE.Vector3(0, 1, 0);
  const scale = new THREE.Vector3();
  const translate = new THREE.Vector3();

  masses.forEach((mass, m) => {
    const [w, h, d] = mass.size;
    translate.set(mass.position[0], mass.position[1], mass.position[2]);
    scale.set(w, h, d);
    quat.setFromAxisAngle(axis, mass.rotation);
    matrix.compose(translate, quat, scale);
    normalMatrix.getNormalMatrix(matrix);

    const span = { w, h, d };

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
      uvs[uo] = srcUv[i * 2]! * (span[face[0]] / FACADE_TILE.width);
      uvs[uo + 1] = srcUv[i * 2 + 1]! * (span[face[1]] / FACADE_TILE.height);
    }

    for (const index of srcIdx) indices.push(index + m * vertCount);
  });

  unit.dispose();

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
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
    const byVariant: Part[][] = Array.from({ length: FACADE_VARIANTS }, () => []);
    for (const level of city.levels) {
      for (const structure of level.structures) {
        for (const p of structure.parts) {
          if (p.kind !== "mass") continue;
          byVariant[p.variant % FACADE_VARIANTS]!.push(p);
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
  emissive: boolean;
}

function kitSpecs(): KitSpec[] {
  return [
    {
      kind: "fin",
      geometry: new THREE.BoxGeometry(1, 1, 1),
      roughness: 0.68,
      metalness: 0.45,
      tint: (p) => p.structure,
      emissive: false,
    },
    {
      kind: "roofUnit",
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
      geometry: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
      roughness: 0.7,
      metalness: 0.6,
      tint: (p) => p.metal,
      emissive: false,
    },
    {
      kind: "mast",
      geometry: new THREE.BoxGeometry(1, 1, 1),
      roughness: 0.6,
      metalness: 0.8,
      tint: (p) => p.metal,
      emissive: true,
    },
    {
      kind: "pipe",
      geometry: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
      roughness: 0.85,
      metalness: 0.5,
      tint: (p) => p.metal,
      emissive: false,
    },
    {
      kind: "sign",
      geometry: new THREE.BoxGeometry(1, 1, 1),
      roughness: 0.4,
      metalness: 0.1,
      tint: (p) => p.structure,
      emissive: true,
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
}: {
  city: City;
  palette: Palette;
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
        <KitMesh key={spec.kind} spec={spec} parts={parts} palette={palette} />
      ))}
    </>
  );
}

function KitMesh({
  spec,
  parts,
  palette,
}: {
  spec: KitSpec;
  parts: Part[];
  palette: Palette;
}) {
  // A callback ref: the instance data is written once, when the mesh appears.
  // There is nothing to hold onto afterwards, because the city does not move.
  const setup = (mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;

    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const axis = new THREE.Vector3(0, 1, 0);
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const colour = new THREE.Color();

    const base = new THREE.Color(spec.tint(palette));
    const amber = new THREE.Color(palette.amber);
    const cold = new THREE.Color(palette.cold);

    parts.forEach((p, i) => {
      position.set(p.position[0], p.position[1], p.position[2]);
      scale.set(p.size[0], p.size[1], p.size[2]);
      quat.setFromAxisAngle(axis, p.rotation);
      mesh.setMatrixAt(i, matrix.compose(position, quat, scale));

      if (spec.emissive && p.emissive > 0) {
        colour.copy(p.signal === "amber" ? amber : cold).multiplyScalar(
          0.55 + p.emissive * 0.9,
        );
      } else {
        // Wear desaturates and darkens. A city where every surface is the
        // same shade of grey is a city nobody has ever used.
        colour.copy(base).multiplyScalar(0.7 + (1 - p.wear) * 0.55);
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
        <meshStandardMaterial roughness={spec.roughness} metalness={spec.metalness} />
      )}
    </instancedMesh>
  );
}
