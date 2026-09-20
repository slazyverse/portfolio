"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import type { StratumId } from "@/data/types";
import { QUALITY, type QualityTier } from "@/lib/capability";
import { cameraTargetForLevel, descentDuration, easeInOut } from "@/lib/environment/camera";
import { CITY_GEOMETRY, generateCity } from "@/lib/environment/generate";
import { environmentBudget } from "@/lib/environment/quality";
import type { City, LightCell, Structure } from "@/lib/environment/types";

/* ---------------------------------------------------------------------------
 * The city, rendered.
 *
 * The rule that shapes this whole file: the city is a handful of draw calls.
 * Every structure across all four levels is one `InstancedMesh`. Every lit cell
 * is one more. Every conduit on every level is a single merged `LineSegments`.
 * The rain is one `LineSegments` animated entirely in a vertex shader, so a
 * frame of rain costs one uniform write rather than fourteen hundred position
 * updates on the CPU.
 *
 * What is deliberately absent:
 *
 *  - post-processing. No bloom pass, no chromatic aberration, no full-screen
 *    effect stack. A bloom pipeline is a second full-resolution render plus
 *    several blur passes, which on integrated graphics costs more than the
 *    entire city. The glow here is additive blending on the lit quads — the
 *    look, at a fraction of the price.
 *  - shadows. A shadow map is another render pass per light.
 *  - per-window lights. The lit cells are emissive quads, not light sources.
 *    Fourteen hundred real lights would not render at all.
 *
 * Depth comes from fog, which is one line and costs nothing.
 * ------------------------------------------------------------------------- */

interface Palette {
  ground: string;
  structure: string;
  amber: string;
  cold: string;
  hair: string;
}

function readPalette(): Palette {
  const s = getComputedStyle(document.documentElement);
  const get = (n: string, f: string) => s.getPropertyValue(n).trim() || f;
  return {
    ground: get("--deep", "#05070a"),
    structure: get("--color-l3", "#161e2a"),
    amber: get("--accent", "#ff9e2c"),
    cold: get("--cold", "#7fb4cf"),
    hair: get("--hair-strong", "#222d3d"),
  };
}

/* -------------------------------------------------------------- structures - */

/**
 * Every building, mast, machine block and rack in the city, as one mesh.
 *
 * Instance matrices are written once, on mount, and never touched again — the
 * city does not animate, the camera moves through it. That is the difference
 * between a scene that costs something per frame and one that does not.
 */
function Structures({ city, palette }: { city: City; palette: Palette }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const all = useMemo(
    () => city.levels.flatMap((l) => [...l.structures]),
    [city],
  );

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const colour = new THREE.Color();
    // The raised surface token rather than the panel one. At the panel value
    // the facades sat within a couple of RGB steps of the fog and the city
    // read as a black rectangle — technically drawn, effectively invisible.
    const base = new THREE.Color(palette.structure);

    all.forEach((s: Structure, i) => {
      const [x, y, z] = s.position;
      const [w, h, d] = s.size;
      // Box geometry is centred; the model stores the base, because a base is
      // what a building actually stands on.
      position.set(x, y + h / 2, z);
      scale.set(w, h, d);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.rotation);
      mesh.setMatrixAt(i, m.compose(position, q, scale));

      // Facades vary slightly, and taller masses sit a touch lighter — enough
      // to separate one silhouette from the one behind it without lighting.
      const lift = 0.85 + Math.min(h / 60, 0.55);
      colour.copy(base).multiplyScalar(lift);
      mesh.setColorAt(i, colour);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [all, palette.structure]);

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, all.length]}
      frustumCulled={false}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------ lights - */

/**
 * Windows and indicator panels: one instanced quad per lit cell.
 *
 * Additively blended, so overlapping cells brighten rather than occlude and a
 * dense rack of indicators reads as a glow without any post-processing. Depth
 * writing is off for the same reason a transparent thing should never write
 * depth — it would punch holes in whatever is drawn after it.
 */
