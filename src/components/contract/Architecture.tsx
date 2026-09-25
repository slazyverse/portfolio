import { VerifyChip } from "@/components/system";
import type { ArchitectureNote } from "@/data/types";

/* ---------------------------------------------------------------------------
 * How the system is put together.
 *
 * Two views, because they answer different questions and neither answers the
 * other. The stack says what the thing is made of and who owns each part; the
 * path says what actually happens to one request, in order. A layer diagram
 * alone implies a request visits layers top to bottom, which is usually false;
 * a pipeline alone hides the fact that half the pipeline belongs to somebody
 * else.
 *
 * Both are DOM, not an image. An SVG diagram would be one more thing to keep
 * in step with the prose, unreadable at phone width, and invisible to a screen
 * reader — and this content is a list with an order, which is a thing HTML
 * already has.
 * ------------------------------------------------------------------------- */

export function Architecture({ note }: { note: ArchitectureNote }) {
  return (
    <div className="flex flex-col gap-10">
      <p className="t-body max-w-[68ch]">{note.summary}</p>

      {note.layers && note.layers.length > 0 && (
        <div>
          <h3 className="t-label mb-5 text-[var(--fg-low)]">
            Layers, shallow to deep
          </h3>
          {/*
            An ordered list, because the order is the content: these are
            strata, and "shallow to deep" is the claim being made. The depth
            marker is the index, which is the same register the rest of the
            site counts levels in.
          */}
          <ol className="flex flex-col gap-px border border-[var(--hair)] bg-[var(--hair)]">
            {note.layers.map((layer, i) => (
              <li
                key={layer.name}
                className="grid grid-cols-1 gap-x-6 gap-y-2 bg-[var(--panel)] p-5 md:grid-cols-[3ch_minmax(0,20rem)_minmax(0,1fr)] md:p-6"
              >
                <span aria-hidden="true" className="t-mono text-[0.6875rem] text-[var(--accent)]">
                  {String(i).padStart(2, "0")}
                </span>
                <span className="t-cond text-[1rem] tracking-[0.02em] text-[var(--fg-hi)]">
                  {layer.name}
                </span>
                <span className="t-small text-[var(--fg-mid)]">{layer.detail}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {note.flow && note.flow.length > 0 && (
        <div>
          <h3 className="t-label mb-5 text-[var(--fg-low)]">
            What happens to one request
          </h3>
          <ol className="flex flex-col">
            {note.flow.map((step, i) => (
              <li key={step.stage} className="flex gap-5">
                {/*
                  The rail. A dot per stage and a line between them, drawn
                  with a border rather than a pseudo-element chain so it
                  survives forced-colors mode as a real box. The last stage
                  gets no continuing line, which is how the reader knows it
                  is the last one without counting.
                */}
                <div aria-hidden="true" className="flex flex-col items-center pt-[0.4rem]">
                  <span className="size-[7px] shrink-0 rotate-45 border border-[var(--accent)] bg-[var(--ground)]" />
                  {i < note.flow!.length - 1 && (
                    <span className="w-px grow bg-[var(--hair-strong)]" />
                  )}
                </div>
                <div className="min-w-0 pb-7">
                  <p className="t-cond text-[0.9375rem] tracking-[0.02em] text-[var(--fg-hi)]">
                    {step.stage}
                  </p>
                  <p className="t-small mt-1 max-w-[56ch] text-[var(--fg-mid)]">
                    {step.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {note.source && <VerifyChip source={note.source} />}
    </div>
  );
}
