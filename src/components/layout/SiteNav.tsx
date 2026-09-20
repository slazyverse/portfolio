import Link from "next/link";
import { SITE } from "@/data/site";
import { MotionToggle } from "./MotionToggle";
import { PrimaryNav } from "./PrimaryNav";

/**
 * The persistent header.
 *
 * Phase 3 gives it real route navigation, because there are now real routes.
 * This is deliberately still plain: SystemChrome — the persistent status bar,
 * level rail and command palette — is Phase 4 work, and building a throwaway
 * version of it here would mean designing the same thing twice.
 */
export function SiteNav() {
  return (
    <header className="sticky top-0 z-[var(--z-chrome)] border-b border-[var(--hair-faint)] bg-[var(--ground)]">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3 md:px-12">
        <Link
          href="/"
          className="t-label -my-1 inline-block py-2 text-[var(--fg-hi)] transition-colors hover:text-[var(--accent)]"
        >
          {SITE.name}
        </Link>

        <PrimaryNav />

        <div className="flex items-center gap-3">
          <a
            href={SITE.github}
            target="_blank"
            rel="noopener noreferrer"
            className="t-label rounded-[var(--radius)] border border-[var(--hair)] px-3 py-1.5 text-[var(--fg-mid)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            GitHub
          </a>
          <MotionToggle />
        </div>
      </div>
    </header>
  );
}
