"use client";

import { useEffect, useRef, useState } from "react";
import { StateBadge } from "@/components/primitives/StateBadge";
import { useMotionAllowed } from "@/components/providers/MotionProvider";

/* ---------------------------------------------------------------------------
 * The entry graph.
 *
 * Runs deadlockd's own model: four processes, three resources, allocation and
 * request edges. Every fifth cycle a circular wait closes, the graph locks, and
 * recovery clears it. This is the first thing a visitor sees because it is the
 * work itself, not an illustration of it.
 *
 * Budget: Canvas 2D, no dependencies, 20fps cap, paused entirely when
 * off-screen, no shadows. With motion off it renders one static safe state and
 * never starts a loop.
 * ------------------------------------------------------------------------- */

const W = 720;
const H = 520;
const FRAME_MS = 50; // 20fps. The graph evolves over seconds; on integrated
                     // graphics the frames saved matter more than the smoothness lost.

type Dir = "alloc" | "req";
interface Node {
  id: number;
  /** Rest position. */
  x: number;
  y: number;
  /** Current pointer-induced displacement, eased toward the target. */
  ox: number;
  oy: number;
}
interface Edge {
  p: number;
  r: number;
  dir: Dir;
  /** Current alpha, eased toward `target`. */
  a: number;
  target: number;
}

const PROCESSES: Node[] = Array.from({ length: 4 }, (_, i) => {
  const angle = (i / 4) * Math.PI * 2 - Math.PI / 2;
  return {
    id: i,
    x: 360 + Math.cos(angle) * 118,
    y: 260 + Math.sin(angle) * 118,
    ox: 0,
    oy: 0,
  };
});

const RESOURCES: Node[] = Array.from({ length: 3 }, (_, i) => {
  const angle = (i / 3) * Math.PI * 2 - Math.PI / 6;
  return {
    id: i,
    x: 360 + Math.cos(angle) * 212,
    y: 260 + Math.sin(angle) * 212,
    ox: 0,
    oy: 0,
  };
});

/** Pointer influence: nodes within this radius are pushed aside. */
const POINTER_RADIUS = 150;
const POINTER_PUSH = 26;

type EdgeSpec = readonly [number, number, Dir];

const SAFE_SETS: readonly EdgeSpec[][] = [
  [[0, 0, "alloc"], [1, 1, "alloc"], [2, 2, "alloc"], [3, 0, "req"]],
  [[0, 0, "alloc"], [1, 1, "alloc"], [3, 2, "alloc"], [2, 1, "req"]],
  [[1, 0, "alloc"], [2, 1, "alloc"], [0, 2, "req"], [3, 1, "req"]],
  [[0, 1, "alloc"], [2, 0, "alloc"], [3, 2, "alloc"], [1, 0, "req"]],
];

/** P0 → R0 → P1 → R1 → P2 → R2 → P0 */
const DEADLOCK: readonly EdgeSpec[] = [
  [0, 0, "alloc"], [1, 0, "req"],
  [1, 1, "alloc"], [2, 1, "req"],
  [2, 2, "alloc"], [0, 2, "req"],
];

const keyOf = (p: number, r: number, dir: Dir) => `${p}-${r}-${dir}`;
const CYCLE_KEYS = new Set(DEADLOCK.map(([p, r, d]) => keyOf(p, r, d)));
const LOCKED_PROCESSES = new Set([0, 1, 2]);

function readToken(styles: CSSStyleDeclaration, name: string, fallback: string) {
  return styles.getPropertyValue(name).trim() || fallback;
}

