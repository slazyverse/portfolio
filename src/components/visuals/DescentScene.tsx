"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { DESCENT } from "@/data/descent";

/* ---------------------------------------------------------------------------
 * The descent, in three dimensions.
 *
 * Four layers standing in real space along Z. Scroll dollies the camera through
 * them; the pointer orbits it slightly, so the stack has visible parallax and
 * you can see that the layers are genuinely behind one another rather than
 * scaled copies of the same plane.
 *
 * Why WebGL is the right tool here rather than an indulgence: drei's `Text` is
 * signed-distance-field text on the GPU. It scales for free — no glyph
 * re-rasterisation at any zoom level. That is the exact cost that made the CSS
 * version stutter, so moving the zoom onto the GPU removes the problem at its
 * source instead of working around it.
 *
 * Budget discipline still applies:
 *  - `frameloop="demand"` — the renderer is idle unless scroll or pointer
 *    invalidates it. A still page costs nothing.
 *  - Device pixel ratio capped at 1.5, antialiasing off. On integrated
 *    graphics fill rate is the constraint, and SDF text is already smooth.
 *  - Materials are shared and geometry is two planes per layer.
 * ------------------------------------------------------------------------- */

const GAP = 6;
const ARCHIVO = "/fonts/Archivo.ttf";
const MONO = "/fonts/JetBrainsMono.ttf";

interface Palette {
  inkHi: string;
  ink: string;
  inkLow: string;
  accent: string;
  panel: string;
  ground: string;
  hair: string;
}

function readPalette(): Palette {
  const s = getComputedStyle(document.documentElement);
  const get = (n: string, f: string) => s.getPropertyValue(n).trim() || f;
  return {
    inkHi: get("--fg-hi", "#e9eef6"),
    ink: get("--fg", "#c3ccd9"),
    inkLow: get("--fg-low", "#788495"),
    accent: get("--accent", "#ff9e2c"),
    panel: get("--panel", "#0f151e"),
    ground: get("--ground", "#090d13"),
    hair: get("--hair-strong", "#222d3d"),
  };
}

/** Shared mutable camera target, written by scroll and pointer handlers. */
interface Driver {
  depth: number;
  pointerX: number;
  pointerY: number;
}

