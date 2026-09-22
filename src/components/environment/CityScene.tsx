"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { StratumId } from "@/data/types";
import { QUALITY, type QualityTier } from "@/lib/capability";
import {
  cameraTargetForLevel,
  descentDuration,
  easeInOut,
} from "@/lib/environment/camera";
import { generateCity } from "@/lib/environment/generate";
import { environmentBudget } from "@/lib/environment/quality";
import type { City, LevelEnvironment } from "@/lib/environment/types";
import { KitPieces, Masses } from "./city/Buildings";
import { lightRig, readPalette, type Palette } from "./city/palette";
import { createCityTextures, type CityTextures } from "./city/textures";
import { ContactShade, Steam, Traffic } from "./city/Life";
import { WetSheen } from "./city/Wet";
import { Accents, Conduits, Rain, Skyline, Street } from "./city/World";

/* ---------------------------------------------------------------------------
 * The city, rendered.
 *
 * COMPOSITION FIRST. Every shot in this world is built as foreground,
 * midground and background, and the budget follows that order:
 *
 *   FOREGROUND   the street, its reflection, and the rain falling through it
 *   MIDGROUND    buildings with the full kit — fins, plant, signage, pipework
 *   BACKGROUND   flat impostors and haze, for a fraction of a percent of cost
 *
 * Detail is assigned by distance from the camera at generation time, so a
 * tower three hundred metres out never pays for fins nobody can resolve. That
 * single rule is what lets the near buildings be as detailed as they are.
 *
 * WHAT IS DELIBERATELY ABSENT. No post-processing stack: no bloom pass, no
 * chromatic aberration, no screen-space pipeline. A bloom chain is a second
 * full-resolution render plus several blur passes, which on integrated
 * graphics costs more than the entire city — and additive emissive quads plus
 * the reflection give the same read for a fraction of it. No shadow maps
 * either: each would be another full render of the scene, and in a world lit
 * by overcast sky and its own windows there is almost no hard shadow to cast.
 *
 * The one expensive thing here is the planar reflection on the street, and it
 * is HIGH-only, surface-and-engine-only, and named as the most expensive
 * feature in the environment. It is also the one that makes a wet street read
 * as wet, which is exactly the trade the brief asks for.
 * ------------------------------------------------------------------------- */

/* ------------------------------------------------------------------ fog --- */

/**
 * Atmosphere, eased rather than switched.
 *
 * Each level has its own fog colour and range, so descending genuinely changes
 * the air. Snapping between them mid-descent would be a visible cut in the one
 * moment the camera is asking to be believed, so the fog travels with the
 * camera on the same curve.
 */
function Atmosphere({ level, palette }: { level: StratumId; palette: Palette }) {
  // Declared as scene objects rather than assigned onto the scene: R3F owns
  // `scene`, and a component that writes to it every frame is a component
  // fighting the renderer for the same field. Refs on the declared nodes give
  // the same animation without reaching into anything.
  const fog = useRef<THREE.Fog>(null);
  const background = useRef<THREE.Color>(null);
  const target = useRef({ colour: new THREE.Color(palette.fog), near: 60, far: 800 });

  const rig = lightRig(level, palette);
  const near = rig.fog[0];
  const far = rig.fog[1];

  useEffect(() => {
    target.current.colour.set(palette.fog);
    target.current.near = near;
    target.current.far = far;
  }, [palette.fog, near, far]);

  useFrame((_, delta) => {
    const f = fog.current;
    if (!f) return;
    const k = Math.min(delta * 2.2, 1);
    f.color.lerp(target.current.colour, k);
    f.near += (target.current.near - f.near) * k;
    f.far += (target.current.far - f.far) * k;
    background.current?.lerp(target.current.colour, k);
  });

  return (
    <>
      <fog ref={fog} attach="fog" args={[palette.fog, near, far]} />
      <color ref={background} attach="background" args={[palette.fog]} />
    </>
  );
}

/* ---------------------------------------------------------------- lights --- */

/**
 * The light rig: three sources, no shadows.
 *
 * An ambient fill for the sky, a key for direction, and a rim from the
 * opposite side to separate silhouettes from the fog behind them. Three is
 * enough to model form and few enough that `MeshStandardMaterial` stays cheap
 * — lighting cost is per fragment per light, and this world is mostly large
 * flat surfaces.
 *
 * Everything else that glows is emissive rather than a light source. Fourteen
 * hundred lit windows as real lights would not render at all.
 */
