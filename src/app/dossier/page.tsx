import type { Metadata } from "next";
import { PageSection, PageShell } from "@/components/layout/PageShell";
import { Panel, PanelBody, VerifyChip } from "@/components/system";
import { PRINCIPLES } from "@/data/principles";
import { SITE } from "@/data/site";
import { routeMetadata } from "@/lib/metadata";

export const metadata: Metadata = routeMetadata("dossier");

/**
 * The profile. Who, and — more usefully — how.
 *
 * The principles carry the weight here. Anyone can list values; each of these
 * points at the commit where it was actually practised, which is the only
 * version of the claim worth making.
 */
export default function DossierPage() {
  return (
    <PageShell
      routeId="dossier"
      lead="Backend and systems engineer. The parts other work depends on — schedulers, locks, data layers, traces."
    >
      <PageSection title="Position" index="01">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-16">
          <div className="flex flex-col gap-5">
            <p className="t-lead text-[var(--fg)]">
              Software is strata. Users touch the top. Almost nobody sees the
              scheduler, the lock, the migration, the trace. Those are the ones
              I build.
            </p>
            <p className="t-body">
              Three projects, and in each of them the same job: build the layer
              underneath, then make it observable. In <strong className="font-semibold text-[var(--fg-hi)]">deadlockd</strong> that
              meant a Go engine whose safety check copies system state under
              mutex and releases the lock before searching. In <strong className="font-semibold text-[var(--fg-hi)]">APIx</strong> it
              meant the acquisition boundary, where the system meets external
              market data that cannot be trusted to behave. In <strong className="font-semibold text-[var(--fg-hi)]">VAYU-DRISHTI</strong> it
              meant the platform the rest of a four-person team built on.
            </p>
            <p className="t-body">
              The habit connecting them is writing the reasoning down.
              Complexity bounds live in the function header that implements
              them. Dependencies carry a line explaining why they exist and what
              was rejected. The config layer refuses to start the server in a
              dangerous state rather than trusting that nobody will ask it to.
            </p>
          </div>

          <Panel className="self-start">
            <PanelBody>
              <dl className="flex flex-col gap-0">
                {[
                  ["Role", SITE.role],
                  ["Location", SITE.location],
                  ["Education", SITE.education],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="border-b border-[var(--hair-faint)] py-3 last:border-b-0"
                  >
                    <dt className="t-label text-[var(--fg-low)]">{label}</dt>
                    <dd className="t-small mt-1 text-[var(--fg-hi)]">{value}</dd>
                  </div>
                ))}
              </dl>
            </PanelBody>
          </Panel>
        </div>
      </PageSection>

      <PageSection
        title="How it's built"
        index="02"
        lead="Four habits, each earned by a specific piece of committed code. None of these are aspirations."
      >
        <ol className="grid grid-cols-1 gap-px border border-[var(--hair)] bg-[var(--hair)] md:grid-cols-2">
          {PRINCIPLES.map((p) => (
            <li
              key={p.index}
              className="flex flex-col justify-between gap-6 bg-[var(--panel)] p-6 md:p-8"
            >
              <div>
                <span className="t-label text-[var(--accent)]">{p.index}</span>
                <h3 className="t-h3 mt-3 mb-3">{p.title}</h3>
                <p className="t-small text-[var(--fg-mid)]">{p.body}</p>
              </div>
              <VerifyChip source={p.source} />
            </li>
          ))}
        </ol>
      </PageSection>
    </PageShell>
  );
}
