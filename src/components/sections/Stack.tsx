import { Section } from "@/components/layout/Section";
import { SectionLabel } from "@/components/primitives/SectionLabel";
import { StratumMarker } from "@/components/layout/StratumMarker";
import { STACK } from "@/data/principles";
import { STRATA } from "@/data/site";
import { cn } from "@/lib/cn";
import { Reveal } from "@/components/effects/Reveal";
import { TextReveal } from "@/components/effects/TextReveal";

/**
 * Two tiers, honestly split. A stack list containing things the owner cannot
 * point at devalues everything beside it, so the split is the feature.
 */
export function Stack() {
  const substrate = STRATA[3]!;

  return (
    <Section id="stack" stratum="substrate">
      <div className="mb-16">
        <StratumMarker stratum={substrate} />
      </div>

      <Reveal from="none">
        <SectionLabel index="04">Stack</SectionLabel>
      </Reveal>

      <TextReveal
        as="h2"
        id="stack-heading"
        className="t-h2 mb-6"
        lines={["Split by whether", "I have shipped it"]}
      />
      <p className="t-lead mb-12 text-[var(--fg)]">
        Everything in the first tier points at a repository. Everything in the
        second is honest about being study rather than delivery.
      </p>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
        {STACK.map((group, gi) => (
          <Reveal key={group.tier} index={gi}>
            <div className="mb-5 flex items-baseline gap-3">
              <h3
                className={cn(
                  "t-cond text-[1.0625rem]",
                  group.tier === "shipped"
                    ? "text-[var(--accent)]"
                    : "text-[var(--fg-mid)]",
                )}
              >
                {group.heading}
              </h3>
            </div>
            <p className="t-small mb-6 text-[var(--fg-low)]">{group.note}</p>

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
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
