/**
 * Routes where the persistent environment hides.
 *
 * One WebGL context per page is the rule, and this is the single place that
 * names the exception to it. Two components need the same answer — the
 * environment itself, which hides, and the descent scene on the landing page,
 * which yields — so neither gets to hold its own copy of the list.
 *
 * `/system` is the environment laboratory. Its whole purpose is to render the
 * city at a tier this device may not have chosen, and with both live it was
 * rendering two complete cities at once and could not finish a frame.
 *
 * The landing is deliberately *not* here. Before Phase 6 it was, because it
 * owned a scroll-driven scene of its own; now the city is the landing, and
 * that scene steps aside instead.
 */
export function environmentStandsDown(pathname: string): boolean {
  return pathname === "/system";
}
