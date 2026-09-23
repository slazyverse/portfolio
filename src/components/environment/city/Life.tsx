"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CITY_GEOMETRY, TRANSIT } from "@/lib/environment/generate";
import type { City } from "@/lib/environment/types";
import type { Palette } from "./palette";

/* ---------------------------------------------------------------------------
 * The things that make the city feel occupied.
 *
 * The last review named the empty street as the largest single weakness, and
 * the brief is explicit that the answer is not thousands of animated agents.
 * It is movement and grounding: traffic that is always going somewhere, steam
 * coming off the street, and shadows that attach buildings to the ground they
 * stand on.
 *
 * Everything here is GPU-animated from a single time uniform. Nothing is
 * simulated, nothing is uploaded per frame, and the whole file costs three
 * draw calls.
 * ------------------------------------------------------------------------- */

/* --------------------------------------------------------------- traffic --- */

const TRAFFIC_VERTEX = /* glsl */ `
  uniform float uTime;
  attribute float aRadius;
  attribute float aSpeed;
  attribute float aPhase;
  attribute float aHeight;
  attribute vec3 aTint;
  attribute vec2 aCorner;
  varying vec3 vTint;
  varying float vFade;

  void main() {
    // A vehicle is an angle and a radius. One uniform changes per frame, and
    // no position is ever uploaded.
    float angle = aPhase + uTime * aSpeed;
    vec3 centre = vec3(cos(angle) * aRadius, aHeight, sin(angle) * aRadius);

    // Elongate the streak along the direction of travel, in view space, so it
    // reads as motion from any camera angle.
    vec3 forward = vec3(-sin(angle), 0.0, cos(angle));
    vec4 mv = modelViewMatrix * vec4(centre, 1.0);
    vec3 alongView = normalize((modelViewMatrix * vec4(forward, 0.0)).xyz);

    mv.xyz += alongView * aCorner.x;
    mv.y += aCorner.y;

    // Distant traffic dissolves into the haze instead of staying pin-sharp,
    // which is what stops a ring of lights reading as a ring of lights.
    // Dimmer overall and falling off faster: these are points of light in a
    // dark street, and additive blending is unforgiving of generosity.
    vFade = (1.0 - clamp(-mv.z / 300.0, 0.0, 0.95)) * 0.55;
    vTint = aTint;
    gl_Position = projectionMatrix * mv;
  }
`;

const TRAFFIC_FRAGMENT = /* glsl */ `
  varying vec3 vTint;
  varying float vFade;
  void main() {
    gl_FragColor = vec4(vTint, vFade);
  }
`;

/**
 * Traffic, as moving light.
 *
 * Every vehicle is two triangles whose position is a function of time, so the
 * whole system is one draw call and one uniform write per frame. Nothing is
 * simulated because nothing needs to be — at this distance a vehicle *is* a
 * moving light.
 *
 * Lanes run both ways at several radii and heights: traffic on the street,
 * transit in the air above it. Amber runs one way and cold the other, which
 * keeps the palette semantics intact — the warm lights are where people are,
 * the cold ones are the machine moving itself.
 */
