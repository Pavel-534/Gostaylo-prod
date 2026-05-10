/**
 * Журнал действий персонала в **`critical_signal_events`** (Stage 90.2).
 * Ключи не пересекаются с security-сигналами (**PRICE_TAMPERING** и т.д.).
 */

/** @typedef {'approve' | 'reject' | 'set_featured'} ListingModerationAction */

export const STAFF_AUDIT_SIGNAL_KEYS = {
  LISTING_MODERATION: 'STAFF_LISTING_MODERATION',
  USER_VERIFICATION: 'STAFF_USER_VERIFICATION',
}

const CRITICAL_MISSING = "Could not find the table 'public.critical_signal_events'"

async function insertSignal(signalKey, detail) {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase')
    if (!supabaseAdmin?.from) return
    const { error } = await supabaseAdmin.from('critical_signal_events').insert({
      signal_key: String(signalKey),
      detail: detail && typeof detail === 'object' ? detail : {},
    })
    if (error && !String(error.message || '').includes(CRITICAL_MISSING)) {
      console.warn('[staff-audit]', signalKey, error.message)
    }
  } catch (e) {
    console.warn('[staff-audit]', signalKey, e?.message || e)
  }
}

/**
 * @param {{ actorId: string, actorRole?: string | null, listingId: string, action: ListingModerationAction, listingTitle?: string | null, ownerId?: string | null, isFeatured?: boolean }} p
 */
export async function recordStaffListingModeration(p) {
  const listingId = p.listingId && String(p.listingId).trim()
  const actorId = p.actorId && String(p.actorId).trim()
  if (!listingId || !actorId) return
  await insertSignal(STAFF_AUDIT_SIGNAL_KEYS.LISTING_MODERATION, {
    actorId,
    actorRole: p.actorRole ? String(p.actorRole).toUpperCase() : null,
    listingId,
    action: p.action,
    listingTitle: p.listingTitle ? String(p.listingTitle).slice(0, 200) : null,
    ownerId: p.ownerId ? String(p.ownerId) : null,
    isFeatured: typeof p.isFeatured === 'boolean' ? p.isFeatured : undefined,
    recordedAt: new Date().toISOString(),
  })
}

/**
 * @param {{ actorId: string, actorRole?: string | null, targetUserId: string, updates: { is_verified?: boolean, verification_status?: string } }} p
 */
export async function recordStaffUserVerificationUpdate(p) {
  const actorId = p.actorId && String(p.actorId).trim()
  const targetUserId = p.targetUserId && String(p.targetUserId).trim()
  if (!actorId || !targetUserId) return
  await insertSignal(STAFF_AUDIT_SIGNAL_KEYS.USER_VERIFICATION, {
    actorId,
    actorRole: p.actorRole ? String(p.actorRole).toUpperCase() : null,
    targetUserId,
    is_verified: p.updates?.is_verified,
    verification_status: p.updates?.verification_status
      ? String(p.updates.verification_status).toUpperCase()
      : undefined,
    recordedAt: new Date().toISOString(),
  })
}

function formatPersonName(p) {
  if (!p || typeof p !== 'object') return null
  const a = [p.first_name, p.last_name].map((x) => String(x || '').trim()).filter(Boolean)
  if (a.length) return a.join(' ')
  if (p.email) return String(p.email)
  return null
}

/** @param {string | null | undefined} role */
function staffLabelRu(role) {
  const r = String(role || '').toUpperCase()
  if (r === 'ADMIN') return 'Администратор'
  return 'Модератор'
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {{ limit?: number }} opts
 */
export async function loadStaffAuditFeed(supabaseAdmin, opts = {}) {
  const limit = Math.min(80, Math.max(1, Number(opts.limit) || 35))
  const keys = [
    'SYSTEM_AUTO_VERIFICATION',
    STAFF_AUDIT_SIGNAL_KEYS.LISTING_MODERATION,
    STAFF_AUDIT_SIGNAL_KEYS.USER_VERIFICATION,
  ]

  const { data: rows, error } = await supabaseAdmin
    .from('critical_signal_events')
    .select('id, signal_key, created_at, detail')
    .in('signal_key', keys)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (String(error.message || '').includes(CRITICAL_MISSING)) {
      return { feedItems: [], auditLogAvailable: false, auditLogError: null }
    }
    return { feedItems: [], auditLogAvailable: false, auditLogError: error.message }
  }

  const idSet = new Set()
  for (const row of rows || []) {
    const d = row?.detail && typeof row.detail === 'object' ? row.detail : {}
    const ids = [d.actorId, d.userId, d.targetUserId, d.ownerId]
    for (const x of ids) {
      if (x && String(x).length > 10) idSet.add(String(x))
    }
  }
  const ids = [...idSet]
  let profileById = new Map()
  if (ids.length > 0 && supabaseAdmin) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email, role')
      .in('id', ids)
    for (const pr of profiles || []) {
      profileById.set(String(pr.id), pr)
    }
  }

  const feedItems = (rows || []).map((row) => {
    const d = row.detail && typeof row.detail === 'object' ? row.detail : {}
    const key = String(row.signal_key || '')
    const createdAt = row.created_at
    const actor = d.actorId ? profileById.get(String(d.actorId)) : null
    const actorName = formatPersonName(actor) || 'сотрудник'
    const actorRole = d.reviewedByRole || d.actorRole || actor?.role

    let summaryRu = 'Событие персонала'
    if (key === 'SYSTEM_AUTO_VERIFICATION') {
      const target = d.userId ? profileById.get(String(d.userId)) : null
      const targetName = formatPersonName(target) || 'пользователь'
      const L = staffLabelRu(actorRole)
      summaryRu = `${L} ${actorName} одобрил партнёрскую заявку пользователя ${targetName}.`
    } else if (key === STAFF_AUDIT_SIGNAL_KEYS.LISTING_MODERATION) {
      const title = (d.listingTitle && String(d.listingTitle).trim()) || 'объявление'
      const L = staffLabelRu(actorRole)
      if (d.action === 'approve') {
        summaryRu = `${L} ${actorName} опубликовал объявление «${title}».`
      } else if (d.action === 'reject') {
        summaryRu = `${L} ${actorName} отклонил объявление «${title}».`
      } else if (d.action === 'set_featured') {
        const on = d.isFeatured === true
        summaryRu = `${L} ${actorName} ${on ? 'добавил в подборку' : 'убрал из подборки'} объявление «${title}».`
      } else {
        summaryRu = `${L} ${actorName} изменил объявление «${title}».`
      }
    } else if (key === STAFF_AUDIT_SIGNAL_KEYS.USER_VERIFICATION) {
      const target = d.targetUserId ? profileById.get(String(d.targetUserId)) : null
      const targetName = formatPersonName(target) || 'пользователь'
      const L = staffLabelRu(actorRole)
      const vs = d.verification_status ? String(d.verification_status) : ''
      const iv = d.is_verified === true
      let statusPhrase = 'обновил данные верификации'
      if (vs === 'VERIFIED' || iv) statusPhrase = 'подтвердил верификацию профиля'
      else if (vs === 'REJECTED') statusPhrase = 'отклонил верификацию профиля'
      summaryRu = `${L} ${actorName} ${statusPhrase} для ${targetName}.`
    }

    return {
      id: row.id,
      signalKey: key,
      createdAt,
      summaryRu,
      detail: d,
    }
  })

  return { feedItems, auditLogAvailable: true, auditLogError: null }
}
