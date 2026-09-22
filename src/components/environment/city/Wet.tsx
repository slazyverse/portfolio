"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { City } from "@/lib/environment/types";
import type { Palette } from "./palette";

/* ---------------------------------------------------------------------------
 * Wet streets, without a reflection pass.
 *
 * Phase 5 bought a real planar reflection from drei. It looked correct and it
 * cost two things this environment could not afford: a second full render of
 * the scene every frame, and — once Phase 5B added districts, skybridges,
 * street furniture and traffic — the last few kilobytes of the deferred
 * budget. At 306 KB against a 300 KB ceiling something had to go, and the
 * rule this project has followed every time is optimise before raising.
 *
 * So the reflection is gone and this is what replaced it: the light that
 * *causes* a reflection, painted onto the road directly.
 *
 * On a real wet street the thing you actually read is not a mirrored building.
 * It is colour bleeding downward from every lit sign and window — long
 * vertical smears of amber and cold on black asphalt. That is a pool of light
 * under a source, and a pool of light under a source is one additive quad.
 *
 * The result: one draw call instead of a render pass, no drei dependency in
 * the environment at all, and a street that reads wetter than the blurred
 * grey mirror did — because it is coloured by the city standing in it.
 * ------------------------------------------------------------------------- */

/**
 * Light pooling on the road beneath every bright sign.
 *
 * Only signs low enough for their light to reach the ground, and only the
 * bright ones — a maintenance plate does not light a street. Size scales with
 * the source and falls off with its height, which is what stops the pools
 * reading as decals.
 */
export function WetSheen({
  city,
  palette,
}: {
  city: City;
  palette: Palette;
}) {
  const { matrices, colours } = useMemo(() => {
    const matrices: THREE.Matrix4[] = [];
    const colours: THREE.Color[] = [];

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const tilt = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      -Math.PI / 2,
    );
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const amber = new THREE.Color(palette.amber);
    const cold = new THREE.Color(palette.cold);

    for (const level of city.levels) {
      for (const s of level.structures) {
        /*
         * At most two pools per building.
         *
         * A commercial frontage carries a storefront band plus several shop
         * signs, and every one of them wanted its own pool — additively, in
         * the same square metre of road. The result was a single blown-out
         * flare bright enough to lose the street in it. One building lights
         * the pavement in front of it once; it does not light it six times.
         */
        let pools = 0;
        for (const p of s.parts) {
          if (pools >= 2) break;
          if (p.kind !== "sign" || p.emissive < 0.55) continue;

          // How far above the road it is. Light from forty storeys up does
          // not pool on the pavement.
          const height = p.position[1] - level.floor;
          if (height > 34) continue;
          const reach = 1 - height / 34;

          // Bounded. Clustered signage on one frontage stacked additively
          // into a single blown-out flare on the road; a pool of light has a
          // size, and that size does not grow without limit.
          const spread = Math.min(
            Math.max(p.size[0], p.size[2]) * (2 + reach * 2.4),
            26,
          );
          pos.set(p.position[0], level.floor + 0.18, p.position[2]);
          scale.set(spread, spread * (1.4 + reach), 1);
          q.setFromAxisAngle(up, p.rotation).multiply(tilt);
          matrices.push(m.clone().compose(pos, q, scale));

          colours.push(
            (p.signal === "cold" ? cold : amber)
              .clone()
              .multiplyScalar(p.emissive * reach * 0.06),
          );
          pools += 1;
        }
      }
    }

    return { matrices, colours };
  }, [city, palette.amber, palette.cold]);

  // A soft radial falloff. A hard-edged rectangle of light on a road reads as
  // a sticker; the gradient is what makes it read as a wet surface catching it.
  const map = useMemo(() => {
    const size = 64;
    const element = document.createElement("canvas");
    element.width = size;
    element.height = size;
    const ctx = element.getContext("2d");
    if (!ctx) return null;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.35, "#6b6b6b");
    g.addColorStop(1, "#000000");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(element);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);

  useEffect(() => () => map?.dispose(), [map]);

  const fill = (mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    matrices.forEach((matrix, i) => {
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, colours[i]!);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  };

  if (matrices.length === 0 || !map) return null;

  return (
    <instancedMesh
      ref={fill}
      args={[undefined, undefined, matrices.length]}
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={map}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </instancedMesh>
  );
}
