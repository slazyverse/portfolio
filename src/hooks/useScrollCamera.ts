"use client";

import { useEffect, useRef } from "react";

/**
 * Maps scroll across a tall track onto a continuous "camera depth", and hands
 * it to a callback on every animation frame.
 *
 * Deliberately callback-based rather than state-based. The zoom story updates
 * transforms 60 times a second; routing that through React state would
 * re-render the whole subtree on every frame, which is exactly the mistake that
 * made the depth rail expensive on a dual-core machine. The consumer writes
 * straight to `element.style`, so the work per frame is a handful of string
 * assignments and the compositor does the rest.
 *
 * `depth` runs from 0 at the top of the track to `range` at the bottom.
 */
export function useScrollCamera(
  range: number,
  onFrame: (depth: number) => void,
  enabled = true,
) {
  const trackRef = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const callback = useRef(onFrame);
  callback.current = onFrame;

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    if (!enabled) {
      // Park the camera at the last layer so the final state is what shows.
      callback.current(range);
      return;
    }

    const read = () => {
      frame.current = null;
      const rect = track.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) return;
      const p = Math.min(1, Math.max(0, -rect.top / scrollable));
      callback.current(p * range);
    };

    const onScroll = () => {
      if (frame.current === null) frame.current = requestAnimationFrame(read);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    read();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [range, enabled]);

  return trackRef;
}
