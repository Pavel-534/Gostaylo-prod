/**
 * Stage 17.0 + 20.0 — log partner "initial response" delay (fair SLA: quiet hours excluded).
 * Server-only. Requires migration `040_partner_performance_logs.sql`.
 */

import { supabaseAdmin } from '@/lib/supabase'
import {
  resolvePartnerQuietContext,
  adjustResponseDelayMsForQuietHours,
} from '@/lib/services/availability.service'

const MIN_MS = 5000
const MAX_MS = 7 * 24 * 60 * 60 * 1000

function isPartnerSenderRow(m, partnerId) {
  const pid = String(partnerId || '')
  const sid = m?.sender_id != null ? String(m.sender_id) : ''
  if (sid && sid === pid) return true
  return String(m?.sender_role || '').toUpperCase() === 'PARTNER'
}

function isRenterSenderRow(m, renterId) {
  const rid = String(renterId || '')
  const sid = m?.sender_id != null ? String(m.sender_id) : ''
  if (sid && sid === rid) return true
  return String(m?.sender_role || '').toUpperCase() === 'RENTER'
}

/**
 * After a partner message is persisted, if it is the first partner reply since the guest's last turn,
 * insert one row into `partner_performance_logs` (idempotent per renter anchor message).
 *
 * @param {object} p
 * @param {object} p.conversation — row from `conversations` (snake_case ids)
 * @param {string} p.partnerUserId
 * @param {string} p.partnerMessageId
 * @param {string} p.partnerMessageCreatedAt — ISO
 */
export async function tryLogPartnerInitialResponseAfterMessage({
  conversation,
  partnerUserId,
  partnerMessageId,
  partnerMessageCreatedAt,
}) {
  if (!supabaseAdmin || !conversation?.id) return

  const partnerId = conversation.partner_id != null ? String(conversation.partner_id) : ''
  const renterId = conversation.renter_id != null ? String(conversation.renter_id) : ''
  if (!partnerId || !renterId || String(partnerUserId) !== partnerId) return

  const { data: rows, error } = await supabaseAdmin
    .from('messages')
    .select('id, sender_id, sender_role, created_at, type')
    .eq('conversation_id', String(conversation.id))
    .order('created_at', { ascending: false })
    .limit(40)

  if (error) {
    if (!/partner_performance_logs|does not exist/i.test(error.message || '')) {
      console.warn('[partner-response-performance] messages fetch', error.message)
    }
    return
  }
  if (!rows?.length) return

  const selfIdx = rows.findIndex((r) => String(r.id) === String(partnerMessageId))
  if (selfIdx !== 0) return

  let anchor = null
  for (let i = selfIdx + 1; i < rows.length; i++) {
    const m = rows[i]
    if (isPartnerSenderRow(m, partnerId)) return
    if (isRenterSenderRow(m, renterId)) {
      anchor = m
      break
    }
  }
  if (!anchor?.created_at) return

  const t0 = new Date(anchor.created_at).getTime()
  const t1 = new Date(partnerMessageCreatedAt).getTime()
  const rawMs = t1 - t0
  if (!Number.isFinite(rawMs) || rawMs < MIN_MS || rawMs > MAX_MS) return

  let ms = rawMs
  try {
    const bookingId = conversation.booking_id != null ? String(conversation.booking_id) : ''
    if (bookingId) {
      const ctx = await resolvePartnerQuietContext(partnerId, { bookingId })
      ms = adjustResponseDelayMsForQuietHours(t0, t1, ctx)
    }
  } catch {
    ms = rawMs
  }
  if (!Number.isFinite(ms) || ms < MIN_MS || ms > MAX_MS) return

  const { error: insErr } = await supabaseAdmin.from('partner_performance_logs').insert({
    partner_id: partnerId,
    conversation_id: String(conversation.id),
    renter_message_id: String(anchor.id),
    partner_message_id: String(partnerMessageId),
    response_time_ms: Math.round(ms),
  })

  if (insErr) {
    const code = insErr.code || insErr?.details
    if (code === '23505' || /duplicate|unique/i.test(insErr.message || '')) return
    if (/partner_performance_logs|does not exist|42P01/i.test(insErr.message || '')) return
    console.warn('[partner-response-performance] insert', insErr.message)
  }
}

/**
 * Rolling-window aggregates for reputation + search (last 30 days).
 * @param {string[]} partnerIds
 * @returns {Promise<Map<string, { avgMinutes: number | null, count: number }>>}
 */
export async function getSlaMetricsForPartners30d(partnerIds) {
  const map = new Map()
  const unique = [...new Set((partnerIds || []).filter(Boolean).map(String))].slice(0, 120)
  if (!unique.length || !supabaseAdmin) return map

  const since = new Date()
  since.setDate(since.getDate() - 30)

  const { data, error } = await supabaseAdmin
    .from('partner_performance_logs')
    .select('partner_id, response_time_ms')
    .in('partner_id', unique)
    .gte('created_at', since.toISOString())
    .limit(20000)

  if (error) {
    if (!/partner_performance_logs|does not exist|42P01/i.test(error.message || '')) {
      console.warn('[partner-response-performance] sla batch', error.message)
    }
    return map
  }

  const buckets = new Map()
  for (const pid of unique) {
    buckets.set(pid, { sumMs: 0, n: 0 })
  }
  for (const row of data || []) {
    const pid = String(row.partner_id || '')
    const b = buckets.get(pid)
    if (!b) continue
    const ms = Number(row.response_time_ms)
    if (!Number.isFinite(ms) || ms < 0) continue
    b.sumMs += ms
    b.n += 1
  }
  for (const pid of unique) {
    const b = buckets.get(pid)
    const n = b?.n || 0
    if (!n) {
      map.set(pid, { avgMinutes: null, count: 0 })
      continue
    }
    map.set(pid, {
      count: n,
      avgMinutes: (b.sumMs / n) / 60000,
    })
  }
  return map
}
