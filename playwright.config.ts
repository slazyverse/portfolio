import { defineConfig, devices } from "@playwright/test";

/**
 * The accessibility gate.
 *
 * Runs against a real production build, because the things most likely to
 * regress — hydration, the no-flash script, reveal arming, focus order — do not
 * exist in a static snapshot of the markup.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  /**
   * Above Playwright's 30s default, because the first `page.goto` against a
   * freshly started production server has been measured at up to 35s on a cold
   * machine — the navigation, not the assertion, was timing out. This is a
   * cold-start allowance, not a slower assertion: every test still passes in
   * roughly 2s once the server is warm.
   */
  timeout: 60_000,
  /**
   * Serial, deliberately.
   *
   * From Phase 5 these tests drive a real WebGL city — generated textures,
   * merged geometry, a reflection pass — and CI renders it on a software
   * rasteriser. Run in parallel they compete for the same cores and time each
   * other out: across several runs the failures moved between an axe audit, a
   * landmark check and a navigation cycle, none of which had anything wrong
   * with them and all of which passed alone.
   *
   * A gate that fails for a reason unrelated to the code is not a gate. This
   * costs roughly four minutes of wall clock and buys a deterministic answer,
   * which is the correct trade for the thing that has to be trusted.
   */
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
