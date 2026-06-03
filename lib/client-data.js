/**
 * GoStayLo - Client-side Data Fetching
 * Каталог/курсы — через same-origin API (без anon PostgREST к чувствительным таблицам).
 * Админ-диагностика — GET /api/admin/metrics/overview (cookie + service_role на сервере).
 * Stage 113.0 — categories dedup/TTL; FX — localStorage v3 (2h).
 */

import { dedupeClientRequest } from '@/lib/api/client-request-dedup'
import { CACHE_KEY, TTL_CATEGORIES_MS } from '@/lib/api/client-fetch-policy'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (typeof window !== 'undefined') {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[CLIENT-DATA] CRITICAL: Supabase credentials missing!', {
      url: SUPABASE_URL ? 'SET' : 'MISSING',
      key: SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
    })
  }
}

const DISTRICTS = [
  'Rawai',
  'Chalong',
  'Kata',
  'Karon',
  'Patong',
  'Kamala',
  'Surin',
  'Bang Tao',
  'Nai Harn',
  'Panwa',
  'Mai Khao',
  'Nai Yang',
]

/** Bump при смене формата кеша (108.4: сброс устаревших FX на десктопе). v4: FX bundle + retailMarkupMultiplier. */
const CACHE_VERSION = 4
const CACHE_PREFIX = `gostaylo_cache_v${CACHE_VERSION}_`

/** Событие после обновления rateMap (фоновая ревалидация или сброс кеша). */
export const FX_RATES_UPDATED_EVENT = 'gostaylo:fx-rates-updated'

/** Согласовано с EXCHANGE_RATES_DB_TTL_MS на сервере (ADR / ARCHITECTURAL_DECISIONS). */
const EXCHANGE_RATES_TTL_MS = 2 * 60 * 60 * 1000

function getCache(key) {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.expiresAt !== 'number') return null
    if (Date.now() > parsed.expiresAt) return null
    return parsed.value
  } catch {
    return null
  }
}

function setCache(key, value, ttlMs) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ value, expiresAt: Date.now() + ttlMs }))
  } catch {
    // ignore quota / privacy mode
  }
}

function removeCache(key) {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(CACHE_PREFIX + key)
  } catch {
    /* ignore */
  }
}

/** Сброс FX в localStorage (после смены chatInvoiceRateMultiplier в админке). */
export function invalidateExchangeRatesCache() {
  removeCache('exchange_rates_retail_bundle')
  removeCache('exchange_rates_mid_bundle')
  // legacy v3 keys (до bundle)
  removeCache('exchange_rates_retail')
  removeCache('exchange_rates_mid')
  if (typeof window !== 'undefined') {
    void import('@/lib/hooks/use-fx-rates-query').then((m) => m.invalidateFxRatesQueriesOnly())
  }
}

function dispatchFxRatesUpdated(rateMap) {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(FX_RATES_UPDATED_EVENT, { detail: rateMap }))
  } catch {
    /* ignore */
  }
}

export async function fetchCategories() {
  return dedupeClientRequest(
    CACHE_KEY.categories,
    async () => {
      try {
        const res = await fetch('/api/v2/categories', { cache: 'default' })
        const json = await res.json()
        if (json.success && json.data) {
          const mapped = json.data
            .filter((c) => c && (c.isActive === true || c.is_active === true))
            .map((c) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
              icon: c.icon,
              order: c.order,
              isActive: c.isActive ?? true,
              isComingSoon: c.isComingSoon === true,
              isPreviewOnly: c.isPreviewOnly === true,
              isPreview: c.isPreview === true,
              wizardProfile: c.wizardProfile ?? c.wizard_profile ?? null,
              parentId: c.parentId ?? c.parent_id ?? null,
              nameI18n: c.nameI18n ?? c.name_i18n ?? null,
            }))
          return mapped
        }
        return []
      } catch (error) {
        console.error('[CLIENT] Categories fetch error:', error)
        return []
      }
    },
    { ttlMs: TTL_CATEGORIES_MS },
  )
}

