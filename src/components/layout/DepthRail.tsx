"use client";

import { useEffect, useRef, useState } from "react";
import { NAV, STRATA } from "@/data/site";

/**
 * The site's only persistent chrome, and its navigation.
 *
 * Performance shape matters here, because this is the one thing that reacts to
 * every scroll event on the page:
 *
 *  - Scroll progress is written to a CSS custom property, and the rail's fill
 *    is sized from it in CSS. It is *not* React state. Storing it in state
 *    re-rendered this component ~60 times a second, which on a dual-core
 *    laptop is real work for a bar that is 3px wide.
 *  - React state changes only when the *stratum* changes — four times across
 *    the whole page instead of once per frame.
 *  - The ground colour is stepped per stratum via `data-stratum`, so the page
 *    deepens in four CSS transitions rather than a full-viewport overlay
 *    recompositing on every frame. On integrated graphics that difference is
 *    the whole ballgame.
 *
 * Progressive enhancement: with JavaScript off the rail is a working anchor
 * list at depth 00.
 */
export function DepthRail() {
  const [stratumIndex, setStratumIndex] = useState(0);
  const [active, setActive] = useState<string>(NAV[0].id);
  const frame = useRef<number | null>(null);
  const lastStratum = useRef(-1);

  useEffect(() => {
    const root = document.documentElement;

    const read = () => {
      frame.current = null;
      const scrollable = root.scrollHeight - window.innerHeight;
      const p = scrollable > 0 ? window.scrollY / scrollable : 0;

      // Cheap: one custom property write, no React involved.
      root.style.setProperty("--depth", p.toFixed(3));

      const index = Math.min(STRATA.length - 1, Math.floor(p * STRATA.length));
      if (index !== lastStratum.current) {
        lastStratum.current = index;
        root.dataset.stratum = String(index);
        setStratumIndex(index);
      }
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
      root.style.removeProperty("--depth");
      delete root.dataset.stratum;
    };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );

    for (const item of NAV) {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const depth = STRATA[stratumIndex] ?? STRATA[0]!;

  return (
    <nav
      aria-label="Section navigation"
      className="fixed inset-y-0 left-0 z-40 hidden w-[var(--rail-w)] flex-col items-center border-r border-[var(--hair-faint)] py-8 md:flex"
    >
      <span className="t-label [writing-mode:vertical-rl] text-[var(--fg-low)]">
        Depth
      </span>

      <div className="relative my-6 w-px flex-1 bg-[var(--hair)]">
        {/* Height comes straight from --depth; no re-render, no shadow. */}
        <div className="rail-fill absolute -left-px w-[3px] bg-[var(--accent)]" />

        {NAV.map((item, i) => {
          const isActive = active === item.id;
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-current={isActive ? "true" : undefined}
              className="group absolute -left-3 flex h-6 w-6 items-center justify-center"
              style={{ top: `${(i / (NAV.length - 1)) * 100}%` }}
            >
              <span className="sr-only">{item.label}</span>
              <span
                aria-hidden="true"
                className={
                  isActive
                    ? "h-px w-5 bg-[var(--accent)]"
                    : "h-px w-3 bg-[var(--hair-strong)] group-hover:w-5 group-hover:bg-[var(--fg-mid)]"
                }
              />
              <span
                aria-hidden="true"
                className="t-label pointer-events-none absolute left-8 whitespace-nowrap text-[var(--fg-mid)] opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                {item.label}
              </span>
            </a>
          );
        })}
      </div>

      <span className="t-mono tnum text-[0.625rem] text-[var(--accent)]">
        {depth.index}
      </span>
    </nav>
  );
}
