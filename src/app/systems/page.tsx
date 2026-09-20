import type { Metadata } from "next";
import { PageSection, PageShell } from "@/components/layout/PageShell";
import { STACK } from "@/data/principles";
import { routeMetadata } from "@/lib/metadata";
import { cn } from "@/lib/cn";

export const metadata: Metadata = routeMetadata("systems");

/**
 * Capabilities, split by whether they have shipped.
 *
 * The split is the feature. A stack list containing things the author cannot
 * point at devalues every entry beside it, so anything not backed by a
 * repository stays in the second tier and says so.
 */
export default function SystemsPage() {
  return (
    <PageShell
      routeId="systems"
      lead="Everything in the first tier points at a repository. Everything in the second is honest about being study rather than delivery."
    >
      <div className="grid grid-cols-1 gap-10 py-12 lg:grid-cols-2 lg:gap-16">
        {STACK.map((group, i) => (
          <section key={group.tier} aria-labelledby={`${group.tier}-heading`}>
            <p className="system-label">
              <span className="system-label-index">{`0${i + 1}`}</span>
              <span>{group.tier === "shipped" ? "Shipped" : "Working knowledge"}</span>
              <span aria-hidden="true" className="system-label-rule" />
            </p>

            <h2
              id={`${group.tier}-heading`}
              className={cn(
                "t-cond mt-5 text-[1.0625rem]",
                group.tier === "shipped"
                  ? "text-[var(--accent)]"
                  : "text-[var(--fg-mid)]",
              )}
            >
              {group.heading}
            </h2>
            <p className="t-small mt-3 mb-6 text-[var(--fg-low)]">{group.note}</p>

            <dl className="border-t border-[var(--hair)]">
              {group.items.map((item) => (
                <div
                  key={item.name}
                  className="grid grid-cols-1 gap-x-6 gap-y-1 border-b border-[var(--hair-faint)] py-3 sm:grid-cols-[minmax(0,150px)_minmax(0,1fr)]"
                >
                  <dt
                    className={cn(
                      "t-mono",
                      group.tier === "shipped"
                        ? "text-[var(--fg-hi)]"
                        : "text-[var(--fg-mid)]",
                    )}
                  >
                    {item.name}
                  </dt>
                  <dd className="t-small text-[var(--fg-mid)]">{item.where}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <PageSection title="Note" index="03">
        <p className="t-body text-[var(--fg-mid)]">
          This page deliberately carries no proficiency bars, percentages or
          star ratings. A number claiming 85% competence in a language is not
          measurable, not falsifiable, and not something anyone should be asked
          to take on trust. Where something has shipped, the project it shipped
          in is named; that is the claim, and it is checkable.
        </p>
      </PageSection>
    </PageShell>
  );
}
