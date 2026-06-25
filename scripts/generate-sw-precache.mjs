#!/usr/bin/env node
/**
 * Stage 171.20 — postbuild: inject /listings app-shell chunks into generated `public/sw.js`.
 */
import fs from 'node:fs'
import path from 'node:path'
import { SW_OUTPUT_PATH } from './lib/sw-build-paths.mjs'

const ROOT = process.cwd()
const DIST = path.join(ROOT, '.next')

const START_MARKER = '// AIRENTO_PRECACHE_START'
const END_MARKER = '// AIRENTO_PRECACHE_END'

const BASE_PRECACHE = [
  '/manifest.webmanifest',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/badge-72x72.png',
  '/favicon.ico',
  '/leaflet/images/marker-icon.png',
  '/leaflet/images/marker-icon-2x.png',
  '/leaflet/images/marker-shadow.png',
]

const CATALOG_MODULE_HINTS = [
  'listings-catalog-client',
  'listing-card-skeleton',
  'ListingSidebar',
  'listing-card.jsx',
  'CatalogSortSelect',
  'CatalogSearchMapPanel',
  'CatalogMobileMapSheet',
  'InteractiveSearchMap',
  'globals.css',
  'AppHeader',
  'mobile-bottom-nav',
  'app/listings/page',
]

function toPrecacheUrl(chunk) {
  const normalized = String(chunk || '').trim().replace(/\\/g, '/')
  if (!normalized) return null
  if (normalized.startsWith('/_next/')) return normalized
  if (normalized.startsWith('static/')) return `/_next/${normalized}`
  return null
}

function parseListingsClientManifest(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const marker = '"/listings/page"]='
  const start = raw.indexOf(marker)
  if (start < 0) return null

  let i = start + marker.length
  while (raw[i] === ' ') i += 1
  if (raw[i] !== '{') return null

  let depth = 0
  const jsonStart = i
  for (; i < raw.length; i += 1) {
    const ch = raw[i]
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        return JSON.parse(raw.slice(jsonStart, i + 1))
      }
    }
  }
  return null
}

function collectFromAppBuildManifest(manifest) {
  const urls = new Set()
  const pages = manifest?.pages || {}
  for (const key of ['/layout', 'app/layout', '/listings/page', 'app/listings/page']) {
    const chunks = pages[key]
    if (!Array.isArray(chunks)) continue
    for (const chunk of chunks) {
      const url = toPrecacheUrl(chunk)
      if (url) urls.add(url)
    }
  }
  return urls
}

function collectCatalogShellChunks(listingsManifest) {
  const urls = new Set()
  if (!listingsManifest) return urls

  const { clientModules = {}, entryCSSFiles = {} } = listingsManifest

  for (const [modulePath, meta] of Object.entries(clientModules)) {
    const normalizedPath = modulePath.replace(/\\/g, '/')
    const isCatalogShell = CATALOG_MODULE_HINTS.some((hint) => normalizedPath.includes(hint))
    if (!isCatalogShell) continue
    for (const chunk of meta?.chunks || []) {
      const url = toPrecacheUrl(chunk)
      if (url) urls.add(url)
    }
  }

  for (const cssList of Object.values(entryCSSFiles)) {
    if (!Array.isArray(cssList)) continue
    for (const css of cssList) {
      const url = toPrecacheUrl(css)
      if (url) urls.add(url)
    }
  }

  return urls
}

function collectRootChunks(buildManifest) {
  const urls = new Set()
  for (const group of ['rootMainFiles', 'polyfillFiles']) {
    for (const chunk of buildManifest?.[group] || []) {
      const url = toPrecacheUrl(chunk)
      if (url) urls.add(url)
    }
  }
  return urls
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

  const appBuildPath = path.join(DIST, 'app-build-manifest.json')
  const buildManifestPath = path.join(DIST, 'build-manifest.json')
  const listingsManifestPath = path.join(
    DIST,
    'server',
    'app',
    'listings',
    'page_client-reference-manifest.js',
  )

  if (!fs.existsSync(appBuildPath)) {
    console.warn('[generate-sw-precache] .next not found — base precache only')
    patchPrecacheBlock([...BASE_PRECACHE].sort())
    return
  }

  const urls = new Set(BASE_PRECACHE)

  try {
    const appBuild = JSON.parse(fs.readFileSync(appBuildPath, 'utf8'))
    for (const url of collectFromAppBuildManifest(appBuild)) urls.add(url)
  } catch (error) {
    console.warn('[generate-sw-precache] app-build-manifest parse failed', error?.message)
  }

  if (fs.existsSync(buildManifestPath)) {
    try {
      const buildManifest = JSON.parse(fs.readFileSync(buildManifestPath, 'utf8'))
      for (const url of collectRootChunks(buildManifest)) urls.add(url)
    } catch (error) {
      console.warn('[generate-sw-precache] build-manifest parse failed', error?.message)
    }
  }

  if (fs.existsSync(listingsManifestPath)) {
    try {
      const listingsManifest = parseListingsClientManifest(listingsManifestPath)
      for (const url of collectCatalogShellChunks(listingsManifest)) urls.add(url)
    } catch (error) {
      console.warn('[generate-sw-precache] listings manifest parse failed', error?.message)
    }
  }

  const sorted = [...urls].sort()
  patchPrecacheBlock(sorted)
  console.log(
    `[generate-sw-precache] PRECACHE_URLS → ${sorted.length} entries (${sorted.filter((u) => u.includes('/_next/static/')).length} chunks)`,
  )
}

main()
