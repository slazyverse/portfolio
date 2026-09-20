"use client";

import Link from "next/link";
import { SITE } from "@/data/site";
import { MotionToggle } from "@/components/layout/MotionToggle";
import type { RouteContext } from "./useRouteContext";

interface Props {
  context: RouteContext;
  onOpenPalette: () => void;
}

/**
 * The persistent status bar.
 *
 * Compact on purpose. The chrome frames the site; it does not become the site,
 * and a recruiter should still see page content immediately. That constraint —
 * not decoration — is what sets the height here.
 *
 * Every value shown is real: the identity, the current level, and where the
 * visitor is. There is deliberately no fabricated telemetry — no invented CPU
 * or network readouts — because a number that looks like data and is not one
 * would undermine the single thing this site is built on. Measured
 * diagnostics come later, from a real source.
 */
export function StatusBar({ context, onOpenPalette }: Props) {
  return (
    <header className="sticky top-0 z-[var(--z-chrome)] border-b border-[var(--hair)] bg-[var(--ground)]">
      <div className="mx-auto flex max-w-[1180px] items-center gap-x-4 gap-y-1 px-5 py-2.5 md:px-12">
        <Link
          href="/"
          // min-h-9 so the target clears WCAG 2.2 SC 2.5.8. The label is small
          // mono type; the thing a pointer has to hit is not.
          className="t-label inline-flex min-h-9 shrink-0 items-center text-[var(--fg-hi)] transition-colors hover:text-[var(--accent)]"
        >
          SUBSTRATE
          <span className="sr-only"> — {SITE.name}, home</span>
        </Link>

        <span aria-hidden="true" className="h-3 w-px shrink-0 bg-[var(--hair-strong)]" />

        {/* Where you are. The conventional name carries the accessible text,
            so a screen reader says "engine, projects" rather than a code. */}
        <p className="t-label flex min-w-0 items-center gap-2 text-[var(--fg-low)]">
          <span className="text-[var(--cold)]">{context.index}</span>
          <span className="hidden sm:inline">{context.levelName}</span>
          {/* Braced, because a bare `//` in JSX children lints as a comment. */}
          <span aria-hidden="true" className="text-[var(--hair-strong)]">
            {"//"}
          </span>
          <span className="truncate text-[var(--fg-mid)]" aria-hidden="true">
            {context.display}
          </span>
          <span className="sr-only">
            Current location: {context.levelName} level, {context.conventional}
          </span>
        </p>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenPalette}
            className="t-label hidden min-h-9 items-center gap-2 rounded-[var(--radius)] border border-[var(--hair)] px-2.5 text-[var(--fg-low)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] md:inline-flex"
          >
            <span aria-hidden="true">Search</span>
            <kbd
              aria-hidden="true"
              className="t-mono rounded-[var(--radius)] border border-[var(--hair)] px-1 text-[0.625rem]"
            >
              Ctrl K
            </kbd>
            <span className="sr-only">Open navigation search. Shortcut: Control or Command, K</span>
          </button>
          <MotionToggle />
        </div>
      </div>
    </header>
  );
}
