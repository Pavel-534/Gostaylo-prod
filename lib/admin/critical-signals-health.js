/**
 * Stage 142 — critical_signal_events viewer for /admin/health (read-only).
 */
import { supabaseAdmin } from '@/lib/supabase'

import { CRITICAL_SIGNAL_KEYS } from '@/lib/admin/critical-signal-keys.js'

const CRITICAL_MISSING = "Could not find the table 'public.critical_signal_events'"

const LINE_PATTERNS = [
  { key: 'listing', re: /listing:\s*(\S+)/i, build: (id) => ({ label: 'Listing', href: `/listings/${encodeURIComponent(id)}` }) },
  { key: 'renter', re: /renter:\s*(\S+)/i, build: (id) => (id === '—' ? null : { label: 'Renter', href: `/admin/users/${encodeURIComponent(id)}` }) },
  { key: 'booking', re: /booking(?:Id)?:\s*(\S+)/i, build: (id) => ({ label: 'Booking', href: `/admin/bookings/${encodeURIComponent(id)}` }) },
  { key: 'partner', re: /partner(?:Id)?:\s*(\S+)/i, build: (id) => (id === '—' ? null : { label: 'Partner', href: `/admin/users/${encodeURIComponent(id)}` }) },
]

/**
 * @param {unknown} detail
 * @param {string} signalKey
 */
export function resolveCriticalSignalLinks(detail, signalKey) {
  const links = []
  const seen = new Set()
  const add = (link) => {
    if (!link?.href || seen.has(link.href)) return
    seen.add(link.href)
    links.push(link)
  }

  const d = detail && typeof detail === 'object' && !Array.isArray(detail) ? detail : {}
  const lines = Array.isArray(d.detailLines) ? d.detailLines.map(String) : []

  for (const line of lines) {
    for (const pat of LINE_PATTERNS) {
      const m = line.match(pat.re)
      if (m?.[1]) {
        const built = pat.build(m[1])
        if (built) add(built)
      }
    }
  }

  const persistIds = [
    ['bookingId', 'Booking', (id) => `/admin/bookings/${encodeURIComponent(id)}`],
    ['listingId', 'Listing', (id) => `/listings/${encodeURIComponent(id)}`],
    ['renterId', 'Renter', (id) => `/admin/users/${encodeURIComponent(id)}`],
    ['partnerId', 'Partner', (id) => `/admin/users/${encodeURIComponent(id)}`],
    ['refereeId', 'Referee', (id) => `/admin/users/${encodeURIComponent(id)}`],
  ]
  for (const [field, label, hrefFn] of persistIds) {
    const raw = d[field]
    if (raw != null && String(raw).trim() && String(raw) !== '—') {
      add({ label, href: hrefFn(String(raw)) })
    }
  }

  if (signalKey === 'CONTACT_LEAK_ATTEMPT' && d.senderId) {
    add({ label: 'Sender', href: `/admin/users/${encodeURIComponent(String(d.senderId))}` })
  }

  return links
}

/** @param {unknown} detail */
export function formatCriticalSignalDetail(detail) {
  if (detail == null) return '—'
  if (typeof detail === 'string') return detail.slice(0, 2000)
  try {
    const s = JSON.stringify(detail, null, 2)
    return s.length > 4000 ? `${s.slice(0, 4000)}\n…` : s
  } catch {
    return String(detail)
  }
}

/** @param {unknown} detail @param {string} q */
export function criticalSignalMatchesSearch(detail, signalKey, q) {
  const needle = String(q || '').trim().toLowerCase()
  if (!needle) return true
  const hay = `${signalKey} ${formatCriticalSignalDetail(detail)}`.toLowerCase()
  return hay.includes(needle)
}

/**
 * @param {{
 *   sinceIso: string,
 *   signalKey?: string | null,
 *   search?: string | null,
 *   limit?: number,
 * }} opts
 */
export async function loadCriticalSignalsHealth(opts) {
  const sinceIso = opts.sinceIso
  const limit = Math.min(Math.max(1, Number(opts.limit) || 40), 100)
  const filterKey = opts.signalKey ? String(opts.signalKey).trim().toUpperCase() : null
  const search = opts.search ? String(opts.search).trim() : ''

  if (!supabaseAdmin?.from) {
    return {
      error: 'supabase_admin_missing',
      countsByKey: {},
      events: [],
      totalInWindow: 0,
    }
  }

  /** @type {Record<string, number>} */
  const countsByKey = {}
  for (const key of CRITICAL_SIGNAL_KEYS) {
    const { count, error } = await supabaseAdmin
      .from('critical_signal_events')
      .select('id', { count: 'exact', head: true })
      .eq('signal_key', key)
      .gte('created_at', sinceIso)

    if (error) {
      if (String(error.message || '').includes(CRITICAL_MISSING)) {
        return {
          tablePresent: false,
          error: null,
          countsByKey: {},
          events: [],
          totalInWindow: 0,
        }
      }
      countsByKey[key] = 0
    } else {
      countsByKey[key] = Number(count || 0)
    }
  }

  let query = supabaseAdmin
    .from('critical_signal_events')
    .select('id, signal_key, created_at, detail')
    .gte('created_at', sinceIso)
    .in('signal_key', filterKey ? [filterKey] : CRITICAL_SIGNAL_KEYS)
    .order('created_at', { ascending: false })
    .limit(filterKey && !search ? limit : 120)

  const { data: rows, error: fetchErr } = await query

  if (fetchErr) {
    if (String(fetchErr.message || '').includes(CRITICAL_MISSING)) {
      return {
        tablePresent: false,
        error: null,
        countsByKey: {},
        events: [],
        totalInWindow: 0,
      }
    }
    return {
      error: fetchErr.message,
      countsByKey,
      events: [],
      totalInWindow: 0,
    }
  }

  const raw = Array.isArray(rows) ? rows : []
  const filtered = raw
    .filter((row) => criticalSignalMatchesSearch(row?.detail, row?.signal_key, search))
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      signalKey: row.signal_key,
      createdAt: row.created_at,
      detail: row.detail,
      detailText: formatCriticalSignalDetail(row.detail),
      links: resolveCriticalSignalLinks(row.detail, row.signal_key),
    }))

  const totalInWindow = Object.values(countsByKey).reduce((a, n) => a + n, 0)

  return {
    tablePresent: true,
    error: null,
    countsByKey,
    totalInWindow,
    priceTamperingCount: countsByKey.PRICE_TAMPERING ?? 0,
    events: filtered,
    filterKey: filterKey || 'all',
    search,
  }
}
