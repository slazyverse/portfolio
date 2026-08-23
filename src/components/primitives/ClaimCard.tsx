import type { Claim } from "@/data/types";
import { SourceLink } from "./SourceLink";

interface Props {
  claim: Claim;
}

/**
 * The site's core unit: a statement about the work, and the file that proves
 * it. The type model makes it impossible to render one without the other.
 */
export function ClaimCard({ claim }: Props) {
  return (
    <figure className="lift flex h-full flex-col justify-between gap-5 border border-[var(--hair)] border-l-2 border-l-[var(--accent)] bg-[var(--panel)] p-6">
      <blockquote className="t-body text-[var(--fg-hi)]">
        {claim.statement}
      </blockquote>
      <figcaption>
        <SourceLink source={claim.source} />
      </figcaption>
    </figure>
  );
}
