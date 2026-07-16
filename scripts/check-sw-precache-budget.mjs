#!/usr/bin/env node
/**
 * Validates guest PWA precache gzip budget after postbuild (Stage 171.28).
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { MAX_PRECACHE_GZIP_BYTES } from './lib/sw-precache-policy.mjs'
import { SW_OUTPUT_PATH } from './lib/sw-build-paths.mjs'

const ROOT = process.cwd()
const DIST = path.join(ROOT, '.next')

/** Served by Next routes — not materialized under `public/` at build time. */
const RUNTIME_ROUTE_ASSETS = new Set(['/manifest.webmanifest', '/favicon.ico'])

const START = '// AIRENTO_PRECACHE_START'
const END = '// AIRENTO_PRECACHE_END'

function resolveAssetPath(precacheUrl) {
  if (precacheUrl.startsWith('/_next/static/')) {
    return path.join(DIST, 'static', precacheUrl.slice('/_next/static/'.length))
  }
  if (precacheUrl.startsWith('/')) {
    return path.join(ROOT, 'public', precacheUrl.slice(1))
  }
  return null
}

function extractPrecacheUrls(content) {
  const start = content.indexOf(START)
  const end = content.indexOf(END)
  if (start < 0 || end < 0) {
    throw new Error('precache markers missing in public/sw.js')
  }
  const block = content.slice(start, end)
  return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1])
}

function main() {
  if (!fs.existsSync(SW_OUTPUT_PATH)) {
    console.error('[check:sw-precache] missing public/sw.js — run prebuild/postbuild first')
    process.exit(1)
  }

  const content = fs.readFileSync(SW_OUTPUT_PATH, 'utf8')
  const urls = extractPrecacheUrls(content)
  let totalGzip = 0
  const missing = []

  for (const url of urls) {
    if (RUNTIME_ROUTE_ASSETS.has(url)) {
      continue
    }
    const filePath = resolveAssetPath(url)
    if (!filePath || !fs.existsSync(filePath)) {
      missing.push(url)
      continue
    }
    totalGzip += zlib.gzipSync(fs.readFileSync(filePath)).length
  }

  if (missing.length) {
    console.error('[check:sw-precache] missing assets:', missing.join(', '))
    process.exit(1)
  }

  console.log(
    `[check:sw-precache] ${urls.length} entries, ${Math.round(totalGzip / 1024)} KB gzip (budget ${Math.round(MAX_PRECACHE_GZIP_BYTES / 1024)} KB)`,
  )

  if (totalGzip > MAX_PRECACHE_GZIP_BYTES) {
    console.error('[check:sw-precache] budget exceeded')
    process.exit(1)
  }
}

main()