function Lights({ city, palette }: { city: City; palette: Palette }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const all = useMemo(() => city.levels.flatMap((l) => [...l.lights]), [city]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh || all.length === 0) return;

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const colour = new THREE.Color();
    const amber = new THREE.Color(palette.amber);
    const cold = new THREE.Color(palette.cold);

    all.forEach((cell: LightCell, i) => {
      const [x, y, z] = cell.position;
      position.set(x, y, z);
      scale.set(cell.size, cell.size * 1.35, 1);
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
  }, [all, palette.amber, palette.cold]);

  if (all.length === 0) return null;

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, all.length]} frustumCulled={false}>
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

/* ---------------------------------------------------------------- conduits - */

/** Every cable run and pipe on every level, merged into one line geometry. */
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

  // Geometry built here is owned here, so it is disposed here. A generated
  // scene that leaks one buffer per mount leaks on every route change.
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial
        color={palette.cold}
        transparent
        opacity={0.22}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}

/* -------------------------------------------------------------------- rain - */

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
    // The whole animation. One uniform changes per frame; nothing is uploaded.
    float t = fract(uTime * aSpeed + aPhase);
    vec3 p = position;
    p.y = uTop - t * uSpan - aEnd * aLength;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    // Fade in at the top of the fall and out at the bottom, so drops are never
    // seen to pop into or out of existence.
    vFade = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.82, 1.0, t));
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
 * Segments rather than points because rain is a streak, and `gl_PointSize`
 * cannot produce one. Two vertices per drop, one draw call for all of them,
 * and the fall happens in the vertex shader — the CPU writes a single `uTime`
 * uniform per frame and touches nothing else.
 *
 * It falls only through the upper levels. Rain in the substrate would be rain
 * underground, and the one thing this environment cannot afford is to look
 * like it was assembled without thinking about what the place is.
 */
