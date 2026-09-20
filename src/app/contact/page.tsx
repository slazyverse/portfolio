import type { Metadata } from "next";
import { PageSection, PageShell } from "@/components/layout/PageShell";
import { Panel, PanelBody } from "@/components/system";
import { SITE } from "@/data/site";
import { route } from "@/data/routes";
import { routeMetadata } from "@/lib/metadata";

export const metadata: Metadata = routeMetadata("contact");

const LINKS = [
  { label: "Email", value: SITE.email, href: `mailto:${SITE.email}` },
  { label: "GitHub", value: SITE.githubHandle, href: SITE.github },
  { label: "LinkedIn", value: SITE.linkedinHandle, href: SITE.linkedin },
];

/**
 * Contact.
 *
 * No form. A form would need a backend, a spam strategy and somewhere to put
 * the data, and it would be a worse experience than an email address for
 * everyone involved.
 *
 * The CV section states plainly that no document exists yet. The route table
 * marks `/cv.pdf` as unavailable, which keeps it out of navigation and the
 * sitemap — linking to a résumé that does not exist would be a broken link and,
 * on a site whose premise is that every statement is checkable, exactly the
 * wrong kind of lie.
 */
export default function ContactPage() {
  const cv = route("cv");

  return (
    <PageShell
      routeId="contact"
      lead="Backend and systems work where correctness matters more than surface area."
    >
      <div className="grid grid-cols-1 gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <div className="flex flex-col gap-5">
          <p className="t-body">
            Currently finishing a B.Tech in Computer Science and Engineering at
            Lovely Professional University.
          </p>
          <p className="t-body text-[var(--fg-mid)]">
            If you are building something where the hard part is underneath —
            concurrency, data layers, observability, the platform other people
            build on — I would like to hear about it.
          </p>
        </div>

        <dl className="self-start border-t border-[var(--hair)]">
          {LINKS.map((link) => (
            <div
              key={link.label}
              className="flex flex-wrap items-baseline justify-between gap-4 border-b border-[var(--hair)] py-5"
            >
              <dt className="t-label text-[var(--fg-low)]">{link.label}</dt>
              <dd>
                <a
                  href={link.href}
                  {...(link.href.startsWith("http")
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="t-mono -my-1 inline-block py-1.5 text-[var(--fg-hi)] transition-colors hover:text-[var(--accent)]"
                >
                  {link.value}
                  {link.href.startsWith("http") && (
                    <>
                      <span aria-hidden="true"> &#8599;</span>
                      <span className="sr-only"> (opens in a new tab)</span>
                    </>
                  )}
                </a>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <PageSection title="CV" index="01">
        <Panel surface="deep">
          <PanelBody>
            {cv.available ? (
              <a href={cv.path} className="btn btn-signal">
                Download CV
              </a>
            ) : (
              <>
                <p className="t-body max-w-[70ch] text-[var(--fg-mid)]">
                  There is no downloadable CV yet, and this page says so rather
                  than linking to one that does not exist. The route is
                  reserved and marked unavailable in the route table, so it
                  stays out of navigation and out of the sitemap until a real
                  document is written.
                </p>
                <p className="t-body mt-4 max-w-[70ch] text-[var(--fg-mid)]">
                  Until then the projects are the résumé, and unlike a PDF
                  every line of them can be opened and checked.
                </p>
              </>
            )}
          </PanelBody>
        </Panel>
      </PageSection>
    </PageShell>
  );
}
