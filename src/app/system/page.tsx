import type { Metadata } from "next";
import {
  DataRow,
  Divider,
  Panel,
  PanelBody,
  PanelHead,
  Readout,
  ReadoutRow,
  ScanLine,
  SectionMarker,
  StatusChip,
  SystemLabel,
  VerifyChip,
  Vignette,
} from "@/components/system";
import { QUALITY } from "@/lib/capability";
import { EnvironmentLab } from "@/components/environment/EnvironmentLab";

/**
 * The design-system laboratory.
 *
 * Internal. Not in the navigation, not in the sitemap, and noindex — this is
 * where the system is reviewed before it is spent across the site, not a page
 * anyone is meant to land on.
 *
 * Deliberately a server component: it ships zero client JavaScript. A
 * reference page that cost the bundle anything would be arguing against the
 * system it documents.
 */
export const metadata: Metadata = {
  title: "System reference",
  robots: { index: false, follow: false, nocache: true },
};

const SURFACES = [
  ["--deep", "code panels, the footer, bedrock"],
  ["--ground", "the page"],
  ["--panel", "the default container"],
  ["--raised", "hover states, lifted rows"],
  ["--edge", "the top of the ramp; borders only"],
] as const;

const INKS = [
  ["--fg-hi", "headings, values, the thing being said"],
  ["--fg", "body copy"],
  ["--fg-mid", "secondary copy, de-emphasised rows"],
  ["--fg-low", "metadata, labels, line numbers"],
  ["--accent", "the subject: signal, links, indices"],
  ["--cold", "the system: telemetry about itself"],
  ["--state-safe", "a verified good state"],
  ["--state-unsafe", "a verified bad state"],
  ["--state-waiting", "a pending state"],
] as const;

const LEVELS = [
  ["surface", "00", "What software looks like from outside."],
  ["interface", "01", "The layer where behaviour becomes visible."],
  ["engine", "02", "Where the work is actually done."],
  ["substrate", "03", "Bedrock. Facts, no ornament."],
] as const;

const TYPE = [
  ["t-display", "Builds the layer underneath", "Entry only. One per site."],
  ["t-h1", "Contract 01", "Section and case-study titles."],
  ["t-h2", "One request, all the way down", "Region headings."],
  ["t-h3", "What it does, and where that is proven", "Sub-headings."],
  ["t-lead", "Software is strata. Users touch the top.", "Standfirst, max 60ch."],
  ["t-body", "The habit connecting them is writing the reasoning down.", "Prose, max 68ch."],
  ["t-small", "Hatched layers are the team's work.", "Captions, dense rows."],
  ["t-mono", "backend/engine/banker.go:L15-L30", "MACHINE / VERIFIED / SYSTEM DATA."],
  ["t-label", "Engineering record", "Eyebrows, chips, buttons."],
  ["t-cond", "Substrate", "Signage. Archivo's wdth axis at 78."],
] as const;

function Section({
  index,
  title,
  note,
  children,
}: {
  index: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-[var(--hair-faint)] py-14">
      <SystemLabel index={index}>{title}</SystemLabel>
      {note && (
        <p className="t-small mt-3 mb-8 max-w-[70ch] text-[var(--fg-mid)]">{note}</p>
      )}
      <div className={note ? "" : "mt-8"}>{children}</div>
    </section>
  );
}

