import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(
  rootDir,
  "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
);
const targetPath = join(rootDir, "public/pdf.worker.min.mjs");

if (!existsSync(sourcePath)) {
  console.warn(
    "[copy-pdf-worker] pdfjs-dist worker not found; skip (run pnpm install).",
  );
  process.exit(0);
}

mkdirSync(dirname(targetPath), { recursive: true });
copyFileSync(sourcePath, targetPath);
console.log("[copy-pdf-worker] Wrote public/pdf.worker.min.mjs");