export function AllocationGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [locked, setLocked] = useState(false);
  const motion = useMotionAllowed();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = !motion;

    // Colours come from the live token layer rather than being duplicated here,
    // so the graph can never disagree with the stylesheet.
    let palette = {
      accent: "#ff9e2c",
      unsafe: "#ff5a5a",
      waiting: "#6fa8ff",
      panel: "#0f151e",
      fg: "#c3ccd9",
      low: "#5d6878",
    };
    const readPalette = () => {
      const s = getComputedStyle(document.documentElement);
      palette = {
        accent: readToken(s, "--accent", palette.accent),
        unsafe: readToken(s, "--state-unsafe", palette.unsafe),
        waiting: readToken(s, "--state-waiting", palette.waiting),
        panel: readToken(s, "--panel", palette.panel),
        fg: readToken(s, "--fg", palette.fg),
        low: readToken(s, "--fg-low", palette.low),
      };
    };
    readPalette();

    const edges: Edge[] = [];
    const setEdges = (specs: readonly EdgeSpec[]) => {
      const wanted = new Set(specs.map(([p, r, d]) => keyOf(p, r, d)));
      for (const e of edges) e.target = wanted.has(keyOf(e.p, e.r, e.dir)) ? 1 : 0;
      for (const [p, r, dir] of specs) {
        if (!edges.some((e) => keyOf(e.p, e.r, e.dir) === keyOf(p, r, dir))) {
          edges.push({ p, r, dir, a: 0, target: 1 });
        }
      }
    };

    let isLocked = false;
    let phase = 0;
    let setIndex = 0;
    let nextAt = 0;

    // Pointer position in the canvas's own 720x520 coordinate space.
    let pointerX = -9999;
    let pointerY = -9999;

    const toLocal = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerX = ((e.clientX - rect.left) / rect.width) * W;
      pointerY = ((e.clientY - rect.top) / rect.width) * W;
    };
    const clearPointer = () => {
      pointerX = -9999;
      pointerY = -9999;
    };

    /**
     * Nodes yield to the cursor and settle back. The displacement is capped and
     * eased, so the graph stays readable while it reacts — a system under load
     * that recovers, not a toy that scatters.
     */
    const settleNodes = () => {
      for (const n of [...PROCESSES, ...RESOURCES]) {
        const dx = n.x - pointerX;
        const dy = n.y - pointerY;
        const dist = Math.hypot(dx, dy);
        let tx = 0;
        let ty = 0;
        if (dist < POINTER_RADIUS && dist > 0.01) {
          const force = (1 - dist / POINTER_RADIUS) ** 2;
          tx = (dx / dist) * force * POINTER_PUSH;
          ty = (dy / dist) * force * POINTER_PUSH;
        }
        n.ox += (tx - n.ox) * 0.12;
        n.oy += (ty - n.oy) * 0.12;
      }
    };

    const advance = (now: number) => {
      if (isLocked) {
        isLocked = false;
        setIndex = (setIndex + 1) % SAFE_SETS.length;
        setEdges(SAFE_SETS[setIndex]!);
        nextAt = now + 3000;
        setLocked(false);
        return;
      }
      phase += 1;
      if (phase % 5 === 0) {
        isLocked = true;
        setEdges(DEADLOCK);
        nextAt = now + 4200;
        setLocked(true);
      } else {
        setIndex = (setIndex + 1) % SAFE_SETS.length;
        setEdges(SAFE_SETS[setIndex]!);
        nextAt = now + 2600;
      }
    };

    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.width * (H / W) * dpr);
      const scale = dpr * (rect.width / W);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    };

    const arrow = (
      x1: number, y1: number, x2: number, y2: number,
      colour: string, alpha: number, dashed: boolean, glow: boolean,
    ) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      if (len < 1) return;
      const ux = dx / len;
      const uy = dy / len;
      const sx = x1 + ux * 26;
      const sy = y1 + uy * 26;
      const ex = x2 - ux * 30;
      const ey = y2 - uy * 30;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = colour;
      // shadowBlur is one of the most expensive Canvas 2D operations, and this
      // ran per edge per frame. A slightly heavier stroke reads as emphasis
      // just as well and costs nothing.
      ctx.lineWidth = glow ? 2.2 : 1.4;
      ctx.setLineDash(dashed ? [4, 5] : []);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - ux * 9 + uy * 4.5, ey - uy * 9 - ux * 4.5);
      ctx.lineTo(ex - ux * 9 - uy * 4.5, ey - uy * 9 + ux * 4.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      settleNodes();

      ctx.save();
      ctx.strokeStyle = palette.low;
      ctx.globalAlpha = 0.1;
      ctx.lineWidth = 1;
      for (let x = 40; x < W; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 40; y < H; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      ctx.restore();

      for (const e of edges) {
        e.a += (e.target - e.a) * 0.06;
        if (e.a < 0.012) continue;
        const p = PROCESSES[e.p]!;
        const r = RESOURCES[e.r]!;
        const inCycle = isLocked && CYCLE_KEYS.has(keyOf(e.p, e.r, e.dir));
        const colour = inCycle
          ? palette.unsafe
          : e.dir === "alloc"
            ? palette.accent
            : palette.waiting;

        const px = p.x + p.ox;
        const py = p.y + p.oy;
        const rx = r.x + r.ox;
        const ry = r.y + r.oy;

        if (e.dir === "alloc") arrow(rx, ry, px, py, colour, e.a, false, inCycle);
        else arrow(px, py, rx, ry, colour, e.a * 0.85, true, inCycle);
      }

      for (const r of RESOURCES) {
        const rx = r.x + r.ox;
        const ry = r.y + r.oy;
        ctx.save();
        ctx.strokeStyle = palette.low;
        ctx.fillStyle = palette.panel;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.rect(rx - 21, ry - 21, 42, 42);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = palette.fg;
        ctx.font = "500 12px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`R${r.id}`, rx, ry);
        ctx.restore();
      }

      for (const p of PROCESSES) {
        const px = p.x + p.ox;
        const py = p.y + p.oy;
        const bad = isLocked && LOCKED_PROCESSES.has(p.id);
        ctx.save();
        ctx.strokeStyle = bad ? palette.unsafe : palette.low;
        ctx.fillStyle = palette.panel;
        // Deadlocked nodes are marked by weight and colour rather than a
        // shadow: canvas shadows are expensive and this ran on every node,
        // every frame. A 2.4px ring in --unsafe reads just as clearly.
        ctx.lineWidth = bad ? 2.4 : 1.4;
        ctx.beginPath();
        ctx.arc(px, py, 23, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = bad ? palette.unsafe : palette.fg;
        ctx.font = "500 12px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`P${p.id}`, px, py);
        ctx.restore();
      }

      ctx.save();
      ctx.font = "500 10px ui-monospace, monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = palette.low;
      ctx.fillText("P 4   R 3", 20, 20);
      ctx.fillText(
        isLocked ? "CYCLE  P0→R0→P1→R1→P2→R2→P0" : "IsSafeState()  →  true",
        20, 38,
      );
      ctx.restore();
    };

    setEdges(SAFE_SETS[0]!);
    for (const e of edges) e.a = 1;
    fit();
    draw();

    const onResize = () => {
      fit();
      draw();
    };
    window.addEventListener("resize", onResize);

    // Phase 1 watched `data-theme` here so a reduced-motion visitor who
    // switched theme did not keep a canvas painted in the old palette. Phase 2
    // removed the light theme, so there is no longer a theme to switch and the
    // observer would never fire. The palette is read once, above.

    // Reduced motion: one static, legible safe state. No loop is ever started,
    // and the pointer never displaces anything.
    if (reduce) {
      return () => window.removeEventListener("resize", onResize);
    }

    canvas.addEventListener("pointermove", toLocal, { passive: true });
    canvas.addEventListener("pointerleave", clearPointer);

    let raf: number | null = null;
    let last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < FRAME_MS) return;
      last = now;
      if (now > nextAt) advance(now);
      draw();
    };

    nextAt = performance.now() + 2600;

    // Off-screen canvases do no work.
    const visibility = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && raf === null) {
            last = 0;
            raf = requestAnimationFrame(loop);
          } else if (!entry.isIntersecting && raf !== null) {
            cancelAnimationFrame(raf);
            raf = null;
          }
        }
      },
      { threshold: 0.05 },
    );
    visibility.observe(canvas);

    return () => {
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointermove", toLocal);
      canvas.removeEventListener("pointerleave", clearPointer);
      visibility.disconnect();
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [motion]);

  return (
    <figure className="border border-[var(--hair)] bg-[var(--panel)]">
      <figcaption className="t-label flex items-center justify-between gap-4 border-b border-[var(--hair)] px-4 py-3 text-[var(--fg-low)]">
        <span>Resource allocation graph</span>
        <StateBadge state={locked ? "unsafe" : "safe"} className="border-0 px-0">
          {locked ? "Deadlocked" : "Safe"}
        </StateBadge>
      </figcaption>

      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        role="img"
        aria-label={
          locked
            ? "Resource allocation graph: a circular wait has closed between processes 0, 1 and 2. The system is deadlocked."
            : "Resource allocation graph: four processes hold and request three resources. The system is in a safe state."
        }
        className="block h-auto w-full"
      />

      {/* The graph's state in text, for assistive technology and for anyone
          who cannot see the canvas. Never information held only in pixels. */}
      <p
        aria-live="polite"
        className="t-mono border-t border-[var(--hair)] px-4 py-3 text-[var(--fg-low)]"
      >
        {locked
          ? "Circular wait: P0 → R0 → P1 → R1 → P2 → R2 → P0"
          : "Simulation running — safe state"}
      </p>
    </figure>
  );
}
