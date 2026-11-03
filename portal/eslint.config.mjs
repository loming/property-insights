import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// The two apps are independent (P-0): neither app's code may import the other app's code or backend.
const appBoundary = (otherApp, otherBackend) => ({
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          group: [`@/features/${otherApp}`, `@/features/${otherApp}/*`, `@/lib/api/${otherBackend}`],
          message: "The two apps are independent (P-0): share code through components/, hooks/ or lib/ instead.",
        },
      ],
    },
  ],
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  { files: ["src/features/estimator/**", "src/app/estimator/**"], rules: appBoundary("market", "market") },
  { files: ["src/features/market/**", "src/app/market/**"], rules: appBoundary("estimator", "estimator") },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
