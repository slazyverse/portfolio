import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

/**
 * Flat config. ESLint 9 dropped `.eslintrc`, and this project had neither the
 * old format nor the new one — `npm run lint` exited 2 on every invocation and
 * had therefore never linted a single file. Three pieces of dead code survived
 * into production because of it.
 *
 * `eslint-config-next` v16 publishes flat-config arrays on its subpaths, so
 * they are spread directly rather than routed through FlatCompat.
 *
 * @type {import("eslint").Linter.Config[]}
 */
const config = [
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "node_modules/**",
      "next-env.d.ts",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "*.tsbuildinfo",
    ],
  },

  ...nextCoreWebVitals,
  ...nextTypeScript,

  {
    name: "substrate/project-rules",
    rules: {
      // The audit found `use3D ? "sr-only" : "sr-only"` shipped to production.
      // Both branches identical is always a mistake.
      "no-constant-binary-expression": "error",

      // `palette.grid` was computed every theme change and never read.
      "no-unused-private-class-members": "error",

      // The reveal system depends on effects re-running when `motion` flips.
      // A missing dependency there silently strands elements mid-transition.
      "react-hooks/exhaustive-deps": "warn",

      // Every external evidence link opens in a new tab; without `noreferrer`
      // the target gets `window.opener`.
      "react/jsx-no-target-blank": [
        "error",
        { allowReferrer: false, enforceDynamicLinks: "always" },
      ],

      // Downgraded deliberately, with a deadline.
      //
      // Every current violation is the same shape: read a browser-only fact
      // that cannot exist during SSR — matchMedia, localStorage, a WebGL
      // context, a resolved data-* attribute — and sync it into state on mount.
      // That is the correct SSR-safe pattern, not a cascading-render bug, and
      // the components involved (MotionProvider, ThemeToggle) are load-bearing
      // enough that silently rewriting them during a ground-repair pass would
      // be the riskier choice.
      //
      // `useSyncExternalStore` is the right primitive for these and is
      // scheduled for Phase 2, when the provider layer is rebuilt for quality
      // tiers and the light theme is removed. Kept at `warn` so the count stays
      // visible and any NEW instance is noticed rather than absorbed.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default config;
