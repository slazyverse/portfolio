import { Section } from "@/components/layout/Section";
import { SectionLabel } from "@/components/primitives/SectionLabel";
import { STRATA } from "@/data/site";
import { Reveal } from "@/components/effects/Reveal";
import { TextReveal } from "@/components/effects/TextReveal";

export function Position() {
  return (
    <Section id="position" stratum="surface">
      <Reveal from="none">
        <SectionLabel>Position</SectionLabel>
      </Reveal>

      <TextReveal
        as="h2"
        id="position-heading"
        className="t-h2 mb-6"
        lines={["I work on the parts", "other work depends on"]}
      />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <Reveal index={1} className="flex flex-col gap-5">
          <p className="t-lead text-[var(--fg)]">
            Two projects, and in both of them the same job: build the substrate,
            then make it observable.
          </p>
          <p className="t-body">
            In <strong className="font-semibold text-[var(--fg-hi)]">deadlockd</strong>{" "}
            that meant a Go engine where the safety check copies system state
            under mutex and releases the lock before running its search, and
            where cycle detection uses an explicit-stack DFS instead of
            recursion. Correctness is the product; the visualiser exists so the
            correctness can be watched.
          </p>
          <p className="t-body">
            In{" "}
            <strong className="font-semibold text-[var(--fg-hi)]">
              VAYU-DRISHTI
            </strong>
            , a four-person satellite air-quality platform, it meant owning the
            layer everyone else built on — an application factory, async
            SQLAlchemy over asyncpg, Alembic migrations enabling PostGIS,
            structlog request tracing, a container environment, and the dashboard
            that turned the team&rsquo;s models into something a person could read.
          </p>
          <p className="t-body">
            The habit connecting them is writing the reasoning down. Complexity
            bounds live in function headers. Dependencies carry a line explaining
            why they exist and why the alternative was rejected. The config layer
            refuses to start the server in a dangerous state rather than trusting
            that nobody will ask it to.
          </p>
        </Reveal>

        {/* The four strata, which are also this page's structure. */}
        <Reveal index={2} className="self-start border border-[var(--hair)]">
          {STRATA.map((stratum, i) => (
            <div
              key={stratum.id}
              className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 border-b border-[var(--hair)] p-5 transition-colors duration-300 last:border-b-0 hover:bg-[var(--raised)]"
              style={{
                background: `color-mix(in srgb, var(--fg-hi) ${(3 - i) * 0.7}%, transparent)`,
              }}
            >
              <span className="t-label text-[var(--accent)]">
                {stratum.index}
              </span>
              <span className="t-cond text-[0.9375rem] text-[var(--fg-hi)]">
                {stratum.name}
              </span>
              <span className="t-small col-start-2 text-[var(--fg-mid)]">
                {stratum.description}
              </span>
            </div>
          ))}
        </Reveal>
      </div>
    </Section>
  );
}
