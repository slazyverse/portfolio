"use client";

import { useEffect, useRef, useState } from "react";
import { useMotionAllowed } from "@/components/providers/MotionProvider";

interface Props {
  /** The final rendered string, e.g. "11,700" or "O(P²·R)". */
  value: string;
}

/**
 * Counts a numeric metric up once, on first view.
 *
 * Values that are not plain numbers — "O(P²·R)", "6/6" — are rendered as-is
 * rather than mangled into a count. A metric that cannot be counted is not a
 * failure case to work around; it is simply a different kind of fact.
 */
export function CountUp({ value }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);
  const motion = useMotionAllowed();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (!motion) {
      setDisplay(value);
      return;
    }

    const digits = value.replace(/,/g, "");
    if (!/^\d+$/.test(digits)) return;

    const target = Number(digits);
    const grouped = value.includes(",");
    let raf = 0;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(el);

          const start = performance.now();
          const DURATION = 900;

          const tick = (now: number) => {
            const t = Math.min(1, (now - start) / DURATION);
            // Same deceleration curve as the reveals, so numbers settle in
            // step with the elements around them.
            const eased = 1 - Math.pow(1 - t, 4);
            const current = Math.round(target * eased);
            setDisplay(grouped ? current.toLocaleString("en-US") : String(current));
            if (t < 1) raf = requestAnimationFrame(tick);
          };

          setDisplay(grouped ? "0" : "0");
          raf = requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, motion]);

  return <span ref={ref}>{display}</span>;
}
