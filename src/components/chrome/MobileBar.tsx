"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LEVEL_NAME, LEVEL_ORDER, NAV_ROUTES, levelIndex, routeForLevel } from "@/data/routes";
import { cn } from "@/lib/cn";
import type { RouteContext } from "./useRouteContext";

interface Props {
  context: RouteContext;
}

/**
 * The mobile system bar. A bottom bar plus a drawer.
 *
 * Not a shrunken rail. On a phone the reachable area is the bottom of the
 * screen, targets have to survive a thumb rather than a cursor, and there is
 * no hover state to hide anything behind — so the levels sit along the bottom
 * at full tap size and everything else lives in a drawer.
 *
 * The drawer is a native `<dialog>` opened with `showModal()`, which is a
 * deliberate choice over a hand-built overlay: it gives a focus trap, Escape
 * to dismiss, an inert background and focus return to the trigger, all
 * correctly, with no library and no custom key handling to get wrong.
 */
export function MobileBar({ context }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  // Close the drawer when the route changes, so a tap that navigates does not
  // leave the visitor looking at a menu over their destination.
  useEffect(() => {
    dialogRef.current?.close();
  }, [context.pathname]);

  const show = () => {
    dialogRef.current?.showModal();
    setOpen(true);
  };

  return (
    <>
      <nav
        aria-label="Levels and menu"
        className="fixed inset-x-0 bottom-0 z-[var(--z-chrome)] border-t border-[var(--hair)] bg-[var(--ground)] md:hidden"
      >
        <ul className="mx-auto flex max-w-[1180px] items-stretch">
          {LEVEL_ORDER.map((level) => {
            const target = routeForLevel(level);
            const current = context.level === level;
            const index = levelIndex(level);

            return (
              <li key={level} className="flex-1">
                <Link
                  href={target.path}
                  aria-current={current ? "true" : undefined}
                  // 48px minimum: this is a thumb target, not a cursor target.
                  className={cn(
                    "flex min-h-12 flex-col items-center justify-center gap-1 py-2 transition-colors",
                    current ? "text-[var(--accent)]" : "text-[var(--fg-low)]",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "block h-px w-5",
                      current ? "bg-[var(--accent)]" : "bg-[var(--hair-strong)]",
                    )}
                  />
                  <span aria-hidden="true" className="t-mono tnum text-[0.625rem]">
                    {index}
                  </span>
                  <span className="sr-only">
                    Level {index}, {LEVEL_NAME[level]} — {target.conventional}
                    {current ? " (current level)" : ""}
                  </span>
                </Link>
              </li>
            );
          })}

          <li className="flex-1">
            <button
              type="button"
              onClick={show}
              aria-haspopup="dialog"
              aria-expanded={open}
              className="t-label flex min-h-12 w-full flex-col items-center justify-center gap-1 py-2 text-[var(--fg-mid)]"
            >
              <span aria-hidden="true" className="flex flex-col gap-[3px]">
                <span className="block h-px w-4 bg-current" />
                <span className="block h-px w-4 bg-current" />
                <span className="block h-px w-4 bg-current" />
              </span>
              <span className="text-[0.625rem]">Menu</span>
            </button>
          </li>
        </ul>
      </nav>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        aria-label="Site navigation"
        className="m-0 ml-auto h-full max-h-none w-[min(22rem,85vw)] max-w-none border-l border-[var(--hair)] bg-[var(--panel)] p-0 text-[var(--fg)] backdrop:bg-[rgba(5,7,10,0.72)]"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-[var(--hair)] px-5 py-4">
            <p className="t-label text-[var(--fg-low)]">Navigation</p>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="t-label min-h-11 rounded-[var(--radius)] border border-[var(--hair)] px-3 text-[var(--fg-mid)]"
            >
              Close
            </button>
          </div>

          <ul className="flex-1 overflow-y-auto">
            {NAV_ROUTES.map((r) => {
              const current =
                r.path === "/"
                  ? context.pathname === "/"
                  : context.pathname === r.path ||
                    context.pathname.startsWith(`${r.path}/`);
              return (
                <li key={r.id}>
                  <Link
                    href={r.path}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "flex min-h-14 flex-col justify-center gap-0.5 border-b border-[var(--hair-faint)] px-5 py-3 transition-colors",
                      current ? "bg-[var(--accent-wash)]" : "",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "t-cond text-[0.9375rem]",
                        current ? "text-[var(--accent)]" : "text-[var(--fg-hi)]",
                      )}
                    >
                      {r.display}
                    </span>
                    {/* Dual register, and on mobile both are visible — there is
                        no hover to reveal the plain name behind. */}
                    <span className="t-mono text-[0.6875rem] text-[var(--fg-low)]">
                      {r.conventional}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </dialog>
    </>
  );
}
