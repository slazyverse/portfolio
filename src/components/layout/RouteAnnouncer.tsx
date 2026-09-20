"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/data/routes";

/**
 * Route-change focus management and announcement.
 *
 * Client-side navigation does not reload the document, so without this a
 * screen-reader user hears nothing when the route changes and a keyboard user
 * is left with focus wherever the old page put it — usually on a link that no
 * longer exists. Neither is recoverable by the visitor.
 *
 * Two things happen on every route change after the first:
 *
 *  1. focus moves to the main content region, so the next Tab continues from
 *     the top of the new page rather than from a stale position
 *  2. the new route is announced by its *conventional* name — "projects", not
 *     "CONTRACTS" — because the in-world vocabulary is atmosphere and should
 *     never be the only way to know where you are
 *
 * The first render is deliberately skipped. On initial load the document title
 * already announces the page; announcing it again is noise.
 */
export function RouteAnnouncer() {
  const pathname = usePathname();
  const announcerRef = useRef<HTMLParagraphElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const main = document.getElementById("main");
    if (main) {
      // -1 rather than 0: the region should be programmatically focusable but
      // must not become a tab stop of its own.
      if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
      main.focus({ preventScroll: true });
    }

    const announcer = announcerRef.current;
    if (!announcer) return;

    const match =
      ROUTES.find((r) => r.path === pathname) ??
      (pathname.startsWith("/contracts/")
        ? ROUTES.find((r) => r.id === "contract")
        : undefined);

    const name = match ? match.conventional : pathname;
    announcer.textContent = `Navigated to ${name}`;
  }, [pathname]);

  return (
    <p
      ref={announcerRef}
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    />
  );
}