/** THB-only placeholder until /api/v2/exchange-rates returns rateMap */
const THB_ONLY_RATES = { THB: 1 }

function isCompleteDisplayRateMap(obj) {
  if (!obj || typeof obj !== 'object' || obj.THB !== 1) return false
  const usd = Number(obj.USD)
  return Number.isFinite(usd) && usd > 0
}

/**
 * @param {{ force?: boolean }} [options] — force=true: игнорировать localStorage (после F5 на вкладке)
 */
export async function fetchExchangeRates(options = {}) {
  const force = options.force === true
  const retail = options.retail !== false
  const bundleKey = retail ? 'exchange_rates_retail_bundle' : 'exchange_rates_mid_bundle'
  const retailQuery = retail ? '1' : '0'
  try {
    if (!force) {
      const cached = getCache(bundleKey)
      if (cached?.rateMap && isCompleteDisplayRateMap(cached.rateMap)) {
        void revalidateExchangeRatesBundle(bundleKey, retailQuery, cached)
        return cached.rateMap
      }
    }

    return await fetchAndCacheExchangeRates(bundleKey, retailQuery, retail)
  } catch (error) {
    console.error('[CLIENT] Exchange rates fetch error:', error)
    return THB_ONLY_RATES
  }
}

async function fetchAndCacheExchangeRates(bundleKey, retailQuery, retail) {
  const res = await fetch(`/api/v2/exchange-rates?retail=${retailQuery}`, { cache: 'no-store' })
  const json = await res.json()
  if (json.success && json.rateMap && typeof json.rateMap === 'object') {
    const rates = { THB: 1, ...json.rateMap }
    const bundle = {
      rateMap: rates,
      retailMarkupMultiplier: retail ? Number(json.retailMarkupMultiplier) : null,
      ratesUpdatedAt: json.ratesUpdatedAt ?? null,
    }
    setCache(bundleKey, bundle, EXCHANGE_RATES_TTL_MS)
    return rates
  }
  console.warn('[CLIENT] Exchange rates API missing rateMap')
  return THB_ONLY_RATES
}

/** Фоновая проверка: сменился retailMarkupMultiplier или mid-курсы — обновить кеш и UI. */
async function revalidateExchangeRatesBundle(bundleKey, retailQuery, cached) {
  try {
    const res = await fetch(`/api/v2/exchange-rates?retail=${retailQuery}`, { cache: 'no-store' })
    const json = await res.json()
    if (!json.success || !json.rateMap) return
    const retail = retailQuery === '1'
    const newMult = retail ? Number(json.retailMarkupMultiplier) : null
    const multChanged =
      retail &&
      Number.isFinite(newMult) &&
      Number.isFinite(Number(cached.retailMarkupMultiplier)) &&
      newMult !== Number(cached.retailMarkupMultiplier)
    const ratesChanged = json.ratesUpdatedAt && json.ratesUpdatedAt !== cached.ratesUpdatedAt
    if (!multChanged && !ratesChanged) return

    const rates = { THB: 1, ...json.rateMap }
    setCache(
      bundleKey,
      {
        rateMap: rates,
        retailMarkupMultiplier: newMult,
        ratesUpdatedAt: json.ratesUpdatedAt ?? null,
      },
      EXCHANGE_RATES_TTL_MS,
    )
    dispatchFxRatesUpdated(rates)
  } catch {
    /* ignore background errors */
  }
}

export function fetchDistricts() {
  return DISTRICTS
}

// ============================================================================
// ADMIN DATA (Stage 94 prep): только /api/admin/* + cookie, без anon /_db
// ============================================================================

let _overviewInflight = null

