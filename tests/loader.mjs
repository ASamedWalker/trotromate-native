// Minimal Node loader so pure lib/*.ts modules run under node --test:
// resolves "@/" aliases and extensionless relative imports to .ts files.
import { pathToFileURL } from "node:url"
import { existsSync } from "node:fs"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
const asTs = (base) => [base + ".ts", path.join(base, "index.ts")].find(existsSync)

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const file = asTs(path.join(root, specifier.slice(2)))
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true }
  }
  if (specifier.startsWith(".") && context.parentURL && !path.extname(specifier)) {
    const file = asTs(path.resolve(path.dirname(new URL(context.parentURL).pathname), specifier))
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true }
  }
  return next(specifier, context)
}