function Layer({
  index,
  palette,
  driver,
}: {
  index: number;
  palette: Palette;
  driver: React.RefObject<Driver>;
}) {
  const layer = DESCENT[index]!;
  const group = useRef<THREE.Group>(null);
  const headline = useRef<THREE.Mesh>(null);
  const body = useRef<THREE.Mesh>(null);
  const code = useRef<THREE.Mesh>(null);
  const panel = useRef<THREE.Mesh>(null);
  const frame = useRef<THREE.LineSegments>(null);

  const codeText = useMemo(() => layer.lines.join("\n"), [layer.lines]);

  useFrame(() => {
    const g = group.current;
    if (!g || !driver.current) return;

    // Signed distance from the camera, in layer units.
    // d < 0 → the layer is still ahead; d > 0 → the camera has passed it.
    const d = driver.current.depth - index;

    // The fade is deliberately asymmetric, because a camera is. A layer you
    // are approaching resolves gradually over a long run-up; a layer you have
    // just passed is enormous and directly in your face, so it has to clear
    // out fast or it covers whatever is arriving behind it. Symmetric fading
    // is what made the first pass unreadable.
    const AHEAD = 1.25;
    const BEHIND = 0.42;

    const visible = d < 0 ? d > -AHEAD : d < BEHIND;
    g.visible = visible;
    if (!visible) return;

    const o =
      d < 0
        ? Math.max(0, 1 - Math.pow(-d / AHEAD, 1.5))
        : Math.max(0, 1 - Math.pow(d / BEHIND, 0.85));

    for (const ref of [headline, body, code]) {
      const m = ref.current?.material as
        | (THREE.Material & { opacity: number })
        | undefined;
      if (m) m.opacity = o;
    }
    const pm = panel.current?.material as
      | (THREE.Material & { opacity: number })
      | undefined;
    if (pm) pm.opacity = o * 0.92;
    const fm = frame.current?.material as
      | (THREE.Material & { opacity: number })
      | undefined;
    if (fm) fm.opacity = o * 0.7;
  });

  const frameGeometry = useMemo(() => {
    const w = 3.3;
    const h = 1.05;
    const pts = [
      new THREE.Vector3(-w, -h, 0), new THREE.Vector3(w, -h, 0),
      new THREE.Vector3(w, -h, 0), new THREE.Vector3(w, h, 0),
      new THREE.Vector3(w, h, 0), new THREE.Vector3(-w, h, 0),
      new THREE.Vector3(-w, h, 0), new THREE.Vector3(-w, -h, 0),
    ];
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);

  return (
    <group ref={group} position={[0, 0, -index * GAP]}>
      <Text
        ref={headline}
        font={ARCHIVO}
        fontSize={0.34}
        maxWidth={6}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
        position={[0, 1.55, 0.02]}
        color={palette.inkHi}
        fillOpacity={1}
        material-transparent
        material-depthWrite={false}
      >
        {layer.headline}
      </Text>

      {/* The artefact panel. */}
      <mesh ref={panel} position={[0, 0.15, -0.02]}>
        <planeGeometry args={[6.6, 2.1]} />
        <meshBasicMaterial
          color={palette.panel}
          transparent
          opacity={0.92}
          depthWrite={false}
        />
      </mesh>

      <lineSegments ref={frame} geometry={frameGeometry} position={[0, 0.15, 0]}>
        <lineBasicMaterial
          color={palette.hair}
          transparent
          opacity={0.7}
          depthWrite={false}
        />
      </lineSegments>

      <Text
        ref={code}
        font={MONO}
        fontSize={0.19}
        lineHeight={1.7}
        anchorX="center"
        anchorY="middle"
        position={[0, 0.15, 0.02]}
        color={palette.accent}
        material-transparent
        material-depthWrite={false}
      >
        {codeText}
      </Text>

      <Text
        ref={body}
        font={ARCHIVO}
        fontSize={0.165}
        maxWidth={6.4}
        lineHeight={1.55}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
        position={[0, -1.5, 0.02]}
        color={palette.inkLow}
        material-transparent
        material-depthWrite={false}
      >
        {layer.body}
      </Text>
    </group>
  );
}

function Rig({
  driver,
  onInvalidate,
}: {
  driver: React.RefObject<Driver>;
  onInvalidate?: (fn: () => void) => void;
}) {
  const { camera, invalidate } = useThree();
  const current = useRef({ z: 4, x: 0, y: 0 });

  // `frameloop="demand"` means useFrame only runs once a frame is requested.
  // Requesting one from inside useFrame therefore cannot bootstrap itself —
  // scroll and pointer live outside the canvas, so they need the handle.
  useEffect(() => {
    onInvalidate?.(invalidate);
  }, [invalidate, onInvalidate]);

  useFrame(() => {
    const d = driver.current;
    if (!d) return;

    const targetZ = 4 - d.depth * GAP;
    // Pointer orbit is small on purpose: enough to prove the layers occupy
    // real space, not so much that reading becomes a moving target.
    const targetX = d.pointerX * 1.15;
    const targetY = d.pointerY * 0.7;

    const c = current.current;
    c.z += (targetZ - c.z) * 0.12;
    c.x += (targetX - c.x) * 0.08;
    c.y += (targetY - c.y) * 0.08;

    camera.position.set(c.x, c.y, c.z);
    camera.lookAt(c.x * 0.25, c.y * 0.25, c.z - GAP);

    // Keep rendering while anything is still easing toward its target.
    if (
      Math.abs(targetZ - c.z) > 0.002 ||
      Math.abs(targetX - c.x) > 0.001 ||
      Math.abs(targetY - c.y) > 0.001
    ) {
      invalidate();
    }
  });

  return null;
}

export default function DescentScene({
  driver,
  onInvalidate,
}: {
  driver: React.RefObject<Driver>;
  onInvalidate?: (fn: () => void) => void;
}) {
  const [palette, setPalette] = useState<Palette | null>(null);

  useEffect(() => {
    setPalette(readPalette());
    const observer = new MutationObserver(() => setPalette(readPalette()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  if (!palette) return null;

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: true }}
      camera={{ position: [0, 0, 4], fov: 42, near: 0.1, far: 60 }}
      style={{ position: "absolute", inset: 0 }}
    >
      <fog attach="fog" args={[palette.ground, GAP * 1.6, GAP * 3.4]} />
      <Rig driver={driver} onInvalidate={onInvalidate} />
      {DESCENT.map((_, i) => (
        <Layer key={i} index={i} palette={palette} driver={driver} />
      ))}
    </Canvas>
  );
}