async function fetchAdminMetricsOverviewData() {
  if (_overviewInflight) return await _overviewInflight
  _overviewInflight = (async () => {
    const res = await fetch('/api/admin/metrics/overview', {
      credentials: 'include',
      cache: 'no-store',
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.success || !json.data) {
      const err = new Error(json.error || 'overview_failed')
      err.status = res.status
      throw err
    }
    return json.data
  })()
  try {
    return await _overviewInflight
  } finally {
    _overviewInflight = null
  }
}

/**
 * Одним запросом: счётчики таблиц, seed-профиль, агрегаты (для /admin/test-db).
 */
export async function fetchAdminDiagnosticsBundle() {
  const [overview, categories] = await Promise.all([
    fetchAdminMetricsOverviewData().catch(() => null),
    fetchCategories(),
  ])

  if (!overview) {
    return {
      dbStatus: {
        connected: false,
        url: '/api/admin/metrics/overview',
        adminUser: null,
        tableCounts: {},
      },
      stats: null,
      categories,
    }
  }

  const s = overview.seedAdminProfile
  const adminUser = s
    ? {
        id: s.id,
        email: s.email,
        role: s.role,
        name: `${s.first_name || ''} ${s.last_name || ''}`.trim(),
      }
    : null

  const st = overview.adminStats
  const stats = st
    ? {
        users: {
          total: st.users?.total ?? 0,
          admins: st.users?.admins ?? 0,
          partners: st.users?.partners ?? 0,
          renters: st.users?.renters ?? 0,
        },
        listings: {
          total: st.listings?.total ?? 0,
          active: st.listings?.active ?? 0,
          pending: st.listings?.pending ?? 0,
        },
        bookings: {
          total: st.bookings?.total ?? 0,
          confirmed: st.bookings?.confirmed ?? 0,
          pending: st.bookings?.pending ?? 0,
          completed: st.bookings?.completed ?? 0,
        },
      }
    : null

  const tc = overview.tableCounts || {}
  const connected = !Object.values(tc).every((v) => v === 'error')

  return {
    dbStatus: {
      connected,
      url: '/api/admin/metrics/overview',
      adminUser,
      tableCounts: tc,
    },
    stats,
    categories,
  }
}

/** @deprecated Prefer fetchAdminDiagnosticsBundle (один round-trip). */
export async function fetchDatabaseStatus() {
  try {
    const d = await fetchAdminMetricsOverviewData()
    const tc = d.tableCounts || {}
    return {
      dataProxyBase: '/api/admin/metrics/overview',
      tableCounts: tc,
    }
  } catch {
    return { dataProxyBase: null, tableCounts: {} }
  }
}

/** @deprecated Prefer fetchAdminDiagnosticsBundle. */
export async function fetchAdminUser() {
  try {
    const d = await fetchAdminMetricsOverviewData()
    const s = d.seedAdminProfile
    if (!s) return null
    return {
      id: s.id,
      email: s.email,
      role: s.role,
      name: `${s.first_name || ''} ${s.last_name || ''}`.trim(),
    }
  } catch {
    return null
  }
}

/** @deprecated Prefer fetchAdminDiagnosticsBundle. */
export async function fetchAdminStats() {
  try {
    const d = await fetchAdminMetricsOverviewData()
    const st = d.adminStats
    if (!st) return null
    return {
      users: {
        total: st.users?.total ?? 0,
        admins: st.users?.admins ?? 0,
        partners: st.users?.partners ?? 0,
        renters: st.users?.renters ?? 0,
      },
      listings: {
        total: st.listings?.total ?? 0,
        active: st.listings?.active ?? 0,
        pending: st.listings?.pending ?? 0,
      },
      bookings: {
        total: st.bookings?.total ?? 0,
        confirmed: st.bookings?.confirmed ?? 0,
        pending: st.bookings?.pending ?? 0,
        completed: st.bookings?.completed ?? 0,
      },
    }
  } catch {
    return null
  }
}

export async function fetchAllCategories() {
  return fetchCategories()
}