function Lighting({ level, palette }: { level: StratumId; palette: Palette }) {
  const rig = lightRig(level, palette);
  const key = useRef<THREE.DirectionalLight>(null);
  const rim = useRef<THREE.DirectionalLight>(null);
  const ambient = useRef<THREE.HemisphereLight>(null);

  // Eased for the same reason the fog is: a hard change of lighting during a
  // descent is a cut, and this camera is meant to be travelling.
  useFrame((_, delta) => {
    const k = Math.min(delta * 2.2, 1);
    if (ambient.current) {
      ambient.current.color.lerp(new THREE.Color(rig.ambient.colour), k);
      ambient.current.intensity += (rig.ambient.intensity - ambient.current.intensity) * k;
    }
    if (key.current) {
      key.current.color.lerp(new THREE.Color(rig.key.colour), k);
      key.current.intensity += (rig.key.intensity - key.current.intensity) * k;
    }
    if (rim.current) {
      rim.current.color.lerp(new THREE.Color(rig.rim.colour), k);
      rim.current.intensity += (rig.rim.intensity - rim.current.intensity) * k;
    }
  });

  return (
    <>
      <hemisphereLight
        ref={ambient}
        args={[rig.ambient.colour, palette.ground, rig.ambient.intensity]}
      />
      <directionalLight
        ref={key}
        position={rig.key.position as unknown as THREE.Vector3}
        intensity={rig.key.intensity}
        color={rig.key.colour}
      />
      <directionalLight
        ref={rim}
        position={rig.rim.position as unknown as THREE.Vector3}
        intensity={rig.rim.intensity}
        color={rig.rim.colour}
      />
    </>
  );
}

/* ----------------------------------------------------------------- size --- */

/**
 * Keeps the renderer the size of its container.
 *
 * React Three Fiber measures its own container, and that measurement can
 * arrive as zero and never be corrected — which is exactly what happened here.
 * The scene graph built correctly, the lights were right, five thousand
 * triangles of geometry were ready, and the renderer drew **zero frames**,
 * because a renderer with no size has nothing to draw into. The canvas sat at
 * the HTML default of 300x150 inside an 839x542 container and the result
 * looked precisely like a black screen.
 *
 * It is not only a startup race, which is why this is a component rather than
 * a one-off nudge: the laboratory's full-bleed toggle changes the container
 * from a panel to the whole viewport without the window ever resizing, and
 * that resize has to reach the renderer too.
 *
 * `ResizeObserver` reports the initial size on `observe`, so this covers both
 * the first measurement and every later one, and `setSize` is R3F's own API —
 * it updates the drawing buffer and the camera's aspect together.
 */
function FitToContainer() {
  const gl = useThree((state) => state.gl);
  const setSize = useThree((state) => state.setSize);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const parent = gl.domElement.parentElement;
    if (!parent) return;
    const apply = () => {
      const width = parent.offsetWidth;
      const height = parent.offsetHeight;
      if (width > 0 && height > 0) {
        setSize(width, height);
        invalidate();
      }
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(parent);

    /*
     * Re-fit when the page becomes visible.
     *
     * `ResizeObserver` callbacks are delivered during the rendering steps, and
     * a hidden document does not run them — so a page opened in a background
     * tab can finish loading with the renderer never having been told its own
     * size. It heals itself the moment the tab is shown, but only if something
     * asks, and this is that something.
     *
     * Found while doing visual review through a hidden browser pane, which
     * reproduced the background-tab case exactly.
     */
    const onVisible = () => {
      if (document.visibilityState === "visible") apply();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [gl, setSize, invalidate]);

  return null;
}

/* ------------------------------------------------------------------ rig --- */

function Rig({ level, motion }: { level: StratumId; motion: boolean }) {
  const set = useThree((state) => state.set);
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);

  /*
   * A plain three.js camera, declared and owned here.
   *
   * This used drei's `PerspectiveCamera`, and the environment no longer
   * depends on drei at all — the reflection pass was the other user, and
   * removing both took the deferred bundle back under its ceiling. A camera
   * is twenty lines; a dependency is forever.
   */
  const cam = useRef<THREE.PerspectiveCamera>(null);
  const initial = cameraTargetForLevel(level);

  // Declared as a scene object and promoted to the default camera once it
  // exists. Mutating a node this component declared is fine; mutating a value
  // a hook handed back is not, which is what ruled out both `useState` and
  // reading a ref during render.
  useEffect(() => {
    if (cam.current) set({ camera: cam.current });
  }, [set]);

  // Aspect follows the container, which `FitToContainer` keeps truthful.
  useEffect(() => {
    const camera = cam.current;
    if (!camera || size.height === 0) return;
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
    invalidate();
  }, [size, invalidate]);

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

    // Keep requesting frames only while the descent is still running.
    if (t < 1) invalidate();
  });

  return (
    <perspectiveCamera
      ref={cam}
      fov={initial.fov}
      near={0.6}
      far={2400}
      position={[initial.position[0], initial.position[1], initial.position[2]]}
    />
  );
}

