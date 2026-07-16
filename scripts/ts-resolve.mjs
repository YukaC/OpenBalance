import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".cjs"];

function resolveWithExtension(parentUrl, specifier) {
  const parentPath = fileURLToPath(parentUrl);
  const baseDir = dirname(parentPath);
  const absoluteBase = join(baseDir, specifier);

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

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") || specifier.startsWith("/")) {
      const resolvedPath = resolveWithExtension(context.parentURL, specifier);
      if (resolvedPath) {
        return {
          shortCircuit: true,
          url: pathToFileURL(resolvedPath).href,
        };
      }
    }
    return nextResolve(specifier, context);
  },
});
