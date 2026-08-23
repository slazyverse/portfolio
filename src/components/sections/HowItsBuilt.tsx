import { Section } from "@/components/layout/Section";
import { SectionLabel } from "@/components/primitives/SectionLabel";
import { SourceLink } from "@/components/primitives/SourceLink";
import { Reveal } from "@/components/effects/Reveal";
import { TextReveal } from "@/components/effects/TextReveal";
import { PRINCIPLES } from "@/data/principles";

/**
 * The section that carries the site. Four principles, each with the committed
 * code that earned it — an engineer reading this learns more about how Sagar
 * thinks than any project summary could convey.
 */
export function HowItsBuilt() {
  return (
    <Section id="how-its-built" stratum="engine">
      <Reveal from="none">
        <SectionLabel index="03">How it&rsquo;s built</SectionLabel>
      </Reveal>

      <TextReveal
        as="h2"
        id="how-its-built-heading"
        className="t-h2 mb-6"
        lines={["Four things I actually do"]}
      />

      <Reveal index={1}>
        <p className="t-lead mb-12 text-[var(--fg)]">
          Not values. Habits, each one pointing at the commit where it was
          practised.
        </p>
      </Reveal>

      <ol className="grid grid-cols-1 gap-px border border-[var(--hair)] bg-[var(--hair)] md:grid-cols-2">
        {PRINCIPLES.map((p, i) => (
          <Reveal
            key={p.index}
            as="li"
            index={i}
            className="flex flex-col justify-between gap-6 bg-[var(--panel)] p-6 md:p-8"
          >
            <div>
              <span className="t-label text-[var(--accent)]">{p.index}</span>
              <h3 className="t-h3 mt-3 mb-3">{p.title}</h3>
              <p className="t-small text-[var(--fg-mid)]">{p.body}</p>
            </div>
            <SourceLink source={p.source} />
          </Reveal>
        ))}
      </ol>
    </Section>
  );
}
