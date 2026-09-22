"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";
import type { StratumId } from "@/data/types";
import { CITY_GEOMETRY } from "@/lib/environment/generate";
import type { EnvironmentBudget } from "@/lib/environment/quality";
import type { City, LevelEnvironment, LightCell } from "@/lib/environment/types";
import type { CityTextures } from "./textures";
import type { Palette } from "./palette";

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
 * At HIGH this is a real planar reflection — a second render of the scene into
 * a 512px buffer, blurred. It is by a wide margin the most expensive thing in
 * the environment, and it is also the single change that turns a dark street
 * into a wet one. That is exactly the trade the brief asks for: buy the hero
 * surface, not a uniform sprinkle of effects nobody can point at.
 *
 * Below HIGH the same plane keeps the road texture and loses the reflection.
 * It is still wet — the albedo has standing water painted into it — it just
 * no longer reflects the city that is standing in it.
 */
function Street({
  level,
  textures,
  budget,
}: {
  level: LevelEnvironment;
  textures: CityTextures;
  budget: EnvironmentBudget;
}) {
  const size = CITY_GEOMETRY.SPAN * 3.2;

  // Lane markings belong on a street. The first pass painted the same road
  // across all four levels, so the substrate — a server hall two hundred
  // metres underground — had highway lane markings running through it.
  const paved = level.level === "surface" || level.level === "engine";
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

  // Reflections are only ever worth it where there is sky and light to catch.
  // A server hall floor reflecting a dark ceiling is a render pass spent on
  // nothing, so the deep levels opt out regardless of tier.
  const reflective =
    budget.reflections !== false && (level.level === "surface" || level.level === "engine");

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, level.floor - 0.1, 0]}
      frustumCulled={false}
    >
      <planeGeometry args={[size, size]} />
      {reflective && budget.reflections ? (
        <MeshReflectorMaterial
          map={map}
          resolution={budget.reflections.resolution}
          blur={[budget.reflections.blur, budget.reflections.blur / 3]}
          mixBlur={1.4}
          mixStrength={1.9}
          // Deliberately not a mirror. Wet asphalt scatters — a perfect
          // reflection reads as ice, and the blur is what makes it read as
          // water on a rough surface.
          roughness={0.72}
          depthScale={1.1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.3}
          metalness={0.42}
          // White: the road texture is the albedo. Multiplying it by the
          // near-black ground token made the street disappear, which is the
          // same mistake as tinting the facades with an interface colour.
          color="#ffffff"
          mirror={0}
        />
      ) : (
        <meshStandardMaterial
          map={map}
          color={paved ? "#ffffff" : "#2a3038"}
          roughness={paved ? 0.52 : 0.9}
          metalness={paved ? 0.38 : 0.1}
        />
      )}
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

/**
 * Ground mist.
 *
 * Three large, slowly drifting planes just above the street. Volumetric fog
 * would be a full-screen raymarch; this is three quads, and at ground level
 * behind a rain curtain the difference is not one anybody can point to.
 */
function GroundMist({
  floor,
  palette,
  paused,
  motion,
}: {
  floor: number;
  palette: Palette;
  paused: React.RefObject<boolean>;
  motion: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const size = CITY_GEOMETRY.SPAN * 1.6;

  useFrame((state) => {
    if (paused.current || !motion || !group.current) return;
    const t = state.clock.elapsedTime * 0.02;
    group.current.children.forEach((child, i) => {
      child.position.x = Math.sin(t + i * 2.1) * 26;
      child.position.z = Math.cos(t * 0.8 + i * 1.7) * 26;
    });
  });

  return (
    <group ref={group}>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, floor + 6 + i * 9, 0]}
          frustumCulled={false}
        >
          <planeGeometry args={[size, size]} />
          <meshBasicMaterial
            color={palette.fog}
            transparent
            opacity={0.1 - i * 0.022}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
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
function Accents({ city, palette }: { city: City; palette: Palette }) {
  const cells = useMemo(() => city.levels.flatMap((l) => [...l.lights]), [city]);

  const fill = (mesh: THREE.InstancedMesh | null) => {
    if (!mesh || cells.length === 0) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const colour = new THREE.Color();
    const amber = new THREE.Color(palette.amber);
    const cold = new THREE.Color(palette.cold);

    cells.forEach((cell: LightCell, i) => {
      position.set(cell.position[0], cell.position[1], cell.position[2]);
      scale.set(cell.size, cell.size * 1.3, 1);
      q.setFromAxisAngle(up, cell.rotation);
      mesh.setMatrixAt(i, m.compose(position, q, scale));
      colour
        .copy(cell.signal === "amber" ? amber : cold)
        .multiplyScalar(cell.intensity);
      mesh.setColorAt(i, colour);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  };

  if (cells.length === 0) return null;

  return (
    <instancedMesh ref={fill} args={[undefined, undefined, cells.length]} frustumCulled>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </instancedMesh>
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

export { Street, Skyline, Rain, GroundMist, Accents, Conduits };
export type { StratumId };
