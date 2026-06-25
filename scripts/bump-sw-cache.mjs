#!/usr/bin/env node
/**
 * Stage 171.20 — materialize `public/sw.js` from `src/pwa/sw.template.js` + deploy cache name.
 * SSOT env: VERCEL_GIT_COMMIT_SHA → VERCEL_DEPLOYMENT_ID → local fallback.
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  SW_TEMPLATE_PATH,
  SW_OUTPUT_PATH,
  CACHE_NAME_PLACEHOLDER,
} from './lib/sw-build-paths.mjs'

function resolveCacheSuffix() {
  const sha = String(process.env.VERCEL_GIT_COMMIT_SHA || '').trim()
  if (sha) return sha.slice(0, 12)
  const deploymentId = String(process.env.VERCEL_DEPLOYMENT_ID || '').trim()
  if (deploymentId) return deploymentId.slice(0, 12)
  return `local-${Date.now().toString(36)}`
}

function main() {
  if (!fs.existsSync(SW_TEMPLATE_PATH)) {
    console.error(`[bump-sw-cache] missing template: ${SW_TEMPLATE_PATH}`)
    process.exit(1)
  }

  const cacheName = `airento-assets-${resolveCacheSuffix()}`
  const template = fs.readFileSync(SW_TEMPLATE_PATH, 'utf8')

  if (!template.includes(CACHE_NAME_PLACEHOLDER)) {
    console.error(`[bump-sw-cache] template missing placeholder ${CACHE_NAME_PLACEHOLDER}`)
    process.exit(1)
  }

  const content = template.replaceAll(CACHE_NAME_PLACEHOLDER, cacheName)
  fs.mkdirSync(path.dirname(SW_OUTPUT_PATH), { recursive: true })
  fs.writeFileSync(SW_OUTPUT_PATH, content, 'utf8')
  console.log(`[bump-sw-cache] ${SW_OUTPUT_PATH} ← template, CACHE_NAME → ${cacheName}`)
}

main()
