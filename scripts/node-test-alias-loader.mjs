/**
 * Node ESM loader: resolve `@/` imports, `next/*`, and extensionless relative paths.
 * Used by discovery tests, smoke scripts, and cleanup utilities.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Node ESM cannot resolve bare `next/server` without package exports — map to `next/*.js`.
 * @param {string} specifier
 * @returns {string|null}
 */
function resolveNextSubpathHref(specifier) {
  if (!specifier.startsWith('next/')) return null
  const rel = specifier.slice('next/'.length)
  const candidate = path.join(ROOT, 'node_modules', 'next', `${rel}.js`)
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return pathToFileURL(candidate).href
  }
  return null
}

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

const MODULE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.json', '.node', '.ts', '.tsx'])

function hasExplicitModuleExtension(specifier) {
  const ext = path.extname(specifier)
  return ext ? MODULE_EXTENSIONS.has(ext) : false
}

/**
 * Next.js allows extensionless relative imports; Node ESM needs explicit `.js`.
 * @param {string} specifier
 * @param {import('node:module').ResolveHookContext} context
 * @returns {string|null}
 */
function resolveExtensionlessRelativeHref(specifier, context) {
  if (!specifier.startsWith('.') || hasExplicitModuleExtension(specifier)) return null
  if (!context.parentURL) return null

  const parentPath = fileURLToPath(context.parentURL)
  const base = path.resolve(path.dirname(parentPath), specifier)
  const withJs = `${base}.js`
  const indexJs = path.join(base, 'index.js')

  if (fs.existsSync(withJs) && fs.statSync(withJs).isFile()) {
    return pathToFileURL(withJs).href
  }
  if (fs.existsSync(indexJs) && fs.statSync(indexJs).isFile()) {
    return pathToFileURL(indexJs).href
  }
  return null
}

/** @type {import('node:module').ResolveHook} */
export async function resolve(specifier, context, nextResolve) {
  const aliased =
    resolveAliasHref(specifier) ||
    resolveNextSubpathHref(specifier) ||
    resolveExtensionlessRelativeHref(specifier, context)
  if (aliased) {
    return nextResolve(aliased, context)
  }
  return nextResolve(specifier, context)
}
