"use client";

import { useEffect, useRef } from "react";
import { useMotionAllowed } from "@/components/providers/MotionProvider";
import { cn } from "@/lib/cn";

interface Props {
  /** Each entry is one visual line, revealed in sequence. */
  lines: React.ReactNode[];
  className?: string;
  /** Delay before the first line, in ms. */
  delay?: number;
  as?: "h1" | "h2" | "p";
  id?: string;
}

/**
 * Headline reveal: each line rises out of its own clipping box, so the type
 * reads as being uncovered rather than flying in.
 *
 * Lines are authored explicitly rather than measured at runtime. Splitting text
 * by measuring line boxes breaks the moment a font swaps or a container
 * resizes, and it puts each word in its own element, which makes the heading
 * hostile to screen readers and to copy-paste. Authored lines keep the heading
 * a single readable string.
 */
export function TextReveal({
  lines,
  className,
  delay = 0,
  as: Tag = "h1",
  id,
}: Props) {
  const ref = useRef<HTMLHeadingElement>(null);
  const motion = useMotionAllowed();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const masks = Array.from(el.querySelectorAll<HTMLElement>(".line-mask"));

    if (!motion) {
      for (const m of masks) {
        delete m.dataset.lineArmed;
        delete m.dataset.revealed;
      }
      return;
    }
    // Arm: hide the lines only now that we know we can animate them back.
    for (const m of masks) m.dataset.lineArmed = "true";

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          masks.forEach((m, i) => {
            // The transition lives on the inner span, so the delay is passed
            // down as a custom property rather than set on the mask itself.
            m.style.setProperty("--line-delay", `${delay + i * 90}ms`);
            m.dataset.revealed = "true";
          });
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay, motion]);

  return (
    <Tag ref={ref} id={id} className={cn(className)}>
      {lines.map((line, i) => (
        <span key={i} className="line-mask">
          <span>{line}</span>
        </span>
      ))}
    </Tag>
  );
}
