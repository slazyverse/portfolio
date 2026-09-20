import type { RouteId, StratumId } from "@/data/types";
import { levelIndex, route } from "@/data/routes";
import { cn } from "@/lib/cn";

interface Props {
  routeId: RouteId;
  /** Overrides the route's display name, for a single contract. */
  display?: string;
  /** Overrides the route's conventional name. */
  conventional?: string;
  /**
   * Overrides the route's level.
   *
   * Contracts genuinely sit at different depths — deadlockd is substrate work
   * while the other two are engine work — so a contract page takes its level
   * from the contract record. Without this the page header and the system
   * chrome disagree about where the reader is, which is worse than either
   * being wrong alone.
   */
  level?: StratumId;
  /** The page's one-line standfirst. */
  lead?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * The frame every route page sits in.
 *
 * Three things are enforced here rather than left to each page, because they
 * are the things that quietly rot when they are:
 *
 *  1. `data-level` — the Phase 2 token scope. Placing a page at a level gives
 *     it that level's ground, rhythm and hairline weight without the page
 *     knowing anything about them, and it is the same attribute a generated
 *     environment will later key its geography off.
 *
 *  2. Dual register. The in-world name is large and the conventional name sits
 *     beside it in mono. Both are always present, because making someone
 *     decode the theme to find the projects would be a cost paid by exactly
 *     the reader this site is for.
 *
 *  3. One `h1` per page, carrying the conventional name in its accessible
 *     text, so the heading a screen reader announces is the plain one.
 */
export function PageShell({
  routeId,
  display,
  conventional,
  level,
  lead,
  children,
  className,
}: Props) {
  const meta = route(routeId);
  const shownDisplay = display ?? meta.display;
  const shownConventional = conventional ?? meta.conventional;
  const shownLevel = level ?? meta.level;
  const index = levelIndex(shownLevel);

  return (
    <main
      id="main"
      data-level={shownLevel}
      // No max-width or gutter here: the root layout already provides both,
      // and applying them twice doubles the padding at every breakpoint.
      className={cn("pb-24", className)}
    >
      <header className="border-b border-[var(--hair-faint)] py-12 md:py-16">
        <p className="system-label">
          <span className="system-label-index">{index}</span>
          <span>{shownLevel}</span>
          <span aria-hidden="true" className="system-label-rule" />
        </p>

        <h1 className="t-h1 mt-6 flex flex-wrap items-baseline gap-x-5 gap-y-2">
          <span className="t-cond">{shownDisplay}</span>
          {/* The plain name. Visually secondary, but it is the one that makes
              the page findable and is never hidden from assistive tech. */}
          <span className="t-mono text-[0.9375rem] tracking-normal text-[var(--fg-low)] normal-case">
            {shownConventional}
          </span>
        </h1>

        {lead && (
          <p className="t-lead mt-6 text-[var(--fg-mid)]">{lead}</p>
        )}
      </header>

      {children}
    </main>
  );
}

/** A titled region within a page. Keeps heading levels honest. */
export function PageSection({
  title,
  index,
  lead,
  children,
  className,
}: {
  title: string;
  index?: string;
  lead?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return (
    <section aria-labelledby={`${id}-heading`} className={cn("py-12", className)}>
      <p className="system-label">
        {index && <span className="system-label-index">{index}</span>}
        <span>{title}</span>
        <span aria-hidden="true" className="system-label-rule" />
      </p>
      <h2 id={`${id}-heading`} className="sr-only">
        {title}
      </h2>
      {lead && <p className="t-lead mt-4 mb-8 text-[var(--fg-mid)]">{lead}</p>}
      <div className={lead ? "" : "mt-8"}>{children}</div>
    </section>
  );
}
