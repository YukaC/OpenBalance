import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".cjs"];
const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function resolveWithExtension(absoluteBase) {
  if (extname(absoluteBase)) {
    return existsSync(absoluteBase) ? absoluteBase : null;
  }

  for (const extension of SOURCE_EXTENSIONS) {
    const candidate = absoluteBase + extension;
    if (existsSync(candidate)) return candidate;
  }

  for (const extension of SOURCE_EXTENSIONS) {
    const indexCandidate = join(absoluteBase, `index${extension}`);
    if (existsSync(indexCandidate)) return indexCandidate;
  }

  return null;
}

function resolveSpecifier(parentUrl, specifier) {
  if (specifier.startsWith("@/")) {
    return resolveWithExtension(join(PROJECT_ROOT, "src", specifier.slice(2)));
  }

  if (specifier.startsWith(".") || specifier.startsWith("/")) {
    const parentPath = fileURLToPath(parentUrl);
    return resolveWithExtension(join(dirname(parentPath), specifier));
  }

  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const resolvedPath = resolveSpecifier(context.parentURL, specifier);
    if (resolvedPath) {
      return {
        shortCircuit: true,
        url: pathToFileURL(resolvedPath).href,
      };
    }
    return nextResolve(specifier, context);
  },
});
