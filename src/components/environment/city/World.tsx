"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { StratumId } from "@/data/types";
import { CITY_GEOMETRY } from "@/lib/environment/generate";
import type { City, LevelEnvironment, LightCell } from "@/lib/environment/types";
import type { CityTextures } from "./textures";
import { lightSourceColour, type Palette } from "./palette";

/* ---------------------------------------------------------------------------
 * Everything in the world that is not a building.
 *
 * Ground, horizon, weather and accent light. Each is written to the same rule:
 * spend where the camera is looking, and use the cheapest technique that
 * survives being looked at.
 * ------------------------------------------------------------------------- */

/* ---------------------------------------------------------------- ground --- */

/**
 * The street.
 *
 * A textured plane, and deliberately nothing cleverer. Phase 5 rendered a real
 * planar reflection here; Phase 5B removed it. Two reasons, and the second is
 * the one that matters:
 *
 *  - it was a second full render of the scene every frame, easily the most
 *    expensive thing in the environment;
 *  - what it produced was a blurred grey mirror, while the thing that actually
 *    reads as a wet street is coloured light bleeding down onto it.
 *
 * That light is now painted directly by `WetSheen` for one instanced draw
 * call. Cheaper, and it looks more like rain.
 */
function Street({
  level,
  textures,
}: {
  level: LevelEnvironment;
  textures: CityTextures;
}) {
  const size = CITY_GEOMETRY.SPAN * 3.2;

  /*
   * Lane markings belong on a street, and only one of these levels is one.
   *
   * The first pass painted the same road across all four, so the substrate —
   * a server hall two hundred metres underground — had highway markings
   * running through it. The engine floor kept them a phase longer, and a
   * dashed white centre line through a plant hall reads as a highway for the
   * same reason. A plant floor is a dark matte slab that has been worked on.
   */
  const paved = level.level === "surface";
  const repeat = size / (paved ? 46 : 18);

  const map = useMemo(() => {
    const t = (paved ? textures.road : textures.grime).clone();
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.needsUpdate = true;
    return t;
  }, [textures.road, textures.grime, paved, repeat]);

  useEffect(() => () => map.dispose(), [map]);

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, level.floor - 0.1, 0]}
      frustumCulled={false}
    >
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial
        map={map}
        // White: the road texture is the albedo. Multiplying it by a near-black
        // interface token made the street disappear, which is the same mistake
        // as tinting the facades with one.
        // The unpaved floors are a concrete slab, not a void: at #2a3038 the
        // engine and substrate floors were so dark that the grime texture on
        // them carried no information at all, and half of each frame was flat
        // black.
        color={paved ? "#ffffff" : "#3a434e"}
        /*
         * Wet asphalt is smoother and more metallic in its response than dry,
         * but not by as much as the first numbers claimed.
         *
         * At 0.34 roughness and 0.55 metalness the road was a near-mirror,
         * and a near-mirror under a low directional light produces one
         * enormous specular lobe — which is exactly what the right-hand third
         * of this shot was: not a bug in the light pooling, but the key
         * light's own reflection, blown to white across twenty percent of the
         * frame. Broadening the lobe spreads the same energy over more of the
         * road, which is what a real wet surface does and what makes it read
         * as wet rather than as chrome.
         */
        roughness={paved ? 0.52 : 0.9}
        metalness={paved ? 0.34 : 0.1}
      />
    </mesh>
  );
}

/* --------------------------------------------------------------- skyline --- */

/**
 * The horizon: flat impostors, no geometry.
 *
 * Every distant tower is two triangles on a billboard that always faces the
 * camera, tinted toward the fog by its depth. At four hundred metres through
 * haze that is indistinguishable from a modelled building, and it is three
 * orders of magnitude cheaper.
 *
 * The lit ones get a second, additive quad rather than a texture — sparse
 * light at that range reads as a smudge of glow, which is what a smudge of
 * glow is for.
 */
