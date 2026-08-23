"use client";

import { useEffect, useRef } from "react";
import { useMotionAllowed } from "@/components/providers/MotionProvider";
import { onFirstView } from "@/lib/revealObserver";
import { cn } from "@/lib/cn";
import { STAGGER_MS } from "@/lib/motion";

interface Props {
  children?: React.ReactNode;
  /** Stagger index within a group. */
  index?: number;
  /**
   * `up`    — rises and fades (default)
   * `none`  — fades in place
   * `panel` — rises further and uncovers from its bottom edge, for diagrams
   * `rule`  — draws itself across from the left, for stratum rules
   */
  from?: "up" | "none" | "panel" | "rule";
  as?: "div" | "li" | "section" | "figure" | "span";
  className?: string;
}

/**
 * Entrance reveal, built on a shared IntersectionObserver and a CSS transition.
 *
 * This is deliberately not Framer Motion. Framer Motion costs 44 KB gzipped,
 * and the only things this site asks of it are a fade, a translate and a
 * stagger — roughly thirty lines. Shipping 44 KB to avoid writing them would
 * contradict the argument the page itself is making.
 *
 * The element is visible by default in the markup and the class only *hides*
 * it once JavaScript confirms it can animate it back in. So with JavaScript
 * disabled, or before hydration, all content is readable.
 *
 * `will-change` is set only for the duration of the transition and cleared on
 * `transitionend`. Left permanently on, 71 revealing elements would hold 71
 * GPU layers alive for the whole session — which on integrated graphics costs
 * far more than the compositing it was meant to save.
 */
export function Reveal({
  children,
  index = 0,
  from = "up",
  as: Tag = "div",
  className,
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const motion = useMotionAllowed();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect the preference by simply never arming the animation. If the
    // visitor turns motion off later, unarm so nothing is left hidden.
    if (!motion) {
      delete el.dataset.revealArmed;
      delete el.dataset.revealed;
      el.style.willChange = "";
      return;
    }

    el.dataset.revealArmed = "true";

    const release = () => {
      el.style.willChange = "";
      el.removeEventListener("transitionend", release);
    };

    const unsubscribe = onFirstView(el, () => {
      el.style.willChange = "opacity, transform";
      el.style.transitionDelay = `${index * STAGGER_MS}ms`;
      el.dataset.revealed = "true";
      el.addEventListener("transitionend", release);
      // Belt and braces: if the transition never fires (element hidden, tab
      // backgrounded), still drop the layer.
      window.setTimeout(release, 1400 + index * STAGGER_MS);
    });

    return () => {
      unsubscribe();
      el.removeEventListener("transitionend", release);
    };
  }, [index, motion]);

  return (
    <Tag
      ref={ref as React.Ref<never>}
      data-reveal={from}
      className={cn(className)}
    >
      {children}
    </Tag>
  );
}