function Rain({
  count,
  palette,
  paused,
}: {
  count: number;
  palette: Palette;
  /**
   * A ref, not a boolean. Visibility changes outside React and the frame loop
   * has to see the current value — passing a boolean would re-render the scene
   * to deliver it, and would hand `useFrame` whatever was true at render time.
   */
  paused: React.RefObject<boolean>;
}) {
  const material = useRef<THREE.ShaderMaterial>(null);

  const { geometry, uniforms } = useMemo(() => {
    const top = 46;
    const span = 128;
    const radius = CITY_GEOMETRY.SPAN * 0.42;

    const position = new Float32Array(count * 2 * 3);
    const phase = new Float32Array(count * 2);
    const speed = new Float32Array(count * 2);
    const end = new Float32Array(count * 2);
    const length = new Float32Array(count * 2);

    // A fixed stream, seeded off the index, so the rain is as deterministic as
    // the city it falls on. Reload-stable screenshots include the weather.
    for (let i = 0; i < count; i += 1) {
      const a = (i * 2.399963) % (Math.PI * 2);
      const r = radius * Math.sqrt(((i * 0.6180339887) % 1));
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const p = ((i * 0.7548776662) % 1);
      const s = 0.06 + ((i * 0.5698402909) % 1) * 0.07;
      const len = 1.4 + ((i * 0.3247179572) % 1) * 2.6;

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

    return {
      geometry: g,
      uniforms: {
        uTime: { value: 0 },
        uTop: { value: top },
        uSpan: { value: span },
        uColor: { value: new THREE.Color(palette.cold) },
        uOpacity: { value: 0.3 },
      },
    };
  }, [count, palette.cold]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, delta) => {
    if (paused.current || !material.current) return;
    // Clamped so a backgrounded tab returning after a minute does not advance
    // the rain by a minute in one frame.
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

/* ------------------------------------------------------------------ ground - */

/**
 * One merged plane per level floor, drawn as a single geometry.
 *
 * Extended far past the fog's far plane on purpose. Sized to the city's own
 * footprint, the plane's edge was visible as a hard diagonal cutting the
 * frame — a floor that visibly stops is worse than no floor. Out past the fog,
 * it fades into the ground colour and simply reads as ground.
 */
function Ground({ city, palette }: { city: City; palette: Palette }) {
  const geometry = useMemo(() => {
    const half = CITY_GEOMETRY.SPAN * 2.6;
    const positions: number[] = [];
    for (const level of city.levels) {
      const y = level.floor - 0.05;
      positions.push(
        -half, y, -half, half, y, -half, half, y, half,
        -half, y, -half, half, y, half, -half, y, half,
      );
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    return g;
  }, [city]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <meshBasicMaterial color={palette.ground} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ camera - */

/**
 * Drives the camera to the current level's target.
 *
 * The transition is time-based rather than a per-frame lerp toward a moving
 * goal, because a lerp has no defined duration — it approaches forever and you
 * cannot say when it is done, which makes "is the camera settled?" untestable
 * and makes the descent take a different time depending on frame rate.
 *
 * Under reduced motion the duration is zero and the camera snaps. That is the
 * correct reading of the preference: not a faster descent, no descent.
 */
function Rig({
  level,
  motion,
}: {
  level: StratumId;
  motion: boolean;
}) {
  const invalidate = useThree((state) => state.invalidate);
  // The camera is declared as a scene object with a ref rather than taken from
  // `useThree`, so the rig owns the thing it animates. Mutating a value a hook
  // returned would be reaching into state that belongs to the renderer.
  const cam = useRef<THREE.PerspectiveCamera>(null);

  const from = useRef(cameraTargetForLevel(level));
  const to = useRef(cameraTargetForLevel(level));
  const start = useRef(0);
  const duration = useRef(0);
  const previous = useRef<StratumId>(level);
  const focus = useRef(new THREE.Vector3());

  useEffect(() => {
    const camera = cam.current;
    if (!camera) return;

    from.current = {
      position: [camera.position.x, camera.position.y, camera.position.z] as const,
      lookAt: [focus.current.x, focus.current.y, focus.current.z] as const,
      fov: camera.fov,
    };
    to.current = cameraTargetForLevel(level);
    duration.current = descentDuration(previous.current, level, !motion);
    start.current = performance.now();
    previous.current = level;
    invalidate();
  }, [level, motion, invalidate]);

  useFrame(() => {
    const camera = cam.current;
    if (!camera) return;

    const elapsed = performance.now() - start.current;
    const t = duration.current <= 0 ? 1 : Math.min(elapsed / duration.current, 1);
    const k = easeInOut(t);

    const a = from.current;
    const b = to.current;
    camera.position.set(
      a.position[0] + (b.position[0] - a.position[0]) * k,
      a.position[1] + (b.position[1] - a.position[1]) * k,
      a.position[2] + (b.position[2] - a.position[2]) * k,
    );
    focus.current.set(
      a.lookAt[0] + (b.lookAt[0] - a.lookAt[0]) * k,
      a.lookAt[1] + (b.lookAt[1] - a.lookAt[1]) * k,
      a.lookAt[2] + (b.lookAt[2] - a.lookAt[2]) * k,
    );
    camera.lookAt(focus.current);

    const fov = a.fov + (b.fov - a.fov) * k;
    if (Math.abs(camera.fov - fov) > 0.001) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    // Keep requesting frames only while the descent is still running. When it
    // settles, `demand` means the renderer goes quiet until something else
    // asks for a frame.
    if (t < 1) invalidate();
  });

  const initial = cameraTargetForLevel(level);
  return (
    <PerspectiveCamera
      ref={cam}
      makeDefault
      position={[initial.position[0], initial.position[1], initial.position[2]]}
      fov={initial.fov}
      near={0.5}
      far={260}
    />
  );
}

/* ------------------------------------------------------------- the scene --- */

function Scene({
  city,
  level,
  motion,
  tier,
  palette,
  paused,
}: {
  city: City;
  level: StratumId;
  motion: boolean;
  tier: QualityTier;
  palette: Palette;
  paused: React.RefObject<boolean>;
}) {
  const budget = environmentBudget(tier);
  const rain = motion && budget.rain > 0;

  return (
    <>
      {/* Fog does the atmospheric work that a post-processing pass would
          otherwise be asked for, at the cost of one line. It is also what makes
          the shaft read as deep rather than as a short tube. */}
      <fog attach="fog" args={[palette.ground, 14, 155]} />
      <ambientLight intensity={0.8} color={palette.cold} />
      {/* One directional light, no shadows. Enough to separate the faces of a
          box; anything more would be lighting a city that is meant to be dark. */}
      <directionalLight position={[40, 60, 20]} intensity={0.7} color={palette.cold} />

      <Ground city={city} palette={palette} />
      <Structures city={city} palette={palette} />
      <Lights city={city} palette={palette} />
      <Conduits city={city} palette={palette} />
      {rain && <Rain count={budget.rain} palette={palette} paused={paused} />}

      <Rig level={level} motion={motion} />
    </>
  );
}

export interface CitySceneProps {
  level: StratumId;
  tier: QualityTier;
  motion: boolean;
  /**
   * Stop rendering entirely while keeping the context alive.
   *
   * Used when the environment is hidden — on the landing page, which owns its
   * own scene. Keeping the context and stopping the loop costs memory and no
   * frames; unmounting would cost a context teardown and rebuild on every
   * visit, which is what makes a browser start dropping contexts.
   */
  paused?: boolean;
  /** Called when the renderer cannot continue — context loss, or creation failure. */
  onFail: (reason: string) => void;
  className?: string;
}

export default function CityScene({
  level,
  tier,
  motion,
  paused: stopped = false,
  onFail,
  className,
}: CitySceneProps) {
  const palette = useMemo(() => readPalette(), []);
  // Generated here rather than passed in, so the generator sits behind the same
  // lazy boundary as the renderer. Pure and memoised on the tier: a route
  // change moves the camera and never rebuilds the city.
  const city = useMemo(() => generateCity(tier), [tier]);
  const budget = environmentBudget(tier);
  const quality = QUALITY[tier];

  // Rain is the only continuously animating thing in the scene, so it is the
  // only reason to hold the render loop open. Without it the renderer is idle
  // between route changes and a still page costs nothing, which is the whole
  // point of `demand`.
  const animating = motion && budget.rain > 0;
  const frameloop = stopped ? "never" : animating ? "always" : "demand";

  const paused = useRef(false);
  useEffect(() => {
    // Browsers already throttle rAF in a hidden tab, but not on every platform
    // and not in every embedding. Stating it explicitly costs one listener.
    const onVisibility = () => {
      paused.current = document.visibilityState === "hidden";
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return (
    <Canvas
      className={className}
      frameloop={frameloop}
      /**
       * `flat` disables tone mapping.
       *
       * React Three Fiber defaults to ACES filmic tone mapping, which is the
       * right default for a scene lit in physical units and the wrong one
       * here: every colour in this city is a design-system token, chosen and
       * contrast-checked as an exact value. ACES rolls the dark end off hard,
       * and on a palette that is almost entirely dark end it took the city to
       * near-black — correct by the renderer's lights, and not the city.
       *
       * The tokens render as authored.
       */
      flat
      dpr={[1, quality.maxDpr]}
      gl={{
        antialias: budget.antialias,
        alpha: true,
        powerPreference: "high-performance",
        // The scene is never read back, and saying so lets the driver skip
        // preserving the buffer after each present.
        preserveDrawingBuffer: false,
      }}
      onCreated={({ gl }) => {
        const canvas = gl.domElement;
        const lost = (e: Event) => {
          // Preventing the default is what makes restoration possible at all;
          // this environment does not attempt one, but swallowing the event
          // silently would leave a dead canvas on screen.
          e.preventDefault();
          onFail("WebGL context lost");
        };
        canvas.addEventListener("webglcontextlost", lost);
      }}
      style={{ position: "absolute", inset: 0 }}
    >
      <Scene
        city={city}
        level={level}
        motion={motion}
        tier={tier}
        palette={palette}
        paused={paused}
      />
    </Canvas>
  );
}