function Skyline({ level, palette }: { level: LevelEnvironment; palette: Palette }) {
  const { shapes, glow } = useMemo(() => {
    const shapeMatrices: THREE.Matrix4[] = [];
    const shapeColours: THREE.Color[] = [];
    const glowMatrices: THREE.Matrix4[] = [];
    const glowColours: THREE.Color[] = [];

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const fog = new THREE.Color(palette.fog);
    const base = new THREE.Color(palette.structure);
    const cold = new THREE.Color(palette.cold);

    for (const s of level.skyline) {
      const [x, y, z] = s.position;
      const [w, h] = s.size;
      // Face the centre of the shaft, which is where the camera always is.
      const facing = Math.atan2(x, z);
      pos.set(x, y + h / 2, z);
      scale.set(w, h, 1);
      q.setFromAxisAngle(up, facing);
      shapeMatrices.push(m.clone().compose(pos, q, scale));

      // Atmospheric perspective: the further back, the closer to pure fog.
      // This single lerp is most of what makes a horizon read as distance
      // rather than as a wall of cut-outs.
      shapeColours.push(base.clone().lerp(fog, 0.55 + s.depth * 0.4));

      if (s.lit > 0) {
        pos.set(x, y + h * 0.45, z);
        scale.set(w * 0.82, h * 0.72, 1);
        glowMatrices.push(m.clone().compose(pos, q, scale));
        glowColours.push(cold.clone().multiplyScalar(s.lit * 0.16));
      }
    }

    return {
      shapes: { matrices: shapeMatrices, colours: shapeColours },
      glow: { matrices: glowMatrices, colours: glowColours },
    };
  }, [level, palette]);

  const fill = (
    mesh: THREE.InstancedMesh | null,
    data: { matrices: THREE.Matrix4[]; colours: THREE.Color[] },
  ) => {
    if (!mesh) return;
    data.matrices.forEach((matrix, i) => {
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, data.colours[i]!);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  };

  if (shapes.matrices.length === 0) return null;

  return (
    <>
      <instancedMesh
        ref={(m) => fill(m, shapes)}
        args={[undefined, undefined, shapes.matrices.length]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial side={THREE.DoubleSide} fog toneMapped={false} />
      </instancedMesh>

      {glow.matrices.length > 0 && (
        <instancedMesh
          ref={(m) => fill(m, glow)}
          args={[undefined, undefined, glow.matrices.length]}
          frustumCulled={false}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            side={THREE.DoubleSide}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </instancedMesh>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ rain --- */

const RAIN_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uTop;
  uniform float uSpan;
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aEnd;
  attribute float aLength;
  varying float vFade;

  void main() {
    // The entire animation. One uniform changes per frame and nothing is
    // uploaded: a drop's position is a function of time, not a value the CPU
    // keeps and pushes.
    float t = fract(uTime * aSpeed + aPhase);
    vec3 p = position;
    p.y = uTop - t * uSpan - aEnd * aLength;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    // Near drops are bright and sharp; far ones dissolve into the haze, which
    // is what stops rain reading as a screen overlay.
    float near = 1.0 - clamp(-mv.z / 340.0, 0.0, 1.0);
    vFade = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.86, 1.0, t)) * (0.25 + near * 0.9);
    gl_Position = projectionMatrix * mv;
  }
`;

const RAIN_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFade;
  void main() {
    gl_FragColor = vec4(uColor, vFade * uOpacity);
  }
`;

/**
 * Rain, as GPU-animated line segments.
 *
 * Segments rather than points because rain is a streak and `gl_PointSize`
 * cannot make one. Two vertices per drop, one draw call for all of them, and
 * the fall happens in the vertex shader — the CPU writes a single `uTime`
 * uniform per frame and touches nothing else.
 *
 * It falls through the upper levels only. Rain in the substrate would be rain
 * underground, and the one thing this world cannot afford is to look like it
 * was assembled without thinking about what the place is.
 */
function Rain({
  count,
  palette,
  paused,
  floor,
}: {
  count: number;
  palette: Palette;
  paused: React.RefObject<boolean>;
  floor: number;
}) {
  const material = useRef<THREE.ShaderMaterial>(null);

  const { geometry, uniforms } = useMemo(() => {
    const span = 420;
    const radius = CITY_GEOMETRY.SPAN * 0.5;

    const position = new Float32Array(count * 2 * 3);
    const phase = new Float32Array(count * 2);
    const speed = new Float32Array(count * 2);
    const end = new Float32Array(count * 2);
    const length = new Float32Array(count * 2);

    // A fixed stream, derived from the index rather than from a clock, so the
    // weather is as reproducible as the city it falls on.
    for (let i = 0; i < count; i += 1) {
      const a = (i * 2.399963) % (Math.PI * 2);
      // Square root keeps the areal density even; without it every drop
      // crowds the centre of the shaft.
      const r = radius * Math.sqrt((i * 0.6180339887) % 1);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const p = (i * 0.7548776662) % 1;
      const s = 0.1 + ((i * 0.5698402909) % 1) * 0.12;
      const len = 3.5 + ((i * 0.3247179572) % 1) * 9;

      for (let v = 0; v < 2; v += 1) {
        const k = i * 2 + v;
        position[k * 3] = x;
        position[k * 3 + 1] = 0;
        position[k * 3 + 2] = z;
        phase[k] = p;
        speed[k] = s;
        end[k] = v;
        length[k] = len;
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(position, 3));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    g.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
    g.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
    g.setAttribute("aLength", new THREE.BufferAttribute(length, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius * 2 + span);

    return {
      geometry: g,
      uniforms: {
        uTime: { value: 0 },
        uTop: { value: floor + span * 0.62 },
        uSpan: { value: span },
        uColor: { value: new THREE.Color(palette.cold) },
        uOpacity: { value: 0.42 },
      },
    };
  }, [count, palette.cold, floor]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, delta) => {
    if (paused.current || !material.current) return;
    // Clamped so a backgrounded tab returning after a minute does not advance
    // the rain by a minute in a single frame.
    material.current.uniforms.uTime!.value += Math.min(delta, 0.05);
  });

  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={RAIN_VERTEX}
        fragmentShader={RAIN_FRAGMENT}
        transparent
        depthWrite={false}
      />
    </lineSegments>
  );
}

/* --------------------------------------------------------------- accents --- */

/**
 * Accent lights: the work the facade texture cannot do.
 *
 * Rack indicators on the substrate, where a two-metre cabinet has no facade to
 * speak of, and bright points close to the lens. Additively blended, so
 * overlapping cells brighten into a glow rather than occluding one another —
 * which is a bloom pass's result without a bloom pass.
 */
const ACCENT_VERTEX = /* glsl */ `
  uniform float uTime;
  attribute vec3 aTint;
  attribute float aPhase;
  attribute float aMode;
  varying vec3 vTint;
  varying float vLevel;

  // Cheap deterministic hash, for flicker that is irregular without being
  // random. Same input, same output, every frame and every reload.
  float hash(float n) { return fract(sin(n) * 43758.5453123); }

  void main() {
    float t = uTime + aPhase;
    float level = 1.0;

    if (aMode > 2.5) {
      // Blink. A hazard light is on for a short part of its period, which is
      // what separates a beacon from a pulsing decoration.
      float period = 2.6;
      level = step(fract(t / period), 0.22);
    } else if (aMode > 1.5) {
      // Flicker. A failing fixture: mostly lit, with short irregular dropouts
      // drawn from a hash of the current step rather than from noise, so two
      // renders of this city fail in exactly the same places.
      float step10 = floor(t * 9.0);
      float r = hash(step10 + aPhase * 17.0);
      level = r < 0.14 ? 0.18 + r : 1.0;
    } else if (aMode > 0.5) {
      // Breathe. Plant under load, a sign on a dimmer.
      level = 0.72 + 0.28 * (0.5 + 0.5 * sin(t * 0.9));
    }

    vTint = aTint;
    vLevel = level;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ACCENT_FRAGMENT = /* glsl */ `
  varying vec3 vTint;
  varying float vLevel;
  void main() {
    gl_FragColor = vec4(vTint * vLevel, vLevel);
  }
`;

/**
 * Accent light — the city's lamps.
 *
 * Previously an `InstancedMesh` of identical additive quads in two colours,
 * which is what made the whole world read as monochrome: every lit thing in
 * the city was `--accent` or `--cold`, and a facade of amber dots next to a
 * facade of cyan dots is a two-tone render however good the geometry is.
 *
 * Now every cell carries the colour of the fixture it is, and what that
 * fixture does over time. The colours come from the world — lit interiors,
 * old sodium, machine indicators, hazard beacons, service lights — and the
 * behaviours are overwhelmingly "nothing", because a city where every light
 * pulses is a screensaver.
 *
 * Merged quads rather than instances, which is the same trade `Traffic`
 * already makes here: four vertices per cell is nothing, and it buys per-cell
 * attributes and one shader driven by a single time uniform. Still one draw
 * call, still no per-frame upload, and the animation costs a sine and a step.
 */
function Accents({
  city,
  palette,
  paused,
}: {
  city: City;
  palette: Palette;
  paused: React.RefObject<boolean>;
}) {
  const material = useRef<THREE.ShaderMaterial>(null);

  const { geometry, uniforms, count } = useMemo(() => {
    const cells: LightCell[] = city.levels.flatMap((l) => [...l.lights]);
    const n = cells.length;

    const position = new Float32Array(n * 4 * 3);
    const tint = new Float32Array(n * 4 * 3);
    const phase = new Float32Array(n * 4);
    const mode = new Float32Array(n * 4);
    const index: number[] = [];

    const MODE: Record<LightCell["behaviour"], number> = {
      steady: 0,
      breathe: 1,
      flicker: 2,
      blink: 3,
    };

    const colour = new THREE.Color();

    cells.forEach((cell, i) => {
      colour.set(lightSourceColour(cell.source, palette)).multiplyScalar(cell.intensity);

      // The quad lies flat on its wall: `rotation` is the face yaw, so the
      // cell's own right vector is that yaw turned into the ground plane and
      // its up vector is the world's.
      const hw = cell.size / 2;
      const hh = (cell.size * 1.3) / 2;
      const rx = Math.cos(cell.rotation);
      const rz = -Math.sin(cell.rotation);
      const [cx, cy, cz] = cell.position;

      const corners: readonly (readonly [number, number])[] = [
        [-hw, -hh],
        [hw, -hh],
        [hw, hh],
        [-hw, hh],
      ];

      for (let v = 0; v < 4; v += 1) {
        const k = i * 4 + v;
        const [ax, ay] = corners[v]!;
        position[k * 3] = cx + rx * ax;
        position[k * 3 + 1] = cy + ay;
        position[k * 3 + 2] = cz + rz * ax;
        tint[k * 3] = colour.r;
        tint[k * 3 + 1] = colour.g;
        tint[k * 3 + 2] = colour.b;
        phase[k] = cell.phase;
        mode[k] = MODE[cell.behaviour];
      }

      const base = i * 4;
      index.push(base, base + 1, base + 2, base, base + 2, base + 3);
    });

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(position, 3));
    g.setAttribute("aTint", new THREE.BufferAttribute(tint, 3));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    g.setAttribute("aMode", new THREE.BufferAttribute(mode, 1));
    g.setIndex(index);
    g.computeBoundingSphere();

    return { geometry: g, uniforms: { uTime: { value: 0 } }, count: n };
  }, [city, palette]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, delta) => {
    if (paused.current || !material.current) return;
    material.current.uniforms.uTime!.value += Math.min(delta, 0.05);
  });

  if (count === 0) return null;

  return (
    // Not frustum-culled, for the same reason `Traffic` is not: this is one
    // merged buffer spanning the whole city, so its bounding sphere encloses
    // everything and testing it can only ever produce a false negative. The
    // first measured pass lost a draw call and 2,200 triangles here, which is
    // not an optimisation — it is the city's lights being dropped.
    <mesh geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={ACCENT_VERTEX}
        fragmentShader={ACCENT_FRAGMENT}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/* -------------------------------------------------------------- conduits --- */

function Conduits({ city, palette }: { city: City; palette: Palette }) {
  const geometry = useMemo(() => {
    const points: number[] = [];
    for (const level of city.levels) {
      for (const conduit of level.conduits) {
        for (let i = 0; i < conduit.points.length - 1; i += 1) {
          const a = conduit.points[i]!;
          const b = conduit.points[i + 1]!;
          points.push(a[0], a[1], a[2], b[0], b[1], b[2]);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    return g;
  }, [city]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial
        color={palette.cold}
        transparent
        opacity={0.26}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}

export { Street, Skyline, Rain, Accents, Conduits };
export type { StratumId };