/* ---------------------------------------------------------------- scene --- */

function Scene({
  city,
  level,
  motion,
  tier,
  palette,
  textures,
  paused,
}: {
  city: City;
  level: StratumId;
  motion: boolean;
  tier: QualityTier;
  palette: Palette;
  textures: CityTextures;
  paused: React.RefObject<boolean>;
}) {
  const budget = environmentBudget(tier);
  const band: LevelEnvironment =
    city.levels.find((l) => l.level === level) ?? city.levels[0]!;

  // Rain belongs to weather, and weather belongs to the sky. It falls on the
  // two levels that have one.
  const rains = motion && budget.rain > 0 && (level === "surface" || level === "interface");

  return (
    <>
      <Atmosphere level={level} palette={palette} />
      <Lighting level={level} palette={palette} />

      <Street level={band} textures={textures} />
      <WetSheen city={city} palette={palette} />
      <Skyline level={band} palette={palette} />
      {budget.contactShade && <ContactShade city={city} />}

      <Masses city={city} textures={textures} />
      <KitPieces city={city} palette={palette} />
      <Accents city={city} palette={palette} />
      <Conduits city={city} palette={palette} />

      {rains && (
        <Rain count={budget.rain} palette={palette} paused={paused} floor={band.floor} />
      )}
      {motion && budget.traffic > 0 && (
        <Traffic
          count={budget.traffic}
          floor={band.floor}
          palette={palette}
          paused={paused}
        />
      )}
      {motion && budget.groundFx && (
        <Steam city={city} floor={band.floor} palette={palette} paused={paused} />
      )}

      <FitToContainer />
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
  const palette = useMemo(() => readPalette(level), [level]);
  const budget = environmentBudget(tier);
  const quality = QUALITY[tier];

  // Generated here rather than passed in, so the generator sits behind the same
  // lazy boundary as the renderer. Pure and memoised on the tier: a route
  // change moves the camera and never rebuilds the city.
  const city = useMemo(() => generateCity(tier), [tier]);

  // Textures are drawn once per tier and owned by the scene. Roughly 12 MB of
  // GPU memory at HIGH, and every byte of it generated rather than fetched.
  const textures = useMemo(
    () => createCityTextures(budget.textureSize, city.seed),
    [budget.textureSize, city.seed],
  );
  useEffect(() => () => textures.dispose(), [textures]);

  // Rain and drifting mist are the only continuously animating things, so they
  // are the only reason to hold the render loop open. Without them the
  // renderer is idle between route changes.
  const animating =
    motion && (budget.rain > 0 || budget.groundFx || budget.traffic > 0);
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
       * Measure the container by its offset box, immediately.
       *
       * React Three Fiber sizes its canvas from a measurement of the
       * container, and with the container absolutely positioned that
       * measurement could come back before layout had settled — leaving the
       * drawing buffer at the HTML default of 300x150 while the container was
       * 839x542. The renderer ran perfectly into a canvas nobody could see the
       * right part of, which looked exactly like a black screen.
       *
       * `offsetSize` reads `offsetWidth`/`offsetHeight` rather than a bounding
       * rect, which is defined for an absolutely positioned box from the
       * first layout, and no debounce means the correct size is applied on
       * that same frame instead of 200ms later.
       */
      resize={{ scroll: false, debounce: 0, offsetSize: true }}
      dpr={[1, quality.maxDpr]}
      gl={{
        antialias: budget.antialias,
        alpha: false,
        powerPreference: "high-performance",
        preserveDrawingBuffer: false,
      }}
      /**
       * `flat` disables tone mapping.
       *
       * React Three Fiber defaults to ACES filmic tone mapping, which is right
       * for a scene lit in physical units and wrong here: every colour in this
       * city is a design-system token, chosen and contrast-checked as an exact
       * value. ACES rolls the dark end off hard, and on a palette that is
       * almost entirely dark end it took the city to near-black — correct by
       * the renderer's lights, and not the city.
       */
      flat
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
    >
      <Scene
        city={city}
        level={level}
        motion={motion}
        tier={tier}
        palette={palette}
        textures={textures}
        paused={paused}
      />
    </Canvas>
  );
}
