import { Section } from "@/components/layout/Section";
import { SectionLabel } from "@/components/primitives/SectionLabel";
import { SITE } from "@/data/site";
import { Reveal } from "@/components/effects/Reveal";
import { TextReveal } from "@/components/effects/TextReveal";

const LINKS = [
  { label: "Email", value: SITE.email, href: `mailto:${SITE.email}` },
  { label: "GitHub", value: SITE.githubHandle, href: SITE.github },
  { label: "LinkedIn", value: SITE.linkedinHandle, href: SITE.linkedin },
];

export function Contact() {
  return (
    <Section id="contact" stratum="substrate">
      <Reveal from="none">
        <SectionLabel index="06">Now</SectionLabel>
      </Reveal>

      <TextReveal
        as="h2"
        id="contact-heading"
        className="t-h2 mb-6"
        lines={["What I’m looking for"]}
      />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <Reveal index={1} className="flex flex-col gap-5">
          <p className="t-lead text-[var(--fg)]">
            Backend and systems work where correctness matters more than surface
            area.
          </p>
          <p className="t-body">
            Currently finishing a B.Tech in Computer Science and Engineering at
            Lovely Professional University, and extending VAYU-DRISHTI&rsquo;s
            GIS layer from interface contracts to real raster tiles.
          </p>
          <p className="t-body text-[var(--fg-mid)]">
            If you are building something where the hard part is underneath —
            concurrency, data layers, observability, the platform other people
            build on — I would like to hear about it.
          </p>
        </Reveal>

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
                  {link.value} ↗
                </a>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  );
}
