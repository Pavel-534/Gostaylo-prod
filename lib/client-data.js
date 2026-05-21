/**
 * GoStayLo - Client-side Data Fetching
 * Каталог/курсы — через same-origin API (без anon PostgREST к чувствительным таблицам).
 * Админ-диагностика — GET /api/admin/metrics/overview (cookie + service_role на сервере).
 */

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

/** Bump при смене формата кеша (108.4: сброс устаревших FX на десктопе). */
const CACHE_VERSION = 3
const CACHE_PREFIX = `gostaylo_cache_v${CACHE_VERSION}_`

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

export async function fetchCategories() {
  try {
    const res = await fetch('/api/v2/categories', { cache: 'no-store' })
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
  const cacheKey = retail ? 'exchange_rates_retail' : 'exchange_rates_mid'
  const retailQuery = retail ? '1' : '0'
  try {
    if (!force) {
      const cached = getCache(cacheKey)
      if (isCompleteDisplayRateMap(cached)) return cached
    }

    const res = await fetch(`/api/v2/exchange-rates?retail=${retailQuery}`, { cache: 'no-store' })
    const json = await res.json()
    if (json.success && json.rateMap && typeof json.rateMap === 'object') {
      const rates = { THB: 1, ...json.rateMap }
      setCache(cacheKey, rates, EXCHANGE_RATES_TTL_MS)
      return rates
    }
    console.warn('[CLIENT] Exchange rates API missing rateMap')
    return THB_ONLY_RATES
  } catch (error) {
    console.error('[CLIENT] Exchange rates fetch error:', error)
    return THB_ONLY_RATES
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
