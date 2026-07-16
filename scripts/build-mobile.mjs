#!/usr/bin/env node
/**
 * Static-export build for Capacitor (webDir: out).
 *
 * Sets NEXT_OUTPUT=export so next.config.ts enables `output: 'export'`
 * without affecting the normal Vercel SSR/API build.
 *
 * During the export, `src/app/api` is temporarily moved aside — Next.js
 * cannot static-export a project that contains Route Handlers. The mobile
 * app is expected to call the remote Vercel API via NEXT_PUBLIC_API_BASE_URL.
 *
 * Required env for a usable native app:
 *   NEXT_PUBLIC_API_BASE_URL  — production API origin (e.g. https://rinde.vercel.app)
 *
 * Optional store links (also used by the web download banner):
 *   NEXT_PUBLIC_ANDROID_DOWNLOAD_URL
 *   NEXT_PUBLIC_IOS_DOWNLOAD_URL
 */
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = path.join(rootDir, "src", "app", "api");
const stashRoot = path.join(os.tmpdir(), `rinde-mobile-api-stash-${process.pid}`);
const stashedApiDir = path.join(stashRoot, "api");

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
if (!apiBaseUrl) {
  console.warn(
    "[build-mobile] WARNING: NEXT_PUBLIC_API_BASE_URL is not set.\n" +
      "  The static app will not know where to call the remote API.\n" +
      "  Example: NEXT_PUBLIC_API_BASE_URL=https://your-app.vercel.app npm run build:mobile",
  );
}

function stashApiRoutes() {
  if (!existsSync(apiDir)) return false;
  if (existsSync(stashRoot)) {
    rmSync(stashRoot, { recursive: true, force: true });
  }
  mkdirSync(stashRoot, { recursive: true });
  // cp + rm (not rename) so cross-filesystem tmp dirs work
  cpSync(apiDir, stashedApiDir, { recursive: true });
  rmSync(apiDir, { recursive: true, force: true });
  console.log("[build-mobile] Stashed src/app/api for static export");
  return true;
}

function restoreApiRoutes(wasStashed) {
  if (!wasStashed) return;
  if (existsSync(apiDir)) {
    rmSync(apiDir, { recursive: true, force: true });
  }
  if (existsSync(stashedApiDir)) {
    mkdirSync(path.dirname(apiDir), { recursive: true });
    cpSync(stashedApiDir, apiDir, { recursive: true });
    console.log("[build-mobile] Restored src/app/api");
  }
  try {
    rmSync(stashRoot, { recursive: true, force: true });
  } catch {
    // ignore cleanup failures
  }
}

const env = {
  ...process.env,
  NEXT_OUTPUT: "export",
};

console.log("[build-mobile] Building Next.js static export (NEXT_OUTPUT=export)…");
if (apiBaseUrl) {
  console.log(`[build-mobile] API base: ${apiBaseUrl}`);
}

let wasStashed = false;
let exitCode = 1;

try {
  wasStashed = stashApiRoutes();

  const result = spawnSync("npx", ["next", "build"], {
    cwd: rootDir,
    env,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    console.error(
      "[build-mobile] Failed to start next build:",
      result.error.message,
    );
    exitCode = 1;
  } else {
    exitCode = result.status ?? 1;
  }
} finally {
  restoreApiRoutes(wasStashed);
}

process.exit(exitCode);
