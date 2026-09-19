import { cn } from "@/lib/cn";

type Surface = "panel" | "deep" | "raised";

interface PanelProps {
  children: React.ReactNode;
  /** Which surface the panel sits on. Deeper reads as more fundamental. */
  surface?: Surface;
  /** Corner marks. Decorative, and removed under forced colors. */
  bracket?: boolean | "cold";
  /** Inner top highlight, so the surface reads as lit rather than as a box. */
  lit?: boolean;
  /** 2px hover rise. Instrument panel, not a marketing card. */
  lift?: boolean;
  as?: "div" | "figure" | "section" | "article" | "li";
  className?: string;
}

const SURFACE: Record<Surface, string> = {
  panel: "panel",
  deep: "panel-deep",
  raised: "panel-raised",
};

/**
 * The system's basic container.
 *
 * There are no shadows anywhere in SUBSTRATE. Depth is built from three
 * things — a hairline border, the delta between surface tokens, and an
 * optional inner highlight. That is cheaper to composite than a shadow and it
 * reads as machined rather than soft.
 *
 * Brackets are corner marks rather than a full second frame: they suggest a
 * targeting reticle or a technical drawing's crop marks, and cost two
 * pseudo-elements instead of an extra element.
 */
export function Panel({
  children,
  surface = "panel",
  bracket = false,
  lit = false,
  lift = false,
  as: Tag = "div",
  className,
}: PanelProps) {
  return (
    <Tag
      className={cn(
        SURFACE[surface],
        bracket && "bracket",
        bracket === "cold" && "bracket-cold",
        lit && "panel-lit",
        lift && "lift",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * The header strip on an instrument panel: what it is on the left, what state
 * it is in on the right.
 */
export function PanelHead({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("panel-head t-label", className)}>{children}</div>;
}

export function PanelBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("panel-body", className)}>{children}</div>;
}
