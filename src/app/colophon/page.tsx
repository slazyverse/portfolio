import type { Metadata } from "next";
import { PageSection, PageShell } from "@/components/layout/PageShell";
import { Panel, PanelBody, ReadoutRow } from "@/components/system";
import { routeMetadata } from "@/lib/metadata";

export const metadata: Metadata = routeMetadata("colophon");

/**
 * How this site is built.
 *
 * The site is the third exhibit. It is the most technically involved thing in
 * the portfolio, and unlike the other two it can be inspected while it is
 * being used — which makes "you can check how I built the thing you are
 * currently reading" a stronger claim than any assertion about front-end
 * skill.
 *
 * The figures here are real and were measured at the Phase 3 build. They are
 * deliberately not presented as live telemetry: a number that claims to be
 * measured must actually be measured at the moment it is shown, and the
 * runtime instrumentation for that is later work. Stating them as build-time
 * figures is the honest version of the claim available today.
 */

const REJECTED = [
  {
    what: "Framer Motion",
    cost: "44 KB gz",
    why: "The site asks for a fade, a translate and a stagger. That is thirty lines of IntersectionObserver and a CSS transition.",
  },
  {
    what: "GSAP + ScrollTrigger",
    cost: "27 KB gz",
    why: "Its pin injects a spacer and rewrites layout. `position: sticky` pins natively; what remains is arithmetic on a bounding rect.",
  },
  {
    what: "anime.js",
    cost: "21.5 KB gz",
    why: "Carried for one two-element stagger. Removed in Phase 2; the native Web Animations API does the same work for nothing.",
  },
  {
    what: "Smooth-scroll libraries",
    cost: "5.3 KB gz",
    why: "Decoupling scroll from the OS scroller reads as lag on a low-power machine at any easing.",
  },
  {
    what: "Post-processing (bloom, chromatic aberration)",
    cost: "~50 KB gz, and fill-rate bound",
    why: "The performance shape was set on a 2015 dual-core with integrated graphics. Full-screen bloom would undo that, and cost battery on mobile.",
  },
  {
    what: "A component, icon or state-management library",
    cost: "varies",
    why: "Nothing in this site needs one. Every dependency is a maintenance cost that outlives the reason it was added.",
  },
];

export default function ColophonPage() {
  return (
    <PageShell
      routeId="colophon"
      lead="This site is the third exhibit. Here is how it is engineered, what it costs, and what was deliberately left out."
    >
      <PageSection title="Measured" index="01" lead="Figures from the Phase 3 production build.">
        <Panel>
          <PanelBody>
            <dl className="flex flex-col gap-0">
              <ReadoutRow label="initial js" value="189.4" note="KB gz" />
              <ReadoutRow label="budget" value="200" note="KB gz" tone="system" />
              <ReadoutRow label="webgl chunk" value="268.9" note="KB gz, lazy" />
              <ReadoutRow label="css" value="9.3" note="KB gz" />
              <ReadoutRow label="fonts preloaded" value="127.5" note="KB, 2 files" />
              <ReadoutRow label="contrast floor" value="4.66" note=":1" tone="signal" />
              <ReadoutRow label="runtime dependencies" value="6" />
            </dl>
          </PanelBody>
        </Panel>
      </PageSection>

      <PageSection title="Architecture" index="02">
        <div className="flex max-w-[70ch] flex-col gap-5">
          <p className="t-body">
            Next.js App Router with TypeScript in strict mode, plus
            <code className="t-mono px-1">noUncheckedIndexedAccess</code>. All
            content lives in typed records under{" "}
            <code className="t-mono px-1">src/data</code>, and the route table
            is a single source of truth that drives navigation, titles,
            metadata and route announcements alike.
          </p>
          <p className="t-body">
            Styling is a four-tier token system: raw values, semantic aliases,
            per-level overrides, then component recipes. A component never names
            a raw value. That boundary is load-bearing — the one time it was
            crossed, light-mode text ended up rendering at 1.07:1 against its
            own background.
          </p>
          <p className="t-body">
            Roughly 85% of motion is CSS. The WebGL scene is lazy and
            demand-driven, so it is never in the initial bundle and the
            renderer is idle unless something asks it for a frame.
          </p>
        </div>
      </PageSection>

      <PageSection
        title="Rejected"
        index="03"
        lead="The more useful half of a dependency list is the part that is not in it."
      >
        <ul className="flex flex-col gap-px border border-[var(--hair)] bg-[var(--hair)]">
          {REJECTED.map((item) => (
            <li key={item.what} className="bg-[var(--panel)] p-5 md:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <h3 className="t-h3 text-[var(--fg-hi)]">{item.what}</h3>
                <p className="t-mono text-[var(--cold)]">{item.cost}</p>
              </div>
              <p className="t-small mt-3 max-w-[70ch] text-[var(--fg-mid)]">
                {item.why}
              </p>
            </li>
          ))}
        </ul>
      </PageSection>

      <PageSection title="Verified automatically" index="04">
        <div className="flex max-w-[70ch] flex-col gap-5">
          <p className="t-body text-[var(--fg-mid)]">
            Continuous integration fails the build on any of: a type error, a
            lint error, a failing unit or content-integrity test, a bundle over
            budget, an accessibility violation at desktop or mobile width, or a
            dependency advisory at high severity.
          </p>
          <p className="t-body text-[var(--fg-mid)]">
            Two of those are unusual and both exist for the same reason. The
            contrast suite parses the stylesheet and checks every ink against
            every surface, so a token cannot be added unverified. The evidence
            suite fetches every cited source and compares quoted code against
            the real file line by line — on a site whose premise is that claims
            are checkable, a dead source link is a correctness bug rather than
            a content nit.
          </p>
        </div>
      </PageSection>

      <PageSection title="Accessibility" index="05">
        <p className="t-body max-w-[70ch] text-[var(--fg-mid)]">
          Motion is a setting rather than a gate: the operating-system
          preference is the default and is always honoured, but a visitor can
          override it in either direction, because plenty of machines report a
          reduced-motion preference for performance reasons rather than
          vestibular ones. Under reduced motion the site renders its resting
          state — nothing hidden behind a transition that will not run.
          De-emphasis is always a colour token and never an opacity, because
          the lowest ink on this palette needs 93% alpha to stay above 4.5:1,
          which makes any perceptible fade an accessibility failure.
        </p>
      </PageSection>
    </PageShell>
  );
}
