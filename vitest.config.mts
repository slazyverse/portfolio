import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

/**
 * Two projects, split by whether they need the network.
 *
 * `unit` is hermetic and runs on every commit. `evidence` reaches out to GitHub
 * to confirm that the sources behind the site's claims still resolve, so it
 * runs in CI and on demand rather than in a pre-commit loop.
 */
export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["tests/**/*.test.ts"],
          exclude: ["tests/evidence.test.ts"],
          environment: "node",
        },
        resolve: { alias },
      },
      {
        test: {
          name: "evidence",
          include: ["tests/evidence.test.ts"],
          environment: "node",
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
        resolve: { alias },
      },
    ],
  },
});
