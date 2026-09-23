"use client";

import { useEffect, useMemo, useRef } from "react";
import type { StratumId } from "@/data/types";
import type { QualityTier } from "@/lib/capability";
import { CITY_GEOMETRY, generateCity } from "@/lib/environment/generate";

/**
 * The 2D fallback: the same city, drawn as a silhouette.
 *
 * It reads the same generated model as the WebGL renderer rather than
 * inventing a decorative substitute. That matters more than it sounds — a
 * fallback built from different data is a second thing to maintain, and it
 * drifts until one day it no longer resembles what it stands in for. Here the
 * same structures are projected flat, sorted back to front, and hazed by depth.
 *
 * It does not animate. There is no `requestAnimationFrame` loop in this file at
 * all: it paints on mount, on resize and on level change, and then costs
 * nothing. A device that could not give us WebGL is not a device to run a
 * continuous 2D compositing loop on.
 */
export default function CanvasAtmosphere({
  tier,
  level,
  className,
}: {
  tier: QualityTier;
  level: StratumId;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  // The same generator the WebGL path uses, behind the same lazy boundary.
  const city = useMemo(() => generateCity(tier), [tier]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const paint = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (w === 0 || h === 0) return;

      // Capped at 1.5 for the same reason the WebGL renderer caps DPR: on the
      // machines that reach this path, fill rate is the constraint.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const styles = getComputedStyle(document.documentElement);
      const read = (name: string, fallback: string) =>
        styles.getPropertyValue(name).trim() || fallback;
      const amber = read("--accent", "#ff9e2c");
      const cold = read("--cold", "#7fb4cf");

      const band = city.levels.find((l) => l.level === level) ?? city.levels[0];
      if (!band) return;

      const horizon = h * 0.78;
      const half = CITY_GEOMETRY.SPAN / 2;

      // Back to front, so nearer masses occlude further ones — the only depth
      // cue available without a depth buffer.
      const ordered = [...band.structures].sort((a, b) => b.position[2] - a.position[2]);

      for (const s of ordered) {
        const [x, , z] = s.position;
        const [sw, sh] = s.size;
        // Depth 0 (far) to 1 (near).
        const depth = (z + half) / (half * 2);
        const scale = 0.42 + depth * 0.9;
        const screenX = w / 2 + (x / half) * (w * 0.62) * scale;
        const width = Math.max(2, (sw / half) * w * 0.5 * scale);
        const height = (sh / half) * h * 0.62 * scale;

        // Haze: further masses sit closer to the ground colour. This is the
        // whole atmospheric effect, and it costs one alpha value per rect.
        ctx.globalAlpha = 0.18 + depth * 0.5;
        ctx.fillStyle = "#0b111a";
        ctx.fillRect(screenX - width / 2, horizon - height, width, height);

        if (s.signal !== "none") {
          ctx.globalAlpha = (0.1 + depth * 0.28) * 0.55;
          ctx.fillStyle = s.signal === "amber" ? amber : cold;
          ctx.fillRect(screenX - width / 2, horizon - height, width, Math.min(height, 2));
        }
      }

      ctx.globalAlpha = 1;
    };

    paint();

    // `ResizeObserver` rather than a window resize listener: the environment
    // fills its container, and the container can change size without the
    // window doing so.
    const observer = new ResizeObserver(paint);
    if (canvas.parentElement) observer.observe(canvas.parentElement);
    return () => observer.disconnect();
  }, [city, level]);

  return <canvas ref={ref} className={className} />;
}
