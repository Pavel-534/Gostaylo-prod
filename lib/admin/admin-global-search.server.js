/**
 * Stage 118.5 — серверный поиск для админки (ранжирование + контекст).
 */
import { supabaseAdmin } from '@/lib/supabase'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * @param {string} raw
 */
export function detectAdminSearchMode(raw) {
  const q = String(raw || '').trim()
  if (!q) return { mode: 'empty', query: '' }
  if (q.includes('@')) return { mode: 'email', query: q.replace(/^@+/, '') }
  if (/^book(ing)?-/i.test(q)) return { mode: 'booking_prefix', query: q }
  if (/^listing-/i.test(q) || /^lst-/i.test(q)) return { mode: 'listing_prefix', query: q }
  if (UUID_RE.test(q)) return { mode: 'uuid', query: q }
  if (q.length >= 2) return { mode: 'text', query: q }
  return { mode: 'short', query: q }
}

/**
 * @param {string | null | undefined} first
 * @param {string | null | undefined} last
 */
function profileDisplayName(first, last) {
  return [first, last].filter(Boolean).join(' ').trim()
}

/**
 * @param {{ first_name?: string, last_name?: string, email?: string }} row
 */
function formatProfileLabel(row) {
  const name = profileDisplayName(row.first_name, row.last_name)
  if (name && row.email) return `${name} • ${row.email}`
  return row.email || name || 'Пользователь'
}

/**
 * @param {string} haystack
 * @param {string} needle
 */
function scoreTextMatch(haystack, needle, weights = { exact: 100, starts: 80, contains: 45 }) {
  const h = String(haystack || '').toLowerCase()
  const n = String(needle || '').toLowerCase()
  if (!h || !n) return 0
  if (h === n) return weights.exact
  if (h.startsWith(n)) return weights.starts
  if (h.includes(n)) return weights.contains
  return 0
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @param {string} q
 * @param {string} mode
 */
function rankAdminSearchResults(rows, q, mode) {
  const needle = String(q || '').trim().toLowerCase()
  const ranked = rows.map((row) => {
    let score = Number(row.score) || 0
    if (mode === 'uuid' && String(row.id).toLowerCase() === needle) score += 120
    if (row.type === 'profile') {
      score += scoreTextMatch(row.email, needle)
      score += scoreTextMatch(row.title, needle, { exact: 90, starts: 70, contains: 40 })
    }
    if (row.type === 'booking') {
      score += scoreTextMatch(row.id, needle, { exact: 110, starts: 95, contains: 50 })
    }
    if (row.type === 'listing') {
      score += scoreTextMatch(row.id, needle, { exact: 105, starts: 90, contains: 48 })
      score += scoreTextMatch(row.title, needle, { exact: 85, starts: 65, contains: 35 })
    }
    return { ...row, score }
  })
  ranked.sort((a, b) => (b.score || 0) - (a.score || 0) || String(a.title).localeCompare(String(b.title)))
  return ranked
}

/**
 * @param {string} query
 * @param {{ limit?: number }} [opts]
 */
export async function runAdminGlobalSearch(query, opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit) || 12, 1), 25)
  if (!supabaseAdmin) {
    return { results: [], error: 'no_db' }
  }

  const { mode, query: q } = detectAdminSearchMode(query)
  if (mode === 'empty' || mode === 'short') {
    return { results: [], mode }
  }

  /** @type {Array<Record<string, unknown>>} */
  const bucket = []

  async function pushProfiles(filterFn, baseScore = 0) {
    const { data, error } = await filterFn()
    if (error || !Array.isArray(data)) return
    for (const row of data) {
      bucket.push({
        type: 'profile',
        id: row.id,
        title: formatProfileLabel(row),
        subtitle: row.role ? String(row.role) : 'Профиль',
        context: row.email || undefined,
        href: `/admin/users/${row.id}`,
        score: baseScore,
        email: row.email,
      })
    }
  }

  async function pushBookings(filterFn, baseScore = 0) {
    const { data, error } = await filterFn()
    if (error || !Array.isArray(data)) return
    for (const row of data) {
      bucket.push({
        type: 'booking',
        id: row.id,
        title: `Бронь ${String(row.id).slice(0, 8)}…`,
        subtitle: row.status ? String(row.status) : 'Бронирование',
        context: row.id,
        href: `/admin/bookings/${row.id}`,
        score: baseScore,
      })
    }
  }

  async function pushListings(filterFn, baseScore = 0) {
    const { data, error } = await filterFn()
    if (error || !Array.isArray(data)) return
    for (const row of data) {
      const title = row.title ? String(row.title).slice(0, 64) : `Объявление ${String(row.id).slice(0, 8)}…`
      bucket.push({
        type: 'listing',
        id: row.id,
        title,
        subtitle: row.status ? String(row.status) : 'Listing',
        context: row.id,
        href: `/listings/${row.id}`,
        score: baseScore,
      })
    }
  }

  if (mode === 'email') {
    await pushProfiles(
      () =>
        supabaseAdmin
          .from('profiles')
          .select('id,email,first_name,last_name,role')
          .ilike('email', `%${q}%`)
          .limit(limit),
      60,
    )
    return { results: rankAdminSearchResults(bucket, q, mode).slice(0, limit), mode }
  }

  if (mode === 'booking_prefix') {
    const id = q.replace(/^book(ing)?-/i, '')
    await pushBookings(
      () => supabaseAdmin.from('bookings').select('id,status').ilike('id', `${id}%`).limit(limit),
      70,
    )
    return { results: rankAdminSearchResults(bucket, q, mode).slice(0, limit), mode }
  }

  if (mode === 'listing_prefix') {
    const id = q.replace(/^listing-/i, '').replace(/^lst-/i, '')
    await pushListings(
      () => supabaseAdmin.from('listings').select('id,title,status').ilike('id', `${id}%`).limit(limit),
      70,
    )
    return { results: rankAdminSearchResults(bucket, q, mode).slice(0, limit), mode }
  }

  if (mode === 'uuid') {
    await Promise.all([
      pushProfiles(
        () =>
          supabaseAdmin
            .from('profiles')
            .select('id,email,first_name,last_name,role')
            .eq('id', q)
            .limit(1),
        100,
      ),
      pushBookings(() => supabaseAdmin.from('bookings').select('id,status').eq('id', q).limit(1), 100),
      pushListings(() => supabaseAdmin.from('listings').select('id,title,status').eq('id', q).limit(1), 100),
    ])
    return { results: rankAdminSearchResults(bucket, q, mode).slice(0, limit), mode }
  }

  await Promise.all([
    pushProfiles(
      () =>
        supabaseAdmin
          .from('profiles')
          .select('id,email,first_name,last_name,role')
          .or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
          .limit(limit),
      30,
    ),
    pushBookings(
      () => supabaseAdmin.from('bookings').select('id,status').ilike('id', `%${q}%`).limit(limit),
      20,
    ),
    pushListings(
      () =>
        supabaseAdmin
          .from('listings')
          .select('id,title,status')
          .or(`id.ilike.%${q}%,title.ilike.%${q}%`)
          .limit(limit),
      20,
    ),
  ])

  return { results: rankAdminSearchResults(bucket, q, mode).slice(0, limit), mode }
}
