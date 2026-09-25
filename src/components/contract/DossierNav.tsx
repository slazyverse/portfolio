import Link from "next/link";
import { Panel } from "@/components/system";
import type { DossierSection, Neighbour } from "@/lib/contract";

/* ---------------------------------------------------------------------------
 * Moving through a dossier.
 *
 * Two pieces of navigation, both plain anchors and both in the server-rendered
 * HTML. Nothing here is a scroll-spy or a sticky overlay: a reader on a phone
 * should not be paying for a second floating element, and a fragment link is
 * already the browser's own mechanism for this — it works with the back
 * button, it can be copied, and it survives having JavaScript switched off.
 *
 * The section list is not a table of contents for its own sake. It is the
 * answer to "how long is this and what is in it", which is the question
 * someone asks before deciding to read.
 * ------------------------------------------------------------------------- */

export function SectionIndex({ sections }: { sections: readonly DossierSection[] }) {
  return (
    <nav aria-label="Sections of this dossier" className="mt-10">
      <ul className="flex flex-wrap gap-x-px gap-y-px border border-[var(--hair)] bg-[var(--hair)]">
        {sections.map((section) => (
          <li key={section.anchor} className="grow bg-[var(--panel)]">
            <a
              href={`#${section.anchor}`}
              className="group flex h-full items-baseline gap-2 px-4 py-3 transition-colors hover:bg-[var(--raised)]"
            >
              <span aria-hidden="true" className="t-mono text-[0.625rem] text-[var(--accent)]">
                {section.index}
              </span>
              <span className="t-small whitespace-nowrap text-[var(--fg-mid)] transition-colors group-hover:text-[var(--fg-hi)]">
                {section.title}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Where to go after the last section.
 *
 * Three destinations, in the order they are actually wanted: the evidence for
 * what was just read, the next project, and the index. The previous project is
 * there too because a reader who arrived from a deep link has no history to go
 * back through.
 */
export function ContractFooterNav({
  previous,
  next,
  position,
  total,
  verifyHref,
  projectName,
}: {
  previous?: Neighbour;
  next?: Neighbour;
  position: number;
  total: number;
  verifyHref: string;
  projectName: string;
}) {
  return (
    <nav aria-label="More projects" className="border-t border-[var(--hair)] pt-12">
      <Panel surface="deep" bracket="cold" className="mb-10">
        <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div>
            <p className="t-label text-[var(--cold)]">Check this project</p>
            <p className="t-small mt-2 max-w-[56ch] text-[var(--fg-mid)]">
              Every sourced statement on this page, and the file behind each
              one, listed together in the evidence index.
            </p>
          </div>
          <Link href={verifyHref} className="btn shrink-0">
            Evidence for {projectName}
          </Link>
        </div>
      </Panel>

      <p className="t-mono mb-5 text-[0.6875rem] text-[var(--fg-low)]">
        {String(position).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </p>

      <ul className="grid grid-cols-1 gap-px border border-[var(--hair)] bg-[var(--hair)] md:grid-cols-2">
        <li className="bg-[var(--panel)]">
          {previous ? (
            <Link
              href={previous.path}
              className="group flex h-full flex-col gap-2 p-6 transition-colors hover:bg-[var(--raised)]"
            >
              <span className="t-label text-[var(--fg-low)]">
                <span aria-hidden="true">←&nbsp;</span>Previous
              </span>
              <span className="t-cond text-[1.0625rem] tracking-[0.02em] text-[var(--fg-hi)] transition-colors group-hover:text-[var(--accent)]">
                {previous.name}
              </span>
              <span className="t-mono text-[0.6875rem] text-[var(--fg-low)]">
                {previous.designation}
              </span>
            </Link>
          ) : (
            // Rendered as a stated boundary rather than omitted: an empty cell
            // where a link was expected reads as a bug.
            <p className="flex h-full flex-col justify-center p-6">
              <span className="t-label text-[var(--fg-low)]">Previous</span>
              <span className="t-small mt-2 text-[var(--fg-low)]">
                This is the first contract.
              </span>
            </p>
          )}
        </li>

        <li className="bg-[var(--panel)]">
          {next ? (
            <Link
              href={next.path}
              className="group flex h-full flex-col items-end gap-2 p-6 text-right transition-colors hover:bg-[var(--raised)]"
            >
              <span className="t-label text-[var(--fg-low)]">
                Next<span aria-hidden="true">&nbsp;→</span>
              </span>
              <span className="t-cond text-[1.0625rem] tracking-[0.02em] text-[var(--fg-hi)] transition-colors group-hover:text-[var(--accent)]">
                {next.name}
              </span>
              <span className="t-mono text-[0.6875rem] text-[var(--fg-low)]">
                {next.designation}
              </span>
            </Link>
          ) : (
            <p className="flex h-full flex-col items-end justify-center p-6 text-right">
              <span className="t-label text-[var(--fg-low)]">Next</span>
              <span className="t-small mt-2 text-[var(--fg-low)]">
                This is the last contract.
              </span>
            </p>
          )}
        </li>
      </ul>

      <p className="mt-6">
        <Link
          href="/contracts"
          className="t-small text-[var(--fg-low)] underline underline-offset-4 transition-colors hover:text-[var(--accent)]"
        >
          All contracts
        </Link>
      </p>
    </nav>
  );
}
