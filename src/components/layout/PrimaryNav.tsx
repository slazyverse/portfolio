"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ROUTES } from "@/data/routes";
import { cn } from "@/lib/cn";

/**
 * Primary route navigation.
 *
 * A client component for one reason only: `aria-current`. Knowing which page
 * you are on is not decoration — without it a screen-reader user has no way to
 * locate themselves in the nav, and a sighted keyboard user tabbing through
 * gets no anchor either. That is worth the pathname subscription; nothing else
 * here needs the client.
 *
 * Each item carries both registers. The in-world name is what you see; the
 * conventional name is the accessible name, so the link a screen reader reads
 * out is "projects", not "CONTRACTS".
 */
export function PrimaryNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary">
      <ul className="flex flex-wrap items-center gap-x-1 gap-y-1">
        {NAV_ROUTES.map((r) => {
          const current =
            r.path === "/"
              ? pathname === "/"
              : pathname === r.path || pathname.startsWith(`${r.path}/`);

          return (
            <li key={r.id}>
              <Link
                href={r.path}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "t-label inline-flex min-h-9 items-center rounded-[var(--radius)] px-2.5 py-2 transition-colors",
                  current
                    ? "text-[var(--accent)]"
                    : "text-[var(--fg-low)] hover:text-[var(--fg-hi)]",
                )}
              >
                <span aria-hidden="true">{r.display}</span>
                <span className="sr-only">{r.conventional}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
