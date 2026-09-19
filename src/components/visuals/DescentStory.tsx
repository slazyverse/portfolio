"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import dynamic from "next/dynamic";
import { useScrollCamera } from "@/hooks/useScrollCamera";
import { useMotionAllowed } from "@/components/providers/MotionProvider";
import { DESCENT } from "@/data/descent";
import { webglStore } from "@/lib/capability";
import { cancelAll, staggerIn } from "@/lib/motion";
import { cn } from "@/lib/cn";

/* ---------------------------------------------------------------------------
 * The descent.
 *
 * Four layers of one real request — surface, interface, engine, substrate —
 * standing in 3D space. Scroll dollies a camera through them; the pointer
 * orbits it, so the depth is something you can look around rather than
 * something you are told about.
 *
 * The WebGL scene is loaded only when this section approaches the viewport, so
 * three.js is never in the initial bundle. If WebGL is unavailable, or motion
 * is off, the same content renders as plain stacked HTML — the story is the
 * content, and the scene is a way of pacing it.
 * ------------------------------------------------------------------------- */

const DescentScene = dynamic(() => import("./DescentScene"), { ssr: false });

const RANGE = DESCENT.length;


export function DescentStory() {
  const motion = useMotionAllowed();
  const [active, setActive] = useState(0);
  const [near, setNear] = useState(false);
  const lastActive = useRef(0);
  const chromeRef = useRef<HTMLDivElement>(null);

  // Shared, mutable driver. Scroll and pointer write to it; the render loop
  // reads it. Nothing here passes through React state, so moving the pointer
  // across the scene never triggers a re-render.
  const driver = useRef({ depth: 0, pointerX: 0, pointerY: 0 });
  const frameRef = useRef<HTMLDivElement>(null);
  // Handle to the renderer's frame request. The canvas runs on demand, so
  // every input that moves the camera has to ask for a frame explicitly.
  const invalidate = useRef<(() => void) | null>(null);

  // A device capability is not React state: it is a fact the server cannot
  // know and that never changes once measured. Reading it as a store gives the
  // server a defined answer (false) instead of a post-mount setState, which is
  // what produced the cascading-render warning here.
  const webgl = useSyncExternalStore(
    webglStore.subscribe,
    webglStore.getSnapshot,
    webglStore.getServerSnapshot,
  );

  // Only mount the scene once the section is within a screen of the viewport.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setNear(true);
      },
      { rootMargin: "100% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const onFrame = useCallback((depth: number) => {
    driver.current.depth = depth;
    invalidate.current?.();
    const nearest = Math.min(RANGE - 1, Math.max(0, Math.round(depth)));
    if (nearest !== lastActive.current) {
      lastActive.current = nearest;
      setActive(nearest);
    }
  }, []);

  // The depth readout re-deals itself each time the camera reaches a new layer.
  //
  // This was anime.js, which cost 21.5 KB gzipped in the initial bundle to
  // orchestrate a two-element fade-and-rise. `staggerIn` does the same work on
  // the native Web Animations API for nothing, and settles on the system's own
  // --ease-out-expo curve rather than the library's approximation of it.
  useEffect(() => {
    const el = chromeRef.current;
    if (!el || !motion) return;
    const parts = el.querySelectorAll<HTMLElement>("[data-chrome]");
    const animations = staggerIn(parts);
    return () => cancelAll(animations);
  }, [active, motion]);

  const trackRef = useScrollCamera(RANGE, onFrame, motion);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    driver.current.pointerX = ((e.clientX - r.left) / r.width) * 2 - 1;
    driver.current.pointerY = -(((e.clientY - r.top) / r.height) * 2 - 1);
    invalidate.current?.();
  }, []);

  const onPointerLeave = useCallback(() => {
    driver.current.pointerX = 0;
    driver.current.pointerY = 0;
    invalidate.current?.();
  }, []);

  const use3D = motion && webgl;

  return (
    <>
      {/* The story as text — always present, always complete, always in order. */}
      {/* Always sr-only: in 3D the canvas is aria-hidden, and in the fallback
          the stacked panels are too, so this list is the accessible copy of the
          descent in both modes. */}
      <ol className="sr-only">
        {DESCENT.map((layer) => (
          <li key={layer.index}>
            <h3>{`${layer.index} ${layer.name} — ${layer.headline}`}</h3>
            <p>{layer.body}</p>
            <p>{layer.lines.filter(Boolean).join(". ")}</p>
            <p>{layer.path}</p>
          </li>
        ))}
      </ol>

      <div
        ref={trackRef}
        className={use3D ? "relative h-[400vh]" : undefined}
        aria-hidden="true"
      >
        <div
          ref={frameRef}
          onPointerMove={use3D ? onPointerMove : undefined}
          onPointerLeave={use3D ? onPointerLeave : undefined}
          className={cn(
            "descent-frame relative overflow-hidden border border-[var(--hair)] bg-[var(--panel)]",
            use3D
              ? "sticky top-0 h-screen cursor-grab"
              : "flex flex-col items-center justify-center gap-14 p-8",
          )}
        >
          {/* Chrome sits above the canvas as normal DOM — it never scales, so
              it costs nothing and stays crisp. */}
          <div
            ref={chromeRef}
            className="pointer-events-none absolute top-6 left-6 z-20 flex items-baseline gap-3"
          >
            <span
              data-chrome
              className="t-mono tnum text-[0.6875rem] tracking-[0.18em] text-[var(--accent)]"
            >
              {DESCENT[active]!.index}
            </span>
            <span data-chrome className="t-label text-[var(--fg-low)]">
              {DESCENT[active]!.name}
            </span>
          </div>

          <div className="pointer-events-none absolute right-6 bottom-6 z-20">
            <span className="t-mono text-[0.6875rem] text-[var(--fg-low)]">
              {DESCENT[active]!.path}
            </span>
          </div>

          {use3D && (
            <>
              {near && (
                <DescentScene
                  driver={driver}
                  onInvalidate={(fn) => {
                    invalidate.current = fn;
                    fn();
                  }}
                />
              )}
              <div className="pointer-events-none absolute bottom-6 left-6 z-20">
                <span className="t-label text-[var(--fg-low)]">
                  Move the pointer to look around
                </span>
              </div>
            </>
          )}

          {/* Fallback: no WebGL, or motion turned off. Same content, stacked. */}
          {!use3D &&
            DESCENT.map((layer) => (
              <div
                key={layer.index}
                className="flex w-full max-w-[620px] flex-col items-center gap-5 text-center"
              >
                <p className="t-h3 max-w-[24ch] text-[1.375rem] leading-[1.2] text-[var(--fg-hi)]">
                  {layer.headline}
                </p>
                {/* Not focusable, and deliberately so.
                    This whole track is aria-hidden because the descent is
                    duplicated verbatim in the sr-only list above; a focusable
                    element inside an aria-hidden subtree is reachable by
                    keyboard but invisible to a screen reader, which is the
                    aria-hidden-focus violation. These snippets are four short
                    lines, so they wrap instead of scrolling and no scroll
                    region — and therefore no tabindex — is needed. */}
                <pre className="t-mono w-full border border-[var(--hair)] bg-[var(--deep)] px-5 py-4 text-left break-words whitespace-pre-wrap text-[var(--accent)]">
                  <code>{layer.lines.join("\n")}</code>
                </pre>
                <p className="t-small max-w-[46ch] text-[var(--fg-mid)]">
                  {layer.body}
                </p>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
