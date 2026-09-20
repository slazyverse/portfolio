"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CONTRACT_INDEX } from "@/data/contract-index";
import { NAV_ROUTES, contractPath } from "@/data/routes";
import { withViewTransition } from "@/lib/view-transition";
import { cn } from "@/lib/cn";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Target {
  id: string;
  display: string;
  conventional: string;
  path: string;
}

/**
 * The command palette — foundation only.
 *
 * Phase 4 establishes the slot and the interaction contract: a shortcut, a
 * filter, arrow-key selection, Enter to navigate, Escape to dismiss, and focus
 * returning where it came from. Richer commands come later; building a large
 * command system before there is anything to command would be guessing.
 *
 * It is a native `<dialog>` for the same reason the mobile drawer is: focus
 * trap, Escape and focus return are given correctly by the platform, with no
 * library and no custom key handling to get subtly wrong.
 *
 * It is an accelerator, never a gate. Everything reachable here is reachable
 * from the visible navigation, and nothing depends on knowing the shortcut.
 */
export function CommandPalette({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const targets: Target[] = [
    ...NAV_ROUTES.map((r) => ({
      id: r.id,
      display: r.display,
      conventional: r.conventional,
      path: r.path,
    })),
    ...CONTRACT_INDEX.map((c) => ({
      id: c.slug,
      display: c.designation,
      conventional: c.name,
      path: contractPath(c.slug),
    })),
  ];

  const q = query.trim().toLowerCase();
  const results = q
    ? targets.filter(
        (t) =>
          t.display.toLowerCase().includes(q) ||
          t.conventional.toLowerCase().includes(q) ||
          t.path.includes(q),
      )
    : targets;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      setQuery("");
      setActive(0);
      inputRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const go = (path: string) => {
    onClose();
    // The transition is decoration; the navigation happens regardless.
    withViewTransition(() => router.push(path));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = results[active];
      if (target) go(target.path);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-label="Navigate"
      className="m-0 mx-auto mt-[12vh] w-[min(34rem,92vw)] max-w-none border border-[var(--hair)] bg-[var(--panel)] p-0 text-[var(--fg)] backdrop:bg-[rgba(5,7,10,0.72)]"
    >
      <div onKeyDown={onKeyDown}>
        <div className="border-b border-[var(--hair)] px-4 py-3">
          <label htmlFor="palette-input" className="sr-only">
            Search pages and projects
          </label>
          <input
            id="palette-input"
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Go to…"
            autoComplete="off"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={results[active] ? `palette-${results[active].id}` : undefined}
            className="t-mono w-full bg-transparent text-[var(--fg-hi)] outline-none placeholder:text-[var(--fg-low)]"
          />
        </div>

        <ul id="palette-results" role="listbox" aria-label="Results" className="max-h-[50vh] overflow-y-auto">
          {results.map((t, i) => (
            <li
              key={t.id}
              id={`palette-${t.id}`}
              role="option"
              aria-selected={i === active}
            >
              <button
                type="button"
                tabIndex={-1}
                onClick={() => go(t.path)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex w-full min-h-11 items-baseline justify-between gap-4 px-4 py-2.5 text-left transition-colors",
                  i === active ? "bg-[var(--accent-wash)]" : "",
                )}
              >
                <span
                  className={cn(
                    "t-cond text-[0.9375rem]",
                    i === active ? "text-[var(--accent)]" : "text-[var(--fg-hi)]",
                  )}
                >
                  {t.display}
                </span>
                <span className="t-mono shrink-0 text-[0.6875rem] text-[var(--fg-low)]">
                  {t.conventional}
                </span>
              </button>
            </li>
          ))}

          {results.length === 0 && (
            <li className="t-small px-4 py-4 text-[var(--fg-low)]">
              Nothing matches “{query}”.
            </li>
          )}
        </ul>

        <p className="t-label border-t border-[var(--hair)] px-4 py-2 text-[var(--fg-low)]">
          <span aria-hidden="true">↑↓ select · ⏎ open · esc close</span>
          <span className="sr-only">
            Use arrow keys to select, Enter to open, Escape to close.
          </span>
        </p>
      </div>
    </dialog>
  );
}
