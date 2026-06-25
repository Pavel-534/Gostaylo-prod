/* global self, clients, caches, registration */
/**
 * Unified Service Worker — push (FCM) + static asset cache (Stage 171.13 → 171.20).
 *
 * SSOT template (Git): `src/pwa/sw.template.js` → generated `public/sw.js` (gitignored).
 * prebuild: `scripts/bump-sw-cache.mjs` (CACHE_NAME from VERCEL_GIT_COMMIT_SHA).
 * postbuild: `scripts/generate-sw-precache.mjs` (/listings app-shell chunks).
 */

importScripts('/push-visibility-policy.js')
importScripts('/firebase-messaging-sw.js')

/** @type {string} */
const CACHE_NAME = '__AIRENTO_SW_CACHE_NAME__'

const PRECACHE_URLS = [
  // AIRENTO_PRECACHE_START
  '/manifest.webmanifest',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/badge-72x72.png',
  '/favicon.ico',
  '/leaflet/images/marker-icon.png',
  '/leaflet/images/marker-icon-2x.png',
  '/leaflet/images/marker-shadow.png',
  // AIRENTO_PRECACHE_END
]

/** Always network — no SW cache (freshness / auth / PII). */
const BYPASS_PATH_PREFIXES = ['/api/', '/_db/', '/_storage/']

const BYPASS_API_FRESHNESS_PATHS = [
  '/api/v2/listings/search',
  '/api/v2/search/map-pins',
  '/api/v2/search',
  '/api/v2/bookings',
]

const BYPASS_HOST_SNIPPETS = [
  'supabase.co',
  'supabase.in',
  'accounts.google.com',
  'oauth2.googleapis.com',
  'www.googleapis.com',
  'securetoken.googleapis.com',
  'identitytoolkit.googleapis.com',
]

const BYPASS_MAP_TILE_HOST_SNIPPETS = ['tile.openstreetmap.org', 'tiles.openstreetmap.org']

const NEXT_RSC_HEADER_NAMES = [
  'rsc',
  'next-router-state-tree',
  'next-router-prefetch',
  'next-action',
  'next-url',
]

function isHtmlNavigationRequest(request, url) {
  if (request.mode === 'navigate') return true
  const accept = request.headers.get('accept') || ''
  if (accept.includes('text/html')) return true
  if (url.pathname.endsWith('.html')) return true
  return false
}

function isNextDynamicRequest(request, url) {
  const path = url.pathname
  if (path.startsWith('/_next/data/')) return true
  if (path.startsWith('/_next/webpack-hmr')) return true
  if (path.startsWith('/_next/image')) return true
  if (url.searchParams.has('_rsc')) return true
  if (NEXT_RSC_HEADER_NAMES.some((name) => request.headers.has(name))) return true
  return false
}

function isMapTileRequest(url) {
  const host = url.hostname.toLowerCase()
  return BYPASS_MAP_TILE_HOST_SNIPPETS.some((snippet) => host.includes(snippet))
}

function isFreshnessCriticalApiPath(url) {
  const path = url.pathname
  if (BYPASS_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) return true
  return BYPASS_API_FRESHNESS_PATHS.some(
    (snippet) => path === snippet || path.startsWith(`${snippet}/`),
  )
}

function shouldBypassCache(request) {
  if (request.method !== 'GET') return true

  let url
  try {
    url = new URL(request.url)
  } catch {
    return true
  }

  if (isHtmlNavigationRequest(request, url)) return true
  if (isNextDynamicRequest(request, url)) return true
  if (isMapTileRequest(url)) return true

  const host = url.hostname.toLowerCase()
  const sameOrigin = host === self.location.hostname.toLowerCase()

  if (sameOrigin) {
    if (isFreshnessCriticalApiPath(url)) return true
    if (url.pathname.includes('/auth/v1/') || url.pathname.includes('/oauth')) return true
    return false
  }

  if (BYPASS_HOST_SNIPPETS.some((snippet) => host.includes(snippet))) return true
  return true
}

function isCacheableStaticAsset(url) {
  const path = url.pathname

  if (path.startsWith('/_next/static/')) return true
  if (path.startsWith('/leaflet/')) return true
  if (path.startsWith('/icons/')) return true
  if (path.startsWith('/brand/')) return true

  return /\.(?:png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|otf|css|js|mjs)$/i.test(path)
}

function isStorableResponse(response) {
  if (!response || !response.ok) return false
  return response.type === 'basic' || response.type === 'cors'
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)

  const networkPromise = fetch(request)
    .then((response) => {
      if (isStorableResponse(response)) {
        void cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => null)

  if (cached) {
    void networkPromise
    return cached
  }

  const fromNetwork = await networkPromise
  if (fromNetwork) return fromNetwork

  return Response.error()
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        PRECACHE_URLS.map((url) => cache.add(new Request(url, { cache: 'reload' }))),
      ),
    ),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (shouldBypassCache(request)) return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }

  if (!isCacheableStaticAsset(url)) return

  event.respondWith(staleWhileRevalidate(request))
})
