/**
 * Stage 111.1 / 113.0 — публичные API витрины (фичи, статистика, локации).
 */

import { dedupeClientRequest } from '@/lib/api/client-request-dedup'
import {
  CACHE_KEY,
  TTL_PUBLIC_STATS_MS,
  TTL_SEARCH_LOCATIONS_MS,
  TTL_SITE_FEATURES_MS,
} from '@/lib/api/client-fetch-policy'

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

export async function fetchSiteFeatures() {
  return dedupeClientRequest(
    CACHE_KEY.siteFeatures,
    async () => {
      const res = await fetch('/api/v2/site-features', { cache: 'default' })
      const data = await readJson(res)
      return {
        ok: res.ok && data.success,
        semanticSearchOnSite:
          data?.data && typeof data.data.semanticSearchOnSite === 'boolean'
            ? data.data.semanticSearchOnSite
            : null,
        data: data?.data ?? null,
        raw: data,
        status: res.status,
      }
    },
    { ttlMs: TTL_SITE_FEATURES_MS },
  )
}

export async function fetchPublicStats() {
  return dedupeClientRequest(
    CACHE_KEY.publicStats,
    async () => {
      const res = await fetch('/api/v2/public/stats', { cache: 'default' })
      const data = await readJson(res)
      return { ok: res.ok && data.success, data: data?.data ?? null, raw: data, status: res.status }
    },
    { ttlMs: TTL_PUBLIC_STATS_MS },
  )
}

export async function fetchSearchLocations() {
  return dedupeClientRequest(
    CACHE_KEY.searchLocations,
    async () => {
      const res = await fetch('/api/v2/search/locations', { cache: 'default' })
      const data = await readJson(res)
      return {
        ok: res.ok && data.success,
        locations: data?.data ?? data?.locations ?? [],
        raw: data,
        status: res.status,
      }
    },
    { ttlMs: TTL_SEARCH_LOCATIONS_MS },
  )
}

/** Публичные UI-строки маркетинга (каталог, flash strip). */
export async function fetchPublicMarketingUiStrings(lang) {
  const q = lang ? `?lang=${encodeURIComponent(lang)}` : ''
  return dedupeClientRequest(
    `catalog:marketing-ui-strings:${lang || 'default'}`,
    async () => {
      const res = await fetch(`/api/v2/marketing/ui-strings${q}`, { cache: 'default' })
      const data = await readJson(res)
      return { ok: res.ok && data.success, data: data?.data ?? null, raw: data, status: res.status }
    },
    { ttlMs: 5 * 60_000 },
  )
}

/** Geo + валюта по IP (CurrencyProvider, авто-валюта). */
export async function fetchGeoCurrencyHint() {
  return dedupeClientRequest(
    'catalog:geo-currency-hint',
    async () => {
      const res = await fetch('/api/v2/geo', { cache: 'default' })
      const data = await readJson(res)
      return {
        ok: res.ok && data.success,
        currencyCode: data?.currency?.code ?? null,
        location: data?.location ?? null,
        raw: data,
        status: res.status,
      }
    },
    { ttlMs: 60_000 },
  )
}

export async function fetchSearchAvailableCount(params) {
  const qs = params instanceof URLSearchParams ? params : new URLSearchParams(params)
  if (!qs.has('limit')) qs.set('limit', '1')
  const res = await fetch(`/api/v2/search?${qs.toString()}`)
  const data = await readJson(res)
  return {
    ok: res.ok && data.success,
    available: data?.data?.meta?.available ?? 0,
    raw: data,
    status: res.status,
  }
}
