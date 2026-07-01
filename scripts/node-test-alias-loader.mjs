/**
 * Node ESM loader: resolve `@/` imports to project root (mirrors jsconfig paths).
 * Used by `npm run test:discovery-pipeline` only.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * @param {string} specifier
 * @returns {string|null}
 */
function resolveAliasHref(specifier) {
  if (!specifier.startsWith('@/')) return null
  const rel = specifier.slice(2)
  const base = path.join(ROOT, rel)
  const withJs = `${base}.js`
  const indexJs = path.join(base, 'index.js')

  if (fs.existsSync(withJs) && fs.statSync(withJs).isFile()) {
    return pathToFileURL(withJs).href
  }
  if (fs.existsSync(indexJs) && fs.statSync(indexJs).isFile()) {
    return pathToFileURL(indexJs).href
  }
  if (fs.existsSync(base) && fs.statSync(base).isFile()) {
    return pathToFileURL(base).href
  }
  return pathToFileURL(withJs).href
}

/** @type {import('node:module').ResolveHook} */
export async function resolve(specifier, context, nextResolve) {
  const aliased = resolveAliasHref(specifier)
  if (aliased) {
    return nextResolve(aliased, context)
  }
  return nextResolve(specifier, context)
}
