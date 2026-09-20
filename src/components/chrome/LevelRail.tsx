"use client";

import Link from "next/link";
import { LEVEL_NAME, LEVEL_ORDER, levelIndex, routeForLevel } from "@/data/routes";
import { cn } from "@/lib/cn";
import type { RouteContext } from "./useRouteContext";

interface Props {
  context: RouteContext;
}

/**
 * The level rail. Desktop only.
 *
 * This is what `DepthRail` became. The old rail tracked scroll position on a
 * single page and had no routes to point at; with a real information
 * architecture, depth is something you navigate rather than something you
 * scroll past, so each level is now a link to that level's entry route.
 *
 * Both rails existing at once was never an option — two navigation systems
 * disagreeing about where the visitor is would be worse than either alone.
 *
 * Destinations come from the route table via `routeForLevel`, so adding a
 * route at a level cannot leave the rail pointing somewhere stale.
 */
export function LevelRail({ context }: Props) {
  return (
    <nav
      aria-label="Levels"
      className="fixed inset-y-0 left-0 z-[var(--z-rail)] hidden w-[var(--rail-w)] flex-col items-center border-r border-[var(--hair-faint)] py-6 md:flex"
    >
      <span className="t-label [writing-mode:vertical-rl] text-[var(--fg-low)]">
        Depth
      </span>

      <ol className="my-6 flex flex-1 flex-col items-center justify-center gap-6">
        {LEVEL_ORDER.map((level) => {
          const target = routeForLevel(level);
          const current = context.level === level;
          const index = levelIndex(level);

          return (
            <li key={level}>
              <Link
                href={target.path}
                aria-current={current ? "true" : undefined}
                // 44px square. The visible mark is a hairline and a two-digit
                // readout, but the target a pointer has to hit is the whole
                // cell — WCAG 2.2 SC 2.5.8 sets the floor at 24px and the rail
                // is 72px wide, so there is no reason to be near it.
                className="group flex min-h-11 min-w-11 flex-col items-center justify-center gap-2 rounded-[var(--radius)] p-1"
              >
                {/* Segmented indicator: the mark widens and takes the signal
                    colour at the current level. Shape carries the state as
                    well as colour, so it survives greyscale and forced
                    colors. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "block h-px transition-[width,background-color] duration-300",
                    current
                      ? "w-6 bg-[var(--accent)]"
                      : "w-3 bg-[var(--hair-strong)] group-hover:w-5 group-hover:bg-[var(--fg-mid)]",
                  )}
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "t-mono tnum text-[0.625rem] transition-colors",
                    current
                      ? "text-[var(--accent)]"
                      : "text-[var(--fg-low)] group-hover:text-[var(--fg-mid)]",
                  )}
                >
                  {index}
                </span>
                {/* The accessible name is the plain one, and it says where the
                    link actually goes. */}
                <span className="sr-only">
                  Level {index}, {LEVEL_NAME[level]} — {target.conventional}
                  {current ? " (current level)" : ""}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      <span
        aria-hidden="true"
        className="t-mono tnum text-[0.625rem] text-[var(--accent)]"
      >
        {context.index}
      </span>
    </nav>
  );
}
