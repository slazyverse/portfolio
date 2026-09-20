"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouteContext } from "@/components/chrome/useRouteContext";
import { useEnvironment } from "./useEnvironment";

/**
 * Nothing that draws the city is statically imported here.
 *
 * `next/dynamic` means the import only executes once the mode has actually
 * resolved, so a low-tier device downloads neither the renderer nor the
 * generator — not deferred, not idle-prefetched, not fetched at all. The
 * generator lives behind the same boundary as the renderers rather than beside
 * this file, because a visitor whose device will never draw a city has no
 * reason to carry the code that describes one.
 *
 * What remains in the initial bundle is this component, the capability probes
 * and one pure resolver: enough to decide, and nothing more.
 */
const CityScene = dynamic(() => import("./CityScene"), { ssr: false });
const CanvasAtmosphere = dynamic(() => import("./CanvasAtmosphere"), { ssr: false });

/**
 * Development-only, and excluded from production by the bundler.
 *
 * `process.env.NODE_ENV` is inlined at build time, so this ternary folds to
 * `null` and the import is never reached — the diagnostics module and
 * everything it pulls in are absent from a production build entirely, rather
 * than present but unreachable.
 */
const Diagnostics =
  process.env.NODE_ENV === "production"
    ? null
    : dynamic(() => import("./EnvironmentDiagnostics"), { ssr: false });

/**
 * The persistent environment layer.
 *
 * Mounted once in the root layout, beneath everything. It persists across
 * navigation for exactly the reason the chrome does — App Router keeps layout
 * components mounted — so the city is generated once, the WebGL context is
 * created once, and moving between routes moves the camera rather than
 * rebuilding the world. No portal, no global singleton, no imperative
 * mount/unmount juggling: Phase 4 already paid for this.
 *
 * ## It is decorative, and structurally so
 *
 * `aria-hidden` and `pointer-events: none`, with nothing focusable inside and
 * no text anywhere in the scene. Not as a precaution — as the architecture.
 * Navigation lives in the DOM chrome, content is server-rendered, and the city
 * is never the way to reach anything. A reader with no WebGL, no JavaScript, a
 * screen reader, or a browser from 2016 loses atmosphere and nothing else.
 *
 * ## Why it stands down on the landing page — and why it does not unmount
 *
 * `/` already owns a WebGL context for the descent scene, so this layer hides
 * there rather than drawing a second city behind someone else's.
 *
 * It hides; it does not unmount. That distinction was earned. The first
 * version removed the canvas on `/` and rebuilt it on the way out, which looks
 * tidy and is the more careful-seeming choice — and fifty navigation cycles
 * through the landing page made the browser drop the WebGL context. The
 * failure path worked exactly as designed: the environment stepped down to
 * `none`. It also stayed there, permanently, for the rest of the session,
 * because a context loss is not something to retry in a loop.
 *
 * Repeatedly creating and destroying GPU contexts is the thing that causes
 * that, so the context is created once and kept. It is created lazily, on the
 * first route that actually wants it, so a visitor who only ever sees the
 * landing page never pays for one at all — and while hidden the render loop is
 * stopped outright, so a kept context costs memory and not a single frame.
 */
export function Environment() {
  const { level, pathname } = useRouteContext();
  const { mode, tier, motion, fail, failure } = useEnvironment();

  const onLanding = pathname === "/";
  const active = !onLanding && mode !== "none";

  // Once the environment has been wanted, it stays mounted for the session.
  // Adjusting state during render rather than in an effect: this is derived
  // from props on the way through, and an effect would render once without it
  // and then again with it.
  const [everMounted, setEverMounted] = useState(false);
  if (active && !everMounted) setEverMounted(true);

  return (
    <div
      className="env"
      aria-hidden="true"
      data-mode={active ? mode : "none"}
      data-active={active ? "true" : "false"}
    >
      {/* The CSS base. Server-rendered, always present, zero JavaScript. This
          is the floor of the fallback chain: whatever else fails to start, the
          page still has depth rather than a flat black rectangle. */}
      <div className="env-base" />

      {everMounted && mode === "webgl" && (
        <CityScene
          tier={tier}
          level={level}
          motion={motion}
          // Hidden means stopped, not merely invisible: `paused` takes the
          // render loop to `never`, so a canvas nobody can see draws nothing.
          paused={!active}
          onFail={fail}
          className="env-canvas"
        />
      )}

      {everMounted && mode === "canvas" && (
        <CanvasAtmosphere tier={tier} level={level} className="env-canvas" />
      )}

      {Diagnostics && (
        <Diagnostics
          mode={active ? mode : "none"}
          tier={tier}
          motion={motion}
          level={level}
          failure={failure}
          suppressed={onLanding ? "landing page owns its own scene" : undefined}
        />
      )}
    </div>
  );
}
