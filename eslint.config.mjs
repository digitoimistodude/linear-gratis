import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // eslint-config-next 16 pulls in eslint-plugin-react-hooks 7, whose React
    // Compiler rules flag 35 existing call sites in 22 files. They are off so
    // the Next 16 upgrade stays a dependency change; fixing the call sites is
    // its own task.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // OpenNext build output
    ".open-next/**",
    // Local CommonJS helper scripts, never covered by `next lint` either
    "scripts/**",
  ]),
]);

export default eslintConfig;
