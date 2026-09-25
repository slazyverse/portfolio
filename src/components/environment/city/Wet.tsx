"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { City, Part } from "@/lib/environment/types";
import { lightSourceColour, type Palette } from "./palette";

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


    /** One pool of light under a sign, if it is low enough and bright enough. */
    const pool = (p: Part, floor: number): boolean => {
      if (p.kind !== "sign" || p.emissive < 0.55) return false;
      const height = p.position[1] - floor;
      if (height > 34) return false;
      const reach = 1 - height / 34;
      // Fifteen metres, not twenty-six, and stretched less along the road.
      // A pool sized generously is a pool that overlaps its neighbours, and
      // additive blending turns overlap into a flare: at street height the
      // right-hand third of the surface shot was a single sheet of white.
      const spread = Math.min(Math.max(p.size[0], p.size[2]) * (2 + reach * 1.6), 15);
      pos.set(p.position[0], floor + 0.18, p.position[2]);
      scale.set(spread, spread * (1.1 + reach * 0.6), 1);
      q.setFromAxisAngle(up, p.rotation).multiply(tilt);
      matrices.push(m.clone().compose(pos, q, scale));
      colours.push(
        // 0.022, down from 0.06. With the camera at street height the near
        // pavement fills the bottom of the frame, and pools that read as a
        // wet sheen from nine metres up read as a flare from six.
        /*
         * The pool is the colour of the thing casting it.
         *
         * Every pool on the street used to be `--accent` or `--cold`, so the
         * largest warm areas in any frame were the subject's own colour lying
         * on the road. A sodium lamp pools orange and a shopfront pools warm
         * white, and that is where most of the street's colour now comes
         * from — from the lamps, rather than from a filter over the scene.
         */
        new THREE.Color(
          lightSourceColour(p.source ?? (p.signal === "cold" ? "machine" : "interior"), palette),
        ).multiplyScalar(p.emissive * reach * 0.022),
      );
      return true;
    };

    for (const level of city.levels) {
      /*
       * The authored fixtures light the street too — the station soffit, the
       * signal heads on the gantry, the pedestrian lamps. Thinned by a stride
       * rather than capped per object, because they do not belong to a
       * building and there is nothing to count them against.
       */
      let seen = 0;
      for (const p of level.fixtures) {
        if (p.kind !== "sign" || p.emissive < 0.55) continue;
        seen += 1;
        if (seen % 2 === 0) continue;
        pool(p, level.floor);
      }

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
          if (pool(p, level.floor)) pools += 1;
        }
      }
    }
    return { matrices, colours };
  }, [city, palette]);

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
