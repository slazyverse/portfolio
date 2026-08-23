"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

/**
 * Dark is the design's home. Light is offered because a portfolio gets read in
 * daylight, on projectors, and printed — not as an afterthought inversion.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  // Read from the DOM rather than storage: the no-flash script in the document
  // head has already resolved the correct theme by the time this runs, so this
  // stays the single source of truth and cannot disagree with what is painted.
  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "light" || current === "dark") setTheme(current);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    window.localStorage.setItem("theme", next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      className="t-label rounded-[2px] border border-[var(--hair)] px-3 py-1.5 text-[var(--fg-mid)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
    >
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
