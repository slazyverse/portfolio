"use client";

import { useCallback, useEffect, useState } from "react";
import { CommandPalette } from "./CommandPalette";
import { LevelRail } from "./LevelRail";
import { MobileBar } from "./MobileBar";
import { StatusBar } from "./StatusBar";
import { useRouteContext } from "./useRouteContext";

/**
 * The persistent interface layer.
 *
 * Mounted in the root layout, which is what makes it persistent: App Router
 * keeps layout components mounted across navigation, so the chrome is never
 * remounted, never re-initialised and never flashes. Route content changes
 * beneath it while it stays put — which is the behaviour the future
 * environment will need, since it has to survive navigation too.
 *
 * One `useRouteContext()` call at the top resolves where the visitor is, and
 * the result is passed down. Each piece of chrome could subscribe to the
 * pathname itself, but then three components would hold three subscriptions
 * and independently compute the same answer, with the option of disagreeing.
 *
 * The chrome frames the site; it does not become the site. It stays compact
 * deliberately — a persistent HUD that pushes the content down is a HUD that
 * cost the reader the thing they came for.
 */
export function SystemChrome({ children }: { children: React.ReactNode }) {
  const context = useRouteContext();
  const [paletteOpen, setPaletteOpen] = useState(false);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  // Ctrl+K / Cmd+K. An accelerator, never a gate: everything the palette
  // reaches is reachable from the visible navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <LevelRail context={context} />

      {/* `pb-20` on small screens clears the fixed mobile bar. It sits here
          rather than around the page content because the footer is part of
          this column too, and padding the content alone left the footer
          behind the bar. */}
      <div className="relative z-[var(--z-content)] pb-20 md:ml-[var(--rail-w)] md:pb-0">
        <StatusBar context={context} onOpenPalette={openPalette} />
        {children}
      </div>

      <MobileBar context={context} />
      <CommandPalette open={paletteOpen} onClose={closePalette} />
    </>
  );
}