export function Traffic({
  count,
  floor,
  palette,
  paused,
}: {
  count: number;
  floor: number;
  palette: Palette;
  paused: React.RefObject<boolean>;
}) {
  const material = useRef<THREE.ShaderMaterial>(null);

  const { geometry, uniforms } = useMemo(() => {
    const position = new Float32Array(count * 4 * 3);
    const corner = new Float32Array(count * 4 * 2);
    const radius = new Float32Array(count * 4);
    const speed = new Float32Array(count * 4);
    const phase = new Float32Array(count * 4);
    const height = new Float32Array(count * 4);
    const tint = new Float32Array(count * 4 * 3);
    const index: number[] = [];

    const amber = new THREE.Color(palette.amber);
    const cold = new THREE.Color(palette.cold);

    for (let i = 0; i < count; i += 1) {
      // Deterministic lanes, derived from the index — the traffic is as
      // reproducible as the city it moves through.
      // Five lanes: four at street level, one elevated. The first pass ran
      // three elevated lanes with streaks up to eleven metres long, and
      // additive blending turned them into glowing planks hanging in the air
      // — a vehicle is a small bright thing, not a bar.
      const lane = i % 5;
      const street = lane < 4;
      /*
       * The elevated lane runs on the guideway, not near it.
       *
       * Previously this was a radius and a height picked to look about right,
       * and the result was the weakness the review named: a line of lights in
       * the air with no structure under it. Both numbers now come from
       * `TRANSIT`, which is also what the generator builds the deck, the
       * columns and the station from — so the vehicles are on the track by
       * construction rather than by coincidence.
       */
      const r = street
        ? CITY_GEOMETRY.VOID_RADIUS + 18 + lane * 21 + ((i * 0.618) % 1) * 12
        : TRANSIT.radius + (((i * 0.618) % 1) - 0.5) * (TRANSIT.deck * 0.5);
      const y = floor + (street ? 1.4 + lane * 0.7 : TRANSIT.height + 2.4);
      const direction = lane % 2 === 0 ? 1 : -1;
      const sp = direction * (0.03 + ((i * 0.3247) % 1) * 0.045) * (street ? 1 : 0.6);
      const ph = (i * 2.399963) % (Math.PI * 2);
      const length = street ? 1.1 + ((i * 0.754) % 1) * 1.4 : 1.8 + ((i * 0.569) % 1) * 2;
      const thickness = street ? 0.3 : 0.42;
      const colour = direction > 0 ? amber : cold;

      const corners: readonly (readonly [number, number])[] = [
        [-length, -thickness],
        [length, -thickness],
        [length, thickness],
        [-length, thickness],
      ];

      for (let v = 0; v < 4; v += 1) {
        const k = i * 4 + v;
        corner[k * 2] = corners[v]![0];
        corner[k * 2 + 1] = corners[v]![1];
        radius[k] = r;
        speed[k] = sp;
        phase[k] = ph;
        height[k] = y;
        tint[k * 3] = colour.r;
        tint[k * 3 + 1] = colour.g;
        tint[k * 3 + 2] = colour.b;
      }

      const base = i * 4;
      index.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(position, 3));
    g.setAttribute("aCorner", new THREE.BufferAttribute(corner, 2));
    g.setAttribute("aRadius", new THREE.BufferAttribute(radius, 1));
    g.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    g.setAttribute("aHeight", new THREE.BufferAttribute(height, 1));
    g.setAttribute("aTint", new THREE.BufferAttribute(tint, 3));
    g.setIndex(index);
    g.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, floor + 40, 0),
      CITY_GEOMETRY.SPAN,
    );

    return { geometry: g, uniforms: { uTime: { value: 0 } } };
  }, [count, floor, palette.amber, palette.cold]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, delta) => {
    if (paused.current || !material.current) return;
    material.current.uniforms.uTime!.value += Math.min(delta, 0.05);
  });

  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={TRAFFIC_VERTEX}
        fragmentShader={TRAFFIC_FRAGMENT}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/* ----------------------------------------------------------------- steam --- */

const STEAM_VERTEX = /* glsl */ `
  uniform float uTime;
  attribute vec2 aCorner;
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aScale;
  varying float vFade;

  void main() {
    float t = fract(uTime * aSpeed + aPhase);
    vec3 centre = position;
    centre.y += t * 26.0;

    vec4 mv = modelViewMatrix * vec4(centre, 1.0);
    // Camera-facing, growing as it rises and thins.
    float size = aScale * (0.4 + t * 1.8);
    mv.xy += aCorner * size;

    // In at the vent, out before the top: steam that pops is worse than none.
    vFade = smoothstep(0.0, 0.18, t) * (1.0 - smoothstep(0.45, 1.0, t));
    gl_Position = projectionMatrix * mv;
  }
`;

const STEAM_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  varying float vFade;
  void main() {
    gl_FragColor = vec4(uColor, vFade * 0.11);
  }
