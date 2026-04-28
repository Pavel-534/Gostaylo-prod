/**
 * Лента событий команды — чтение из `referral_team_events` (SSOT).
 */

import { formatPrivacyDisplayNameForParticipant } from '@/lib/utils/name-formatter'
import { isUuidLike } from '@/lib/referral/uuid-like'
import { encodeReferralActivityCursor } from '@/lib/referral/referral-activity-cursor'

function parseTs(iso) {
  const n = iso ? Date.parse(iso) : NaN
  return Number.isFinite(n) ? n : 0
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {string} referrerId
 * @param {{ limit?: number, offset?: number }} options
 * @returns {Promise<{ items: Array<Record<string, unknown>>, total: number, nextCursor: string | null }>}
 */
export async function buildReferralActivityFeed(supabaseAdmin, referrerId, options = {}) {
  const limit = Math.min(50, Math.max(1, Math.floor(Number(options.limit) || 15)))
  const offset = Math.max(0, Math.floor(Number(options.offset) || 0))

  if (!supabaseAdmin || !referrerId) {
    return { items: [], total: 0, nextCursor: null }
  }

  const { count: totalRaw, error: countErr } = await supabaseAdmin
    .from('referral_team_events')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_id', referrerId)

  if (countErr) {
    console.warn('[referral activity feed]', countErr.message)
    return { items: [], total: 0, nextCursor: null }
  }

  const total = Number(totalRaw) || 0

  const { data: events, error: evErr } = await supabaseAdmin
    .from('referral_team_events')
    .select('id,event_type,referee_id,metadata,created_at')
    .eq('referrer_id', referrerId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (evErr) {
    console.warn('[referral activity feed]', evErr.message)
    return { items: [], total: 0, nextCursor: null }
  }

  const refereeIds = [
    ...new Set((events || []).map((e) => String(e.referee_id || '').trim()).filter(Boolean)),
  ]

  let nameById = {}
  if (refereeIds.length) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email')
      .in('id', refereeIds)
    for (const p of profiles || []) {
      nameById[String(p.id)] = formatPrivacyDisplayNameForParticipant(p.first_name, p.last_name, p.email, '')
    }
  }

  const items = (events || []).map((e) => {
    const refereeId = e.referee_id ? String(e.referee_id) : ''
    const meta = e.metadata && typeof e.metadata === 'object' ? e.metadata : {}
    let fromMetaName = String(meta.displayName || meta.display_name || '').trim()
    if (isUuidLike(fromMetaName) || (refereeId && fromMetaName === refereeId)) fromMetaName = ''
    let displayName = fromMetaName || (refereeId ? nameById[refereeId] || '' : '')
    if (isUuidLike(displayName) || (refereeId && displayName === refereeId)) {
      displayName = refereeId ? nameById[refereeId] || '' : ''
    }
    if (isUuidLike(displayName)) displayName = ''

    const at = e.created_at
    const type = String(e.event_type || '')

    /** @type {Record<string, unknown>} */
    const outMeta = { ...meta }
    if (type === 'teammate_first_stay' && outMeta.bonusThb == null && meta.amountThb != null) {
      outMeta.bonusThb = meta.amountThb
    }
    if (type === 'referral_bonus_earned') {
      outMeta.amountThb = Number(meta.amountThb ?? meta.amount_thb ?? 0) || 0
    }

    return {
      type,
      at,
      refereeId,
      displayName,
      meta: outMeta,
    }
  })

  items.sort((a, b) => parseTs(b.at) - parseTs(a.at))

  const nextOffset = offset + items.length
  const nextCursor = nextOffset < total ? encodeReferralActivityCursor(nextOffset) : null

  return { items, total, nextCursor }
}
