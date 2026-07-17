import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // next/core-web-vitals includes eslint-plugin-jsx-a11y — do not disable those rules.
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "public/pdf.worker.min.mjs",
      ".pnpm-store/**",
      "playwright-report/**",
      "test-results/**",
      ".worktrees/**",
    ],
  },
];

export default eslintConfig;
