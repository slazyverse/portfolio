import { Signal } from "@/components/sections/Signal";
import { Position } from "@/components/sections/Position";
import { Descent } from "@/components/sections/Descent";
import { CaseStudy } from "@/components/sections/CaseStudy";
import { HowItsBuilt } from "@/components/sections/HowItsBuilt";
import { Stack } from "@/components/sections/Stack";
import { Record } from "@/components/sections/Record";
import { Contact } from "@/components/sections/Contact";
import { CodeExcerpt } from "@/components/primitives/CodeExcerpt";
import { LockWindow } from "@/components/visuals/LockWindow";
import { AttributionCrossSection } from "@/components/visuals/AttributionCrossSection";
import { SafetySearch } from "@/components/visuals/SafetySearch";
import { RequestTrace } from "@/components/visuals/RequestTrace";
import { DEADLOCKD, VAYU } from "@/data/projects";
import { STRATA } from "@/data/site";
import { Reveal } from "@/components/effects/Reveal";

/**
 * The landing.
 *
 * `Signal` is the signature frame: the city establishing scale behind it, the
 * subject in front of it, and the five destinations underneath. Everything
 * below it is the argument — the descent, the case studies, the record — in
 * the same order it was in before, because the opening changed what the top of
 * this page is, not what the page is for.
 *
 * The heading is the person now rather than the positioning statement. The
 * statement did not go anywhere; it reads as the lead, which is where a
 * positioning line belongs once the subject has been named.
 */
export default function Home() {
  return (
    <main id="main">
      <Signal />
      <Position />
      <Descent />

      <CaseStudy
        project={DEADLOCKD}
        index="01"
        stratum="interface"
        sequenceLabel="The safety search"
        sequenceCaption="Banker's Algorithm executing at your pace. Scroll to step it forward; scroll back to step it back."
        sequence={<SafetySearch />}
      >
        <div className="flex flex-col gap-6">
          {DEADLOCKD.excerpt && <CodeExcerpt excerpt={DEADLOCKD.excerpt} />}
          <Reveal from="panel" index={1}>
            <LockWindow />
          </Reveal>
        </div>
      </CaseStudy>

      <CaseStudy
        project={VAYU}
        index="02"
        stratum="engine"
        marker={STRATA[2]}
        sequenceLabel="One request, descending"
        sequenceCaption="A single request ID threading through every layer — which is what makes an incident traceable rather than guesswork."
        sequence={<RequestTrace />}
      >
        <Reveal from="panel">
          <AttributionCrossSection />
        </Reveal>
      </CaseStudy>

      <HowItsBuilt />
      <Stack />
      <Record />
      <Contact />
    </main>
  );
}
