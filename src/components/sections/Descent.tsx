import { Section } from "@/components/layout/Section";
import { SectionLabel } from "@/components/primitives/SectionLabel";
import { StratumMarker } from "@/components/layout/StratumMarker";
import { Reveal } from "@/components/effects/Reveal";
import { TextReveal } from "@/components/effects/TextReveal";
import { DescentStory } from "@/components/visuals/DescentStory";
import { STRATA } from "@/data/site";

/**
 * The site's thesis, told rather than asserted: one request, followed from the
 * surface a user touches down to the mutex that makes it correct.
 *
 * This sits immediately after Position, so the reader meets the argument as a
 * sequence before they meet any of the case studies that evidence it.
 */
export function Descent() {
  return (
    <Section id="descent" stratum="interface">
      <div className="mb-16">
        <StratumMarker stratum={STRATA[1]!} />
      </div>

      <Reveal from="none">
        <SectionLabel>The descent</SectionLabel>
      </Reveal>

      <TextReveal
        as="h2"
        id="descent-heading"
        className="t-h2 mb-6"
        lines={["One request,", "all the way down"]}
      />

      <Reveal index={1}>
        <p className="t-lead mb-12 text-[var(--fg)]">
          Keep scrolling. Every layer is a real one, and the last is four lines
          of Go that decide whether the whole thing is correct.
        </p>
      </Reveal>

      <DescentStory />
    </Section>
  );
}
