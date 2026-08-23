"use client";

import { useEffect, useRef } from "react";
import type { CodeExcerpt as Excerpt } from "@/data/types";
import { cn } from "@/lib/cn";

interface Props {
  excerpt: Excerpt;
}

/**
 * Real source, with its path, line range and permalink. Lines under discussion
 * carry the signal treatment so the eye lands on the decision, not the syntax.
 *
 * Lines uncover in sequence on first view, which walks the reader down the
 * excerpt in reading order rather than presenting a wall of syntax. The stagger
 * is short — 40ms — because this is orientation, not spectacle.
 *
 * Highlighting is deliberately not a runtime syntax highlighter: the excerpts
 * are short and fixed, so shipping a tokenizer to the browser would cost more
 * than it returns.
 */
export function CodeExcerpt({ excerpt }: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lines = Array.from(root.querySelectorAll<HTMLElement>(".code-line"));
    for (const line of lines) line.dataset.revealArmed = "true";

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          lines.forEach((line, i) => {
            line.style.transitionDelay = `${i * 40}ms`;
            line.dataset.revealed = "true";
          });
          observer.unobserve(root);
        }
      },
      { threshold: 0.2 },
    );

    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  return (
    <figure
      ref={ref as React.Ref<HTMLElement>}
      className="lift overflow-hidden border border-[var(--hair)] bg-[var(--color-l0)]"
    >
      <figcaption className="t-mono flex items-center justify-between gap-4 border-b border-[var(--hair)] px-4 py-3 text-[var(--fg-low)]">
        <a
          href={excerpt.href}
          target="_blank"
          rel="noopener noreferrer"
          className="-my-1 inline-block truncate py-1 transition-colors hover:text-[var(--accent)]"
        >
          {excerpt.file}
        </a>
        <span className="shrink-0">{excerpt.range}</span>
      </figcaption>

      <div className="overflow-x-auto py-4">
        <pre className="t-mono">
          <code className={`language-${excerpt.language}`}>
            {excerpt.lines.map((line) => (
              <span
                key={line.n}
                className={cn(
                  "code-line block whitespace-pre px-4",
                  line.highlight
                    ? "border-l-2 border-[var(--accent)] bg-[var(--accent-wash)] pl-[calc(1rem-2px)] text-[var(--fg-hi)]"
                    : "text-[var(--fg-mid)]",
                )}
              >
                <span
                  aria-hidden="true"
                  className="inline-block w-9 shrink-0 select-none text-[var(--fg-low)]"
                >
                  {line.n}
                </span>
                {line.code}
              </span>
            ))}
          </code>
        </pre>
      </div>
    </figure>
  );
}
