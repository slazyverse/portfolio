"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { useRouteContext } from "@/components/chrome/useRouteContext";
import { endSignal, noteBeat, signalLive } from "@/components/landing/signal-store";
import { useSignalState } from "@/components/landing/useSignal";
import type { EntryBeat } from "@/lib/environment/entry-policy";
import { environmentStandsDown } from "./standsDown";
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
 * ## Where it stands down — and why it does not unmount
 *
 * One route owns its own scene, so this layer hides there rather than drawing
 * a second city behind someone else's: `/system`, the environment laboratory,
 * whose whole purpose is to render the city at a tier this device may not have
 * chosen. That was not a guess. With the global environment and the lab stage
 * both live, `/system` was rendering two complete cities at once — one of them
 * with a planar reflection pass — and the page could not finish a frame. A
 * page that exists to let you look at the city carefully is the last place to
 * be rendering it twice.
 *
 * The landing used to be on that list. It is not any more: as of Phase 6 the
 * city *is* the landing, and the scroll-driven descent scene further down that
 * page yields the GPU to it rather than opening a second context.
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
  const { level, pathname, route } = useRouteContext();
  const { mode, tier, motion, fail, failure } = useEnvironment();
  const signal = useSignalState();

  const ownsItsOwnScene = environmentStandsDown(pathname);
  const active = !ownsItsOwnScene && mode !== "none";

  /*
   * The opening shot, handed to the renderer as data.
   *
   * The environment does not decide whether there is one — the landing does,
   * from facts about this visit — and it does not know what the beats mean.
   * It forwards them to the store and the hero reads them there. That keeps
   * the camera and the headline in step without the layout knowing a headline
   * exists.
   *
   * `onReady` is the one that flows the other way. The landing cannot know
   * when this device will manage its first frame, and the renderer cannot
   * know whether the page has run out of patience, so the renderer asks at
   * the only moment when both facts exist.
   */
  const onReady = useCallback(() => signalLive(), []);
  const onBeat = useCallback((beat: EntryBeat) => noteBeat(beat), []);
  const onDone = useCallback(() => endSignal(), []);
  const entry =
    signal.length === "none"
      ? undefined
      : { length: signal.length, onReady, onBeat, onDone };

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
          // The camera stands by level and faces by route. A path with no
          // route record — there is none, but the context types it as
          // optional — falls back to the landing, which is the level's own
          // composition.
          routeId={route?.id ?? "signal"}
          motion={motion}
          // Hidden means stopped, not merely invisible: `paused` takes the
          // render loop to `never`, so a canvas nobody can see draws nothing.
          paused={!active}
          onFail={fail}
          entry={entry}
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
          suppressed={ownsItsOwnScene ? `${pathname} owns its own scene` : undefined}
        />
      )}
    </div>
  );
}