`;

/**
 * Steam off the street.
 *
 * Vents, drains and whatever runs under the road. Placed at the frontages of
 * real buildings rather than scattered, so the steam comes out of something,
 * and animated entirely in the vertex shader for one draw call.
 *
 * It is the cheapest "something is happening here" the city has: movement in
 * the foreground, at human scale, where the camera is already looking.
 */
export function Steam({
  city,
  floor,
  palette,
  paused,
}: {
  city: City;
  floor: number;
  palette: Palette;
  paused: React.RefObject<boolean>;
}) {
  const material = useRef<THREE.ShaderMaterial>(null);

  const { geometry, uniforms, count } = useMemo(() => {
    // Vent locations: the street furniture the generator already placed.
    const vents: [number, number][] = [];
    for (const level of city.levels) {
      for (const s of level.structures) {
        if (s.district === "corporate") continue;
        for (const p of s.parts) {
          if (p.kind !== "prop" || p.size[1] > 1) continue;
          vents.push([p.position[0], p.position[2]]);
        }
      }
    }
    const chosen = vents.slice(0, 90);

    const position = new Float32Array(chosen.length * 4 * 3);
    const corner = new Float32Array(chosen.length * 4 * 2);
    const phase = new Float32Array(chosen.length * 4);
    const speed = new Float32Array(chosen.length * 4);
    const scale = new Float32Array(chosen.length * 4);
    const index: number[] = [];

    chosen.forEach(([x, z], i) => {
      const ph = (i * 0.7548776662) % 1;
      const sp = 0.05 + ((i * 0.3247) % 1) * 0.045;
      const sc = 4 + ((i * 0.618) % 1) * 5;
      const corners: readonly (readonly [number, number])[] = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ];
      for (let v = 0; v < 4; v += 1) {
        const k = i * 4 + v;
        position[k * 3] = x;
        position[k * 3 + 1] = floor + 0.5;
        position[k * 3 + 2] = z;
        corner[k * 2] = corners[v]![0];
        corner[k * 2 + 1] = corners[v]![1];
        phase[k] = ph;
        speed[k] = sp;
        scale[k] = sc;
      }
      const base = i * 4;
      index.push(base, base + 1, base + 2, base, base + 2, base + 3);
    });

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(position, 3));
    g.setAttribute("aCorner", new THREE.BufferAttribute(corner, 2));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    g.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
    g.setAttribute("aScale", new THREE.BufferAttribute(scale, 1));
    g.setIndex(index);
    g.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, floor + 20, 0),
      CITY_GEOMETRY.SPAN,
    );

    return {
      geometry: g,
      count: chosen.length,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(palette.fog) } },
    };
  }, [city, floor, palette.fog]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, delta) => {
    if (paused.current || !material.current) return;
    material.current.uniforms.uTime!.value += Math.min(delta, 0.05);
  });

  if (count === 0) return null;

  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={STEAM_VERTEX}
        fragmentShader={STEAM_FRAGMENT}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/* -------------------------------------------------------- contact shade --- */

/**
 * Contact shadows, approximated.
 *
 * A soft dark quad on the ground under every building. Not a shadow map —
 * that would be another full render of the scene per light, which this
 * environment has refused on principle — but it buys most of what a shadow map
 * is *for*: it attaches a mass to the surface it stands on. Without it,
 * buildings appear to hover, which the previous review named as weak form.
 *
 * Multiply blending, because a shadow is an absence of light rather than a
 * coat of grey paint, and a radial falloff because a hard-edged rectangle
 * reads as a rug.
 */
export function ContactShade({ city }: { city: City }) {
  const matrices = useMemo(() => {
    const out: THREE.Matrix4[] = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const tilt = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      -Math.PI / 2,
    );
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();

    for (const band of city.levels) {
      for (const s of band.structures) {
        const [x, y, z] = s.position;
        const [w, , d] = s.size;
        pos.set(x, y + 0.15, z);
        scale.set(w * 2.3, d * 2.3, 1);
        q.setFromAxisAngle(up, s.rotation).multiply(tilt);
        out.push(m.clone().compose(pos, q, scale));
      }

      /*
       * And under everything elevated.
       *
       * A viaduct thirty metres up, a skybridge, a cantilever over the
       * pavement: each of them puts a region of the ground into shade, and
       * that region is one of the few places in a flat-lit night city where
       * there is real tonal contrast to be had. Spread wider and therefore
       * softer the higher the thing is, which is what a shadow from a diffuse
       * sky actually does.
       */
      const elevated = [
        ...band.fixtures,
        ...band.structures.flatMap((s) => [...s.parts]),
      ];
      for (const p of elevated) {
        if (p.kind !== "bridge" && p.kind !== "platform") continue;
        const height = p.position[1] - band.floor;
        if (height < 8) continue;
        /*
         * Only things that *span*.
         *
         * A shadow on the ground comes from something crossing over it — a
         * viaduct, a skybridge, a cantilever, a station platform — not from
         * every band and balcony on a facade, and emphatically not from a
         * ceiling. The substrate's sixteen ceiling plates were each casting a
         * sixty-eight-metre multiply-blended quad onto the floor directly
         * under the camera: wrong, because a roof does not cast a local
         * shadow on the room it covers, and expensive, because that is some
         * seventy thousand square metres of overdraw on the one level the
         * `/record` route looks at. Long and narrow casts; broad does not.
         */
        const span = Math.max(p.size[0], p.size[2]);
        const across = Math.min(p.size[0], p.size[2]);
        if (span < 8 || across > 20) continue;
        const spread = 1.4 + Math.min(height / 26, 2.2);
        pos.set(p.position[0], band.floor + 0.14, p.position[2]);
        scale.set(p.size[0] * spread, Math.max(p.size[2], 4) * spread, 1);
        q.setFromAxisAngle(up, p.rotation).multiply(tilt);
        out.push(m.clone().compose(pos, q, scale));
      }
    }
    return out;
  }, [city]);

  const map = useMemo(() => {
    const size = 64;
    const element = document.createElement("canvas");
    element.width = size;
    element.height = size;
    const ctx = element.getContext("2d");
    if (!ctx) return null;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "#32373f");
    g.addColorStop(0.5, "#8b9198");
    g.addColorStop(1, "#ffffff");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(element);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);

  useEffect(() => () => map?.dispose(), [map]);

  const fill = (mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  };

  if (matrices.length === 0 || !map) return null;

  return (
    <instancedMesh
      ref={fill}
      args={[undefined, undefined, matrices.length]}
      frustumCulled={false}
      renderOrder={-1}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={map}
        transparent
        // three requires premultiplied alpha for multiply blending and warns
        // on every frame without it. A shadow multiplies what is underneath;
        // that is the whole reason this is not additive.
        premultipliedAlpha
        depthWrite={false}
        blending={THREE.MultiplyBlending}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </instancedMesh>
  );
}
