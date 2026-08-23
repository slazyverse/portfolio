"use client";

import { useEffect, useRef, useState } from "react";
import { useMotionAllowed } from "@/components/providers/MotionProvider";
import { clamp } from "@/lib/motion";

/**
 * Maps scroll position across a tall section onto a discrete step index, so a
 * sequence executes at the reader's pace and steps backwards when they scroll
 * back.
 *
 * Why this is not GSAP ScrollTrigger:
 *
 * ScrollTrigger's `pin` works by injecting a pin-spacer element and rewriting
 * layout — powerful, but it costs ~27 KB gzipped on top of GSAP core. CSS
 * `position: sticky` already does the pinning natively, correctly, and for
 * free; all that is left is arithmetic on a bounding rect, which is this hook,
 * at 0 KB.
 *
 * The whole site is an argument about weighing decisions rather than reaching
 * for the default, so it should hold itself to that.
 *
 * Returns the active step, and the caller renders the final step statically
 * when `reduced` is true — no information is ever trapped mid-sequence.
 */
export function useScrubbedSteps(stepCount: number) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const motion = useMotionAllowed();
  const reduced = !motion;

  useEffect(() => {
    if (!motion) {
      // Show the completed sequence: the conclusion is the information.
      setStep(stepCount - 1);
      return;
    }

    const track = trackRef.current;
    if (!track) return;

    let raf: number | null = null;

    const measure = () => {
      raf = null;
      const rect = track.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) return;

      // 0 when the track's top reaches the viewport top,
      // 1 when its bottom reaches the viewport bottom.
      const progress = clamp(-rect.top / scrollable);

      // A short dwell at each end so the first and last steps are readable
      // rather than flashing past at the boundaries.
      const eased = clamp((progress - 0.06) / 0.88);
      setStep(Math.min(stepCount - 1, Math.floor(eased * stepCount)));
    };

    const onScroll = () => {
      if (raf === null) raf = requestAnimationFrame(measure);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    measure();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [stepCount, motion]);

  return { trackRef, step, reduced };
}
