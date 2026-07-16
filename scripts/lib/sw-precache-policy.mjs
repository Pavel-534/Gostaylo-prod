/**
 * SSOT — guest PWA precache allow/deny rules (Stage 171.28, IOS-P0-02).
 * Used by `scripts/generate-sw-precache.mjs` at postbuild.
 */

/** iOS install budget — guest shell only (gzip). */
export const MAX_PRECACHE_GZIP_BYTES = 150 * 1024

/** Single chunk cap unless whitelisted as core runtime. */
export const MAX_SINGLE_CHUNK_GZIP_BYTES = 48 * 1024

/** Static icons + manifest (no map sprites — runtime SWR via `/leaflet/`). */
export const BASE_PRECACHE = [
  '/manifest.webmanifest',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/badge-72x72.png',
  '/favicon.ico',
]

/** App router pages whose chunk lists are scanned (route groups aware). */
export const GUEST_PAGE_KEYS = [
  '/layout',
  '/(storefront)/page',
  '/(storefront)/listings/page',
]

/** Legacy keys kept for older manifests. */
export const LEGACY_GUEST_PAGE_KEYS = [
  'app/layout',
  '/listings/page',
  'app/listings/page',
]

/** Always precache — Next.js bootstrap (from build-manifest). */
export const CORE_RUNTIME_CHUNK_PATTERNS = [
  /^static\/chunks\/webpack-/,
  /^static\/chunks\/main-app-/,
  /^static\/chunks\/fd9d1056-/,
  /^static\/chunks\/2117-/,
  /^static\/chunks\/polyfills-/,
]

/** Small page shell entries — safe to include when under budget. */
export const PAGE_ENTRY_CHUNK_PATTERNS = [
  /^static\/chunks\/app\/layout-/,
  /^static\/chunks\/app\/\(storefront\)\/page-/,
  /^static\/chunks\/app\/\(storefront\)\/listings\/page-/,
]

/** Layout CSS (globals) — hashes vary per build; resolved dynamically from `/layout` manifest (171.31). */
export const ALLOWED_LAYOUT_CSS_PATTERNS = [
  /^static\/css\/[a-f0-9]+\.css$/,
]

/** Small root provider chunks after Stage 171.31 split — precache when under single-chunk cap. */
export const CORE_PROVIDER_CHUNK_PATTERNS = [
  /^static\/chunks\/app\/layout-/,
  /^static\/chunks\/components\/providers\/RootClientProviders-/,
  /^static\/chunks\/components\/providers\/GlobalStyles-/,
]

/** Module paths that must never enter install-time precache. */
export const EXCLUDE_MODULE_PATTERNS = [
  /leaflet/i,
  /react-leaflet/i,
  /MapPicker/i,
  /InteractiveSearchMap/i,
  /markercluster/i,
  /CatalogSearchMapPanel/i,
  /CatalogMobileMapSheet/i,
  /ListingMap/i,
  /\(chat\)/i,
  /\/messages\//i,
  /\/admin\//i,
  /\(partner\)/i,
  /\/partner\//i,
  /firebase/i,
  /posthog/i,
  /partner-chat/i,
  /PartnerForegroundNotifications/i,
  /browser-image-compression/i,
  /recharts/i,
]

/** Chunk URL denylist (lazy map graph, dynamic islands). */
export const EXCLUDE_CHUNK_URL_PATTERNS = [
  /^\/_next\/static\/chunks\/d0deef33\./,
  /^\/_next\/static\/chunks\/b1644e8c-/,
  /^\/_next\/static\/css\/fc1c9daac70c093b\.css$/,
  /^\/_next\/static\/css\/d06fe514b27d96f4\.css$/,
  /^\/_next\/static\/chunks\/\d+\.[a-f0-9]{8,}\.js$/,
  /^\/leaflet\//,
]

/** react-loadable manifest keys → exclude associated files from precache. */
export const EXCLUDE_LOADABLE_KEY_PATTERNS = [
  /InteractiveSearchMap/i,
  /MapPicker/i,
  /react-leaflet/i,
  /ListingMap/i,
  /firebase\/messaging/i,
  /posthog-js/i,
  /messages/i,
  /partner-chat/i,
  /PartnerForegroundNotifications/i,
  /admin/i,
  /\(partner\)/i,
]

export function toPrecacheUrl(chunk) {
  const normalized = String(chunk || '').trim().replace(/\\/g, '/')
  if (!normalized) return null
  if (normalized.startsWith('/_next/')) return normalized
  if (normalized.startsWith('static/')) return `/_next/${normalized}`
  return null
}

export function isCoreRuntimeChunk(relativeChunk) {
  return CORE_RUNTIME_CHUNK_PATTERNS.some((re) => re.test(relativeChunk))
}

export function isPageEntryChunk(relativeChunk) {
  return PAGE_ENTRY_CHUNK_PATTERNS.some((re) => re.test(relativeChunk))
}

export function isCoreProviderChunk(relativeChunk) {
  return CORE_PROVIDER_CHUNK_PATTERNS.some((re) => re.test(relativeChunk))
}

export function isAllowedLayoutCss(relativeChunk, layoutCssAllowlist = null) {
  if (layoutCssAllowlist instanceof Set && layoutCssAllowlist.has(relativeChunk)) {
    return true
  }
  return ALLOWED_LAYOUT_CSS_PATTERNS.some((re) => re.test(relativeChunk))
}

export function modulePathExcluded(modulePath) {
  const normalized = String(modulePath || '').replace(/\\/g, '/')
  return EXCLUDE_MODULE_PATTERNS.some((re) => re.test(normalized))
}

export function chunkUrlExcluded(precacheUrl) {
  return EXCLUDE_CHUNK_URL_PATTERNS.some((re) => re.test(precacheUrl))
}
