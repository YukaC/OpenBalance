#!/usr/bin/env node
/**
 * Rasterize public/icons/icon.svg → PNG 180 / 192 / 512 for PWA + stores (K3).
 *
 * Uses `sharp` if present in node_modules (often transitive via Next).
 * Does not add sharp as a project dependency — if missing, prints instructions.
 *
 * Usage: node scripts/generate-icons.mjs
 */
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = path.join(rootDir, "public", "icons");
const svgPath = path.join(iconsDir, "icon.svg");

const SIZES = [
  { name: "icon-180.png", size: 180 },
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
];

async function loadSharp() {
  const require = createRequire(import.meta.url);
  try {
    return require("sharp");
  } catch {
    return null;
  }
}

async function main() {
  if (!existsSync(svgPath)) {
    console.error(`[generate-icons] Missing ${svgPath}`);
    process.exit(1);
  }

  const sharp = await loadSharp();
  if (!sharp) {
    console.error(
      "[generate-icons] sharp is not installed.\n" +
        "  Option A: keep the existing PNGs under public/icons/.\n" +
        "  Option B: pnpm add -D sharp  (ask before adding deps), then re-run.\n" +
        "  Option C: export manually from icon.svg at 180 / 192 / 512.",
    );
    process.exit(1);
  }

  await mkdir(iconsDir, { recursive: true });
  const svgBuffer = await readFile(svgPath);

  for (const { name, size } of SIZES) {
    const outPath = path.join(iconsDir, name);
    const png = await sharp(svgBuffer)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    await writeFile(outPath, png);
    console.log(`[generate-icons] Wrote ${name} (${size}×${size})`);
  }

  console.log("[generate-icons] Done. Manifest already references these PNGs.");
}

main().catch((error) => {
  console.error("[generate-icons] Failed:", error);
  process.exit(1);
});