export default function SystemReference() {
  return (
    <main id="main" className="pb-24">
      <header className="py-16">
        <SystemLabel index="—">System reference</SystemLabel>
        <h1 className="t-h1 mt-6 mb-5">SUBSTRATE</h1>
        <p className="t-lead text-[var(--fg-mid)]">
          The visual language, in one place, before it is spent across the site.
          Internal: not linked, not indexed, not in the sitemap.
        </p>
        <p className="t-small mt-6 max-w-[70ch] text-[var(--fg-low)]">
          Two rules run through everything below. A component never names a raw
          value — it reads a Tier 2 alias. And de-emphasis is always a colour
          token, never an opacity: measured over <code className="t-mono">--panel</code>,{" "}
          <code className="t-mono">--fg-low</code> needs alpha 0.93 to hold 4.5:1, so any
          fade a reader can perceive puts text below AA.
        </p>
      </header>

      {/* ---------------------------------------------------------------- */}
      <Section
        index="01"
        title="Surfaces"
        note="Tier 2 aliases. The ramp is strictly ordered shallow to deep, which a test asserts — if two surfaces ever collide, a panel becomes indistinguishable from the ground it sits on."
      >
        <div className="grid grid-cols-1 gap-px border border-[var(--hair)] bg-[var(--hair)] sm:grid-cols-2 lg:grid-cols-5">
          {SURFACES.map(([tokenName, use]) => (
            <div key={tokenName} className="bg-[var(--ground)] p-4">
              <div
                className="mb-3 h-16 rounded-[var(--radius)] border border-[var(--hair)]"
                style={{ background: `var(${tokenName})` }}
              />
              <p className="t-mono text-[var(--fg-hi)]">{tokenName}</p>
              <p className="t-small mt-1 text-[var(--fg-low)]">{use}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        index="02"
        title="Ink"
        note="Every ink clears 4.5:1 against every surface AND every level ground — 72 pairings, asserted by a test that parses the stylesheet rather than trusting a written table. The worst pairing in the system is 4.66:1."
      >
        <Panel>
          <PanelBody className="flex flex-col gap-0">
            {INKS.map(([tokenName, use]) => (
              <div
                key={tokenName}
                className="flex flex-wrap items-baseline gap-x-5 gap-y-1 border-b border-[var(--hair-faint)] py-3 last:border-b-0"
              >
                <span
                  className="t-body w-[16ch] shrink-0 font-medium"
                  style={{ color: `var(${tokenName})` }}
                >
                  Aa 0123
                </span>
                <span className="t-mono w-[15ch] shrink-0 text-[var(--fg-hi)]">
                  {tokenName}
                </span>
                <span className="t-small text-[var(--fg-low)]">{use}</span>
              </div>
            ))}
          </PanelBody>
        </Panel>
        <p className="t-small mt-4 max-w-[70ch] text-[var(--fg-low)]">
          Amber is the identity and the only warm value in the system. Cold is
          reserved for telemetry the site reports about itself, so amber always
          means <em>the subject</em> and cold always means <em>the machine</em>.
          The two are 167 degrees apart in hue, which is what makes them
          distinguishable — not their contrast ratio, which is 1.09:1.
        </p>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        index="03"
        title="Levels"
        note="Tier 3. Descending deepens the ground, tightens the vertical rhythm and firms up the hairlines. At the surface the system is suggestive; at the substrate it is exact. The metaphor does layout work rather than being described in copy."
      >
        <div className="grid grid-cols-1 gap-px border border-[var(--hair)] bg-[var(--hair)] sm:grid-cols-2 lg:grid-cols-4">
          {LEVELS.map(([level, index, description]) => (
            <div key={level} data-level={level} className="bg-[var(--level-ground)] p-5">
              <p className="t-label text-[var(--accent)]">{index}</p>
              <p className="t-cond mt-2 text-[0.9375rem] text-[var(--fg-hi)]">{level}</p>
              <p className="t-small mt-2 text-[var(--fg-mid)]">{description}</p>
              <p className="t-mono mt-3 text-[var(--fg-low)]">
                rhythm var(--level-rhythm)
              </p>
            </div>
          ))}
        </div>
        <div className="mt-8">
          <SectionMarker
            index="03"
            name="Substrate"
            description="Bedrock. Facts, no ornament."
          />
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        index="04"
        title="Typography"
        note="Archivo sets prose and signage; JetBrains Mono means MACHINE / VERIFIED / SYSTEM DATA and nothing else. That rule is what stops the interface becoming costume: if a figure is set in mono, a reader is entitled to ask where it came from and get an answer."
      >
        <Panel>
          <PanelBody className="flex flex-col gap-0">
            {TYPE.map(([cls, sample, use]) => (
              <div
                key={cls}
                className="grid grid-cols-1 gap-x-6 gap-y-2 border-b border-[var(--hair-faint)] py-5 last:border-b-0 md:grid-cols-[minmax(0,1fr)_14ch_22ch]"
              >
                <div className={`${cls} min-w-0 truncate text-[var(--fg-hi)]`}>
                  {sample}
                </div>
                <span className="t-mono text-[var(--accent)]">.{cls}</span>
                <span className="t-small text-[var(--fg-low)]">{use}</span>
              </div>
            ))}
          </PanelBody>
        </Panel>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        index="05"
        title="Panels and geometry"
        note="Maximum radius is 2px everywhere, permanently. There are no shadows in this system: depth is a hairline, a surface delta and an optional inner highlight. Brackets are corner marks rather than a second frame — a targeting reticle, not a border."
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Panel>
            <PanelHead>
              <span>Panel</span>
              <StatusChip state="safe" className="border-0 px-0">
                Default
              </StatusChip>
            </PanelHead>
            <PanelBody>
              <p className="t-small text-[var(--fg-mid)]">
                The base container. Hairline border on <code className="t-mono">--panel</code>.
              </p>
            </PanelBody>
          </Panel>

          <Panel bracket lit>
            <PanelHead>
              <span>Panel + bracket + lit</span>
              <StatusChip state="signal" className="border-0 px-0">
                Marked
              </StatusChip>
            </PanelHead>
            <PanelBody>
              <p className="t-small text-[var(--fg-mid)]">
                Corner marks in amber and an inner top highlight, so the surface
                reads as lit rather than as a box.
              </p>
            </PanelBody>
          </Panel>

          <Panel surface="deep" bracket="cold" className="relative overflow-hidden">
            <ScanLine />
            <Vignette />
            <PanelHead>
              <span>Deep + atmosphere</span>
              <StatusChip state="cold" className="border-0 px-0">
                System
              </StatusChip>
            </PanelHead>
            <PanelBody>
              <p className="t-small relative text-[var(--fg-mid)]">
                Scanline and vignette, both capped so they cannot affect the
                contrast of anything beneath them. Removed entirely under
                reduced motion and forced colors.
              </p>
            </PanelBody>
          </Panel>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        index="06"
        title="State"
        note="State is carried by shape as well as colour, so it survives greyscale, colour-blindness, forced colors and print. Colour alone would make the state invisible to roughly one man in twelve."
      >
        <div className="flex flex-wrap gap-3">
          <StatusChip state="safe">Live</StatusChip>
          <StatusChip state="unsafe">Deadlocked</StatusChip>
          <StatusChip state="waiting">Pending</StatusChip>
          <StatusChip state="signal">Source</StatusChip>
          <StatusChip state="cold">Telemetry</StatusChip>
          <StatusChip>Neutral</StatusChip>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        index="07"
        title="Readouts"
        note="A measured value, leader-dotted like an instrument panel. Rendered as a definition list so a screen reader announces the term before the number — Phase 1 shipped the inverse and it announced values with no terms at all."
      >
        <Panel>
          <PanelHead>
            <span>Self-diagnostic</span>
            <Readout tone="system">measured</Readout>
          </PanelHead>
          <PanelBody>
            <dl className="flex flex-col gap-0">
              <ReadoutRow label="initial js" value="189.4" note="KB gz" />
              <ReadoutRow label="budget" value="200" note="KB gz" tone="system" />
              <ReadoutRow label="lazy webgl" value="269.0" note="KB gz" />
              <ReadoutRow label="css" value="9.1" note="KB gz" />
              <ReadoutRow label="routes" value="6" note="static" />
              <ReadoutRow
                label="contrast floor"
                value="4.66"
                note=":1"
                tone="signal"
              />
            </dl>
            <p className="t-small mt-5 text-[var(--fg-low)]">
              These are the real Phase 2 numbers. Nothing in this system may
              display a figure it cannot source — a fabricated readout would
              falsify the one thing the site is built on.
            </p>
          </PanelBody>
        </Panel>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        index="08"
        title="Verify"
        note="The signature interaction. Every claim resolves to the file that proves it, so the affordance is styled as a control rather than a footnote — a reader should be able to tell at a glance that everything here is checkable, and then check one."
      >
        <div className="flex flex-wrap items-center gap-4">
          <VerifyChip
            source={{
              path: "backend/engine/banker.go",
              lines: "L15-L30",
              href: "https://github.com/slazyverse/deadlockd/blob/main/backend/engine/banker.go#L15-L30",
            }}
          />
          <VerifyChip
            source={{
              path: "app/main.py",
              href: "https://github.com/slazyverse/deadlockd/blob/main/backend/engine/detection.go",
            }}
            showPath={false}
          />
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        index="09"
        title="Records"
        note="Rows that are not the subject's own work are hatched rather than faded. Opacity would put their text below AA — which is exactly the bug Phase 1 found, at 1.77:1."
      >
        <Panel>
          <DataRow ownership="other" className="md:grid-cols-[1fr_12ch_10ch]">
            <span className="t-small text-[var(--fg-mid)]">
              ML pipeline — models, feature selection, evaluation
            </span>
            <span className="t-mono text-[var(--fg-low)]">yeshika-02</span>
            <span className="t-mono text-right text-[var(--fg-mid)]">26 commits</span>
          </DataRow>
          <DataRow ownership="mine" className="md:grid-cols-[1fr_12ch_10ch]">
            <span className="t-small text-[var(--fg-hi)]">
              Config · structured logging · async data layer · Docker · tests
            </span>
            <span className="t-mono text-[var(--accent)]">Sagar</span>
            <span className="t-mono text-right text-[var(--fg-mid)]">6,731 lines</span>
          </DataRow>
        </Panel>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        index="10"
        title="Controls"
        note="Every interactive target is at least 24x24px before padding, per WCAG 2.2 SC 2.5.8. Tab through these: the focus ring is a 2px accent outline at 3px offset, and it is never removed."
      >
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn">
            Default
          </button>
          <button type="button" className="btn btn-signal">
            Signal
          </button>
          <button type="button" className="btn btn-solid">
            Primary
          </button>
          <a href="#main" className="btn">
            Link as control
          </a>
        </div>
        <div className="mt-8 flex flex-col gap-4">
          <Divider />
          <Divider tone="faint" />
          <Divider tone="segmented" />
        </div>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        index="11"
        title="System chrome"
        note="The persistent interface layer, mounted in the root layout so it survives navigation without remounting. It frames the site; it does not become the site — a persistent HUD that pushes content down is a HUD that cost the reader the thing they came for."
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Panel>
            <PanelHead>
              <span>StatusBar</span>
              <StatusChip state="cold" className="border-0 px-0">
                Live above
              </StatusChip>
            </PanelHead>
            <PanelBody>
              <p className="t-small text-[var(--fg-mid)]">
                Identity, current level, and where you are. Every value is
                real — there is deliberately no fabricated CPU, memory or
                network readout, because a number that looks like data and is
                not one would undermine the only thing this site is built on.
              </p>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHead>
              <span>LevelRail</span>
              <StatusChip state="signal" className="border-0 px-0">
                Desktop
              </StatusChip>
            </PanelHead>
            <PanelBody>
              <p className="t-small text-[var(--fg-mid)]">
                What DepthRail became. The old rail tracked scroll on one page
                and had nowhere to point; with a real route architecture,
                depth is navigated. Destinations come from the route table, so
                the rail cannot point somewhere stale.
              </p>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHead>
              <span>MobileBar</span>
              <StatusChip state="waiting" className="border-0 px-0">
                Touch
              </StatusChip>
            </PanelHead>
            <PanelBody>
              <p className="t-small text-[var(--fg-mid)]">
                Not a shrunken rail. Levels sit along the bottom at full tap
                size; everything else is a native <code className="t-mono">&lt;dialog&gt;</code>{" "}
                drawer, which gives a focus trap, Escape and focus return
                correctly and for free.
              </p>
            </PanelBody>
          </Panel>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel surface="deep">
            <PanelHead>
              <span>Navigation states</span>
            </PanelHead>
            <PanelBody>
              <ul className="flex flex-col gap-3">
                {[
                  ["Current", "aria-current, signal colour, mark widens to 24px"],
                  ["Hover", "mark widens, ink lifts to --fg-mid (pointer devices only)"],
                  ["Focus", "2px accent outline at 3px offset, never removed"],
                  ["Target size", "44px in the rail, 48px on the mobile bar"],
                ].map(([state, detail]) => (
                  <li key={state} className="flex flex-wrap items-baseline gap-x-4">
                    <span className="t-label w-[10ch] shrink-0 text-[var(--accent)]">
                      {state}
                    </span>
                    <span className="t-small text-[var(--fg-mid)]">{detail}</span>
                  </li>
                ))}
              </ul>
            </PanelBody>
          </Panel>

          <Panel surface="deep">
            <PanelHead>
              <span>Reduced motion</span>
            </PanelHead>
            <PanelBody>
              <p className="t-small text-[var(--fg-mid)]">
                The chrome holds its stable state: no animated rail, no scan,
                no glitch, no decorative transition. Navigation itself is
                untouched — a visitor who asked for less motion asked for less
                motion, not for a interface that stops working.
              </p>
              <p className="t-small mt-4 text-[var(--fg-low)]">
                The command palette is an accelerator, never a gate. Everything
                it reaches is reachable from the visible navigation, and
                nothing depends on knowing the shortcut.
              </p>
            </PanelBody>
          </Panel>
        </div>
      </Section>

      <Section
        index="12"
        title="Quality tiers"
        note="A contract, not a suggestion. Phase 2 defines what each tier may spend; Phase 5 is where the environment layer consumes it. Reduced motion is orthogonal rather than a fourth tier — it removes decorative movement at any tier."
      >
        <Panel>
          <div className="overflow-x-auto" tabIndex={0}>
            <table className="w-full min-w-[520px] border-collapse">
              <caption className="sr-only">
                What each quality tier is permitted to spend.
              </caption>
              <thead>
                <tr>
                  {["Tier", "WebGL", "Max DPR", "Atmosphere", "Glow"].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="t-label border-b border-[var(--hair)] px-5 py-3 text-left font-medium text-[var(--fg-low)]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(Object.keys(QUALITY) as Array<keyof typeof QUALITY>).map((tier) => {
                  const budget = QUALITY[tier];
                  const flag = (on: boolean) => (
                    <span
                      className={
                        on ? "text-[var(--state-safe)]" : "text-[var(--fg-low)]"
                      }
                    >
                      {on ? "yes" : "no"}
                    </span>
                  );
                  return (
                    <tr key={tier}>
                      <th
                        scope="row"
                        className="t-mono border-b border-[var(--hair-faint)] px-5 py-3 text-left font-normal text-[var(--fg-hi)]"
                      >
                        {tier}
                      </th>
                      <td className="t-mono border-b border-[var(--hair-faint)] px-5 py-3">
                        {flag(budget.webgl)}
                      </td>
                      <td className="t-mono tnum border-b border-[var(--hair-faint)] px-5 py-3 text-[var(--fg-mid)]">
                        {budget.maxDpr.toFixed(1)}
                      </td>
                      <td className="t-mono border-b border-[var(--hair-faint)] px-5 py-3">
                        {flag(budget.atmosphere)}
                      </td>
                      <td className="t-mono border-b border-[var(--hair-faint)] px-5 py-3">
                        {flag(budget.glow)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </Section>

      {/* ---------------------------------------------------------------- */}
      <Section
        index="13"
        title="Environment"
        note="The procedural city, inspectable. Every tier, every level, every fallback mode — including the ones this machine cannot reach on its own, and the surface level, whose only route is one the environment stands down on. Numbers below are read off the generated model, never written by hand."
      >
        <EnvironmentLab />
      </Section>
    </main>
  );
}
