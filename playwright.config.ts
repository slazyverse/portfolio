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
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
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
