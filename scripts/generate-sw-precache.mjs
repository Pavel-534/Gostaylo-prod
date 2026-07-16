#!/usr/bin/env node
/**
 * Stage 171.28 — postbuild: trim guest PWA precache (IOS-P0-02).
 * Injects minimal storefront shell into generated `public/sw.js`.
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { SW_OUTPUT_PATH } from './lib/sw-build-paths.mjs'
import {
  BASE_PRECACHE,
  GUEST_PAGE_KEYS,
  LEGACY_GUEST_PAGE_KEYS,
  MAX_PRECACHE_GZIP_BYTES,
  MAX_SINGLE_CHUNK_GZIP_BYTES,
  EXCLUDE_LOADABLE_KEY_PATTERNS,
  toPrecacheUrl,
  isCoreRuntimeChunk,
  isPageEntryChunk,
  isCoreProviderChunk,
  isAllowedLayoutCss,
  modulePathExcluded,
  chunkUrlExcluded,
} from './lib/sw-precache-policy.mjs'

const ROOT = process.cwd()
const DIST = path.join(ROOT, '.next')
const STATIC = path.join(DIST, 'static')

const START_MARKER = '// AIRENTO_PRECACHE_START'
const END_MARKER = '// AIRENTO_PRECACHE_END'

const CLIENT_MANIFEST_CANDIDATES = [
  ['/(storefront)/page', path.join(DIST, 'server', 'app', '(storefront)', 'page_client-reference-manifest.js')],
  ['/(storefront)/listings/page', path.join(DIST, 'server', 'app', '(storefront)', 'listings', 'page_client-reference-manifest.js')],
  ['/listings/page', path.join(DIST, 'server', 'app', 'listings', 'page_client-reference-manifest.js')],
]

function resolveAssetPath(precacheUrl) {
  if (precacheUrl.startsWith('/_next/static/')) {
    return path.join(DIST, 'static', precacheUrl.slice('/_next/static/'.length))
  }
  if (precacheUrl.startsWith('/')) {
    return path.join(ROOT, 'public', precacheUrl.slice(1))
  }
  return null
}

function measureGzip(precacheUrl) {
  const filePath = resolveAssetPath(precacheUrl)
  if (!filePath || !fs.existsSync(filePath)) return 0
  return zlib.gzipSync(fs.readFileSync(filePath)).length
}

function parseClientReferenceManifest(filePath) {
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, 'utf8')
  const eq = raw.indexOf('={')
  if (eq < 0) return null
  return JSON.parse(raw.slice(eq + 1))
}

function buildChunkModuleIndex() {
  const index = new Map()

  for (const [, manifestPath] of CLIENT_MANIFEST_CANDIDATES) {
    const data = parseClientReferenceManifest(manifestPath)
    if (!data?.clientModules) continue

    for (const [modulePath, meta] of Object.entries(data.clientModules)) {
      for (const chunk of meta?.chunks || []) {
        const url = toPrecacheUrl(chunk)
        if (!url) continue
        if (!index.has(url)) index.set(url, new Set())
        index.get(url).add(modulePath.replace(/\\/g, '/'))
      }
    }
  }

  return index
}

function collectLoadableExcludeUrls() {
  const urls = new Set()
  const loadablePath = path.join(DIST, 'react-loadable-manifest.json')
  if (!fs.existsSync(loadablePath)) return urls

  try {
    const manifest = JSON.parse(fs.readFileSync(loadablePath, 'utf8'))
    for (const [key, entry] of Object.entries(manifest)) {
      if (!EXCLUDE_LOADABLE_KEY_PATTERNS.some((re) => re.test(key))) continue
      for (const file of entry?.files || []) {
        const url = toPrecacheUrl(file)
        if (url) urls.add(url)
      }
    }
  } catch (error) {
    console.warn('[generate-sw-precache] react-loadable-manifest parse failed', error?.message)
  }

  return urls
}

function chunkBlockedByModules(url, chunkModuleIndex) {
  const modules = chunkModuleIndex.get(url)
  if (!modules?.size) return false
  for (const modulePath of modules) {
    if (modulePathExcluded(modulePath)) return true
  }
  return false
}

function collectLayoutCssAllowlist(appBuild) {
  const allow = new Set()
  const pages = appBuild?.pages || {}
  const keys = [...GUEST_PAGE_KEYS, ...LEGACY_GUEST_PAGE_KEYS, '/layout']
  for (const key of keys) {
    const chunks = pages[key]
    if (!Array.isArray(chunks)) continue
    for (const relativeChunk of chunks) {
      if (String(relativeChunk).endsWith('.css')) {
        allow.add(relativeChunk)
      }
    }
  }
  return allow
}

function shouldIncludeChunk(
  relativeChunk,
  precacheUrl,
  chunkModuleIndex,
  loadableExcludeUrls,
  layoutCssAllowlist,
) {
  if (!precacheUrl) return { include: false, reason: 'invalid-url' }
  if (chunkUrlExcluded(precacheUrl)) return { include: false, reason: 'url-denylist' }
  if (loadableExcludeUrls.has(precacheUrl)) return { include: false, reason: 'lazy-loadable' }
  if (chunkBlockedByModules(precacheUrl, chunkModuleIndex)) return { include: false, reason: 'module-denylist' }

  if (isCoreRuntimeChunk(relativeChunk)) return { include: true, reason: 'core-runtime', priority: 100 }
  if (isAllowedLayoutCss(relativeChunk, layoutCssAllowlist)) {
    return { include: true, reason: 'layout-css', priority: 120 }
  }
  if (isCoreProviderChunk(relativeChunk)) return { include: true, reason: 'core-provider', priority: 85 }
  if (isPageEntryChunk(relativeChunk)) return { include: true, reason: 'page-entry', priority: 80 }

  const gzip = measureGzip(precacheUrl)
  if (gzip > MAX_SINGLE_CHUNK_GZIP_BYTES) {
    return { include: false, reason: `chunk-too-large-${Math.round(gzip / 1024)}kb-gzip` }
  }

  if (relativeChunk.endsWith('.css')) {
    return { include: false, reason: 'non-layout-css' }
  }

  return { include: true, reason: 'small-shared', priority: 50 }
}

function collectFromAppBuildManifest(manifest, chunkModuleIndex, loadableExcludeUrls, layoutCssAllowlist) {
  const candidates = []
  const pages = manifest?.pages || {}
  const keys = [...GUEST_PAGE_KEYS, ...LEGACY_GUEST_PAGE_KEYS]

  for (const key of keys) {
    const chunks = pages[key]
    if (!Array.isArray(chunks)) continue
    for (const relativeChunk of chunks) {
      const url = toPrecacheUrl(relativeChunk)
      const decision = shouldIncludeChunk(
        relativeChunk,
        url,
        chunkModuleIndex,
        loadableExcludeUrls,
        layoutCssAllowlist,
      )
      if (decision.include) {
        candidates.push({ url, priority: decision.priority ?? 60, reason: decision.reason })
      }
    }
  }

  return candidates
}

function collectRootChunks(buildManifest) {
  const candidates = []
  for (const group of ['rootMainFiles', 'polyfillFiles']) {
    for (const relativeChunk of buildManifest?.[group] || []) {
      const url = toPrecacheUrl(relativeChunk)
      if (!url) continue
      candidates.push({ url, priority: 100, reason: 'root-main' })
    }
  }
  return candidates
}

function applyGzipBudget(candidates) {
  const byUrl = new Map()
  for (const item of candidates) {
    const existing = byUrl.get(item.url)
    if (!existing || item.priority > existing.priority) {
      byUrl.set(item.url, item)
    }
  }

  const sorted = [...byUrl.values()].sort((a, b) => b.priority - a.priority)
  const included = []
  const dropped = []
  let totalGzip = 0

  for (const item of sorted) {
    const gzip = measureGzip(item.url)
    if (totalGzip + gzip > MAX_PRECACHE_GZIP_BYTES) {
      dropped.push({ ...item, gzip, reason: 'budget-exceeded' })
      continue
    }
    totalGzip += gzip
    included.push({ ...item, gzip })
  }

  return { included, dropped, totalGzip }
}

function patchPrecacheBlock(urls) {
  const content = fs.readFileSync(SW_OUTPUT_PATH, 'utf8')
  if (!content.includes(START_MARKER) || !content.includes(END_MARKER)) {
    console.error('[generate-sw-precache] markers missing in public/sw.js — run prebuild first')
    process.exit(1)
  }

  const lines = urls.map((url) => `  '${url}',`).join('\n')
  const block = `${START_MARKER}\n${lines}\n  ${END_MARKER}`

  const next = content.replace(
    new RegExp(`${START_MARKER}[\\s\\S]*?${END_MARKER}`),
    block,
  )

  fs.writeFileSync(SW_OUTPUT_PATH, next, 'utf8')
}

function main() {
  if (!fs.existsSync(SW_OUTPUT_PATH)) {
    console.error('[generate-sw-precache] missing public/sw.js — run `npm run prebuild` first')
    process.exit(1)
  }

  if (!fs.existsSync(path.join(DIST, 'app-build-manifest.json'))) {
    console.warn('[generate-sw-precache] .next not found — base precache only')
    patchPrecacheBlock([...BASE_PRECACHE].sort())
    return
  }

  const chunkModuleIndex = buildChunkModuleIndex()
  const loadableExcludeUrls = collectLoadableExcludeUrls()

  const candidates = []

  for (const url of BASE_PRECACHE) {
    candidates.push({ url, priority: 110, reason: 'base-static' })
  }

  const buildManifestPath = path.join(DIST, 'build-manifest.json')
  if (fs.existsSync(buildManifestPath)) {
    try {
      const buildManifest = JSON.parse(fs.readFileSync(buildManifestPath, 'utf8'))
      candidates.push(...collectRootChunks(buildManifest))
    } catch (error) {
      console.warn('[generate-sw-precache] build-manifest parse failed', error?.message)
    }
  }

  const appBuildPath = path.join(DIST, 'app-build-manifest.json')
  try {
    const appBuild = JSON.parse(fs.readFileSync(appBuildPath, 'utf8'))
    const layoutCssAllowlist = collectLayoutCssAllowlist(appBuild)
    candidates.push(
      ...collectFromAppBuildManifest(appBuild, chunkModuleIndex, loadableExcludeUrls, layoutCssAllowlist),
    )
  } catch (error) {
    console.warn('[generate-sw-precache] app-build-manifest parse failed', error?.message)
  }

  const { included, dropped, totalGzip } = applyGzipBudget(candidates)
  const sorted = included.map((item) => item.url).sort()

  patchPrecacheBlock(sorted)

  const chunkCount = sorted.filter((u) => u.includes('/_next/static/')).length
  console.log(
    `[generate-sw-precache] PRECACHE_URLS → ${sorted.length} entries (${chunkCount} static assets, ${Math.round(totalGzip / 1024)} KB gzip / budget ${Math.round(MAX_PRECACHE_GZIP_BYTES / 1024)} KB)`,
  )

  if (dropped.length > 0) {
    const sample = dropped.slice(0, 12).map((d) => `${d.url.replace('/_next/static/', '')} (${d.reason})`)
    console.log(`[generate-sw-precache] excluded ${dropped.length} candidates: ${sample.join(', ')}`)
  }

  if (totalGzip > MAX_PRECACHE_GZIP_BYTES) {
    console.error('[generate-sw-precache] budget exceeded after selection — review sw-precache-policy.mjs')
    process.exit(1)
  }
}

main()
