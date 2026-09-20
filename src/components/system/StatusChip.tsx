import { cn } from "@/lib/cn";

export type ChipState =
  | "neutral"
  | "signal"
  | "safe"
  | "unsafe"
  | "waiting"
  | "cold";

interface Props {
  state?: ChipState;
  children: React.ReactNode;
  /** Suppresses the glyph where the surrounding context already carries it. */
  glyph?: boolean;
  className?: string;
}

/**
 * State carried by shape as well as colour — circle, square, triangle, bar —
 * so it survives greyscale, colour-blindness, forced colors and a printed
 * page. Colour alone would make the state invisible to a reader who cannot
 * distinguish green from red, which is roughly one man in twelve.
 */
const GLYPH: Record<ChipState, React.ReactNode> = {
  safe: <circle cx="4.5" cy="4.5" r="3.5" fill="currentColor" />,
  unsafe: <rect x="1" y="1" width="7" height="7" fill="currentColor" />,
  waiting: <path d="M4.5 1 8 7.5H1z" fill="currentColor" />,
  signal: <circle cx="4.5" cy="4.5" r="3.5" fill="currentColor" />,
  cold: <rect x="1" y="3" width="7" height="3" fill="currentColor" />,
  neutral: null,
};

const TONE: Record<ChipState, string> = {
  neutral: "",
  signal: "chip-signal",
  safe: "chip-safe",
  unsafe: "chip-unsafe",
  waiting: "chip-waiting",
  cold: "chip-cold",
};

export function StatusChip({
  state = "neutral",
  children,
  glyph = true,
  className,
}: Props) {
  return (
    <span className={cn("chip", TONE[state], className)}>
      {glyph && GLYPH[state] && (
        <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true">
          {GLYPH[state]}
        </svg>
      )}
      {children}
    </span>
  );
}
