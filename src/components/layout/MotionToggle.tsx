"use client";

import { useMotion } from "@/components/providers/MotionProvider";

/**
 * Lets a visitor turn the motion layer on or off directly.
 *
 * When the OS asked for reduced motion, the control says so — the visitor
 * should be able to tell that the still page is a deliberate response to their
 * own setting rather than a site that failed to load.
 */
export function MotionToggle() {
  const { mode, systemReduced, overridden, toggle } = useMotion();
  const on = mode === "full";

  const title = systemReduced && !overridden
    ? "Your system requests reduced motion. Turn animation on for this site anyway."
    : on
      ? "Turn animation off"
      : "Turn animation on";

  return (
    <button
      type="button"
      onClick={toggle}
      title={title}
      aria-pressed={on}
      className="t-label flex items-center gap-2 rounded-[2px] border border-[var(--hair)] px-3 py-2 text-[var(--fg-mid)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
    >
      <span
        aria-hidden="true"
        className={
          on
            ? "block h-[7px] w-[7px] rounded-full bg-[var(--accent)]"
            : "block h-[7px] w-[7px] rounded-full border border-[var(--fg-low)]"
        }
      />
      <span>Motion</span>
      <span className="sr-only">{on ? "on" : "off"}</span>
    </button>
  );
}
