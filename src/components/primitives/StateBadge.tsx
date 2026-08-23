import { cn } from "@/lib/cn";

export type BadgeState = "safe" | "unsafe" | "waiting" | "signal" | "neutral";

interface Props {
  state?: BadgeState;
  children: React.ReactNode;
  className?: string;
}

/**
 * State is carried by shape as well as colour — circle, square, triangle — so
 * it survives greyscale, colour-blindness and a printed page.
 */
const GLYPH: Record<BadgeState, React.ReactNode> = {
  safe: <circle cx="4.5" cy="4.5" r="3.5" fill="currentColor" />,
  unsafe: <rect x="1" y="1" width="7" height="7" fill="currentColor" />,
  waiting: <path d="M4.5 1 8 7.5H1z" fill="currentColor" />,
  signal: <circle cx="4.5" cy="4.5" r="3.5" fill="currentColor" />,
  neutral: null,
};

const TONE: Record<BadgeState, string> = {
  safe: "text-[var(--state-safe)]",
  unsafe: "text-[var(--state-unsafe)]",
  waiting: "text-[var(--state-waiting)]",
  signal: "text-[var(--accent)]",
  neutral: "text-[var(--fg-mid)]",
};

export function StateBadge({ state = "neutral", children, className }: Props) {
  return (
    <span
      className={cn(
        "t-label inline-flex items-center gap-2 rounded-[2px] border border-current px-2.5 py-1",
        TONE[state],
        className,
      )}
    >
      {GLYPH[state] && (
        <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true">
          {GLYPH[state]}
        </svg>
      )}
      {children}
    </span>
  );
}
