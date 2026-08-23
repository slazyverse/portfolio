import { SITE } from "@/data/site";
import { AllocationGraph } from "@/components/visuals/AllocationGraph";
import { TextReveal } from "@/components/effects/TextReveal";
import { Reveal } from "@/components/effects/Reveal";

export function Entry() {
  return (
    <section
      id="entry"
      aria-labelledby="entry-heading"
      className="flex min-h-[88vh] flex-col justify-center py-24 md:py-32"
    >
      <Reveal from="none">
        <p className="t-label mb-8 flex flex-wrap items-center gap-x-3 gap-y-1 text-[var(--fg-low)]">
          <span>{SITE.role}</span>
          <span
            aria-hidden="true"
            className="hidden h-px w-16 bg-[var(--hair-faint)] sm:block"
          />
          <span>{SITE.location}</span>
        </p>
      </Reveal>

      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          {/* Authored as three lines so each can be uncovered in turn, while
              the heading itself stays one readable string. */}
          <TextReveal
            as="h1"
            id="entry-heading"
            className="t-display"
            delay={120}
            lines={[
              "Builds the",
              "layer",
              <span key="u" className="text-[var(--accent)]">
                underneath
              </span>,
            ]}
          />

          <Reveal index={4}>
            <p className="t-lead mt-6 text-[var(--fg)]">
              Software is strata. Users touch the top. Almost nobody sees the
              scheduler, the lock, the migration, the trace. Those are the ones I
              build.
            </p>
          </Reveal>

          <Reveal index={5}>
            <div className="mt-10 flex flex-wrap gap-3">
              <a
                href="#deadlockd"
                className="t-label inline-block rounded-[2px] border border-[var(--accent)] bg-[var(--accent-wash)] px-4 py-2.5 text-[var(--accent)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_20%,transparent)]"
              >
                Descend ↓
              </a>
              <a
                href={SITE.github}
                target="_blank"
                rel="noopener noreferrer"
                className="t-label inline-block rounded-[2px] border border-[var(--hair)] px-4 py-2.5 text-[var(--fg-mid)] transition-colors hover:border-[var(--fg-mid)] hover:text-[var(--fg-hi)]"
              >
                {SITE.githubHandle} ↗
              </a>
            </div>
          </Reveal>
        </div>

        <Reveal index={2}>
          <AllocationGraph />
        </Reveal>
      </div>
    </section>
  );
}
