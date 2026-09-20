/**
 * SUBSTRATE — system primitives.
 *
 * The visual language the rest of the site is assembled from. Phase 2 builds
 * the language; the pages that speak it come later.
 *
 * Rules every primitive here obeys:
 *  - reads Tier 2 semantic tokens only, never a raw value
 *  - de-emphasises with colour, never with opacity
 *  - carries no information that is not also in the DOM as text
 *  - keyboard-reachable where it is interactive
 *  - survives reduced motion and forced colors without losing meaning
 */

export { Panel, PanelBody, PanelHead } from "./Panel";
export { Readout, ReadoutRow } from "./Readout";
export { StatusChip, type ChipState } from "./StatusChip";
export { VerifyChip } from "./VerifyChip";
export {
  DataRow,
  Divider,
  Scan,
  ScanLine,
  SectionMarker,
  SystemLabel,
  Vignette,
} from "./Primitives";
