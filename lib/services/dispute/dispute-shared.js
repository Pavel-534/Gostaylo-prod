/**
 * Stage 109.1 — dispute constants and shared helpers.
 */
import { supabaseAdmin } from '@/lib/supabase'
import { DISPUTE_SLA_HOURS, computeDisputeDeadlineIso } from '@/lib/config/dispute-sla'

/** Supabase bucket for dispute uploads (paths: `booking-{bookingId}/...`). */
export const DISPUTE_EVIDENCE_BUCKET = 'dispute-evidence'

/**
 * Parse stored evidence URL / path values into object keys within `dispute-evidence`.
 * @param {unknown} evidenceUrls
 * @returns {string[]}
 */
export function extractDisputeEvidenceObjectPaths(evidenceUrls) {
  const paths = new Set()
  const rows = Array.isArray(evidenceUrls) ? evidenceUrls : []
  for (const entry of rows) {
    const s = String(entry || '').trim()
    if (!s) continue
    const base = s.split('?')[0].split('#')[0]
    const mProxy = base.match(/^\/?_storage\/dispute-evidence\/(.+)$/i)
    if (mProxy) {
      paths.add(mProxy[1].replace(/^\/+/, ''))
      continue
    }
    const mObj = base.match(/\/storage\/v1\/object\/(?:public|sign)\/dispute-evidence\/(.+)$/i)
    if (mObj) {
      try {
        paths.add(decodeURIComponent(mObj[1].replace(/^\/+/, '')))
      } catch {
        paths.add(mObj[1].replace(/^\/+/, ''))
      }
      continue
    }
    if (/^booking-[^/]+\/.+/i.test(base)) paths.add(base.replace(/^\/+/, ''))
  }
  return [...paths]
}

export const ACTIVE_DISPUTE_STATUSES = ['OPEN', 'IN_REVIEW']
export const MEDIATION_STATUS = 'PENDING_MEDIATION'
export const RECENT_DISPUTE_COOLDOWN_MS = 6 * 60 * 60 * 1000
export const SLA_REMINDER_POINTS = Object.freeze([
  { key: '24h', hoursLeft: 24, thresholdMs: 24 * 60 * 60 * 1000 },
  { key: '2h', hoursLeft: 2, thresholdMs: 2 * 60 * 60 * 1000 },
])
export const DISPUTE_FSM = Object.freeze({
  PENDING_MEDIATION: new Set(['OPEN', 'CLOSED']),
  OPEN: new Set(['IN_REVIEW', 'RESOLVED', 'REJECTED', 'CLOSED']),
  IN_REVIEW: new Set(['RESOLVED', 'REJECTED', 'CLOSED']),
  RESOLVED: new Set([]),
  REJECTED: new Set([]),
  CLOSED: new Set([]),
})

export { DISPUTE_SLA_HOURS, computeDisputeDeadlineIso }

export function createDisputeId() {
  return `dsp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function trimReason(value, max = 2000) {
  return String(value || '').trim().slice(0, max)
}

export function resolveCounterparty(booking, actorId) {
  const renterId = String(booking?.renter_id || '')
  const partnerId = String(booking?.partner_id || '')
  if (renterId && renterId === String(actorId || '')) return partnerId || null
  if (partnerId && partnerId === String(actorId || '')) return renterId || null
  return null
}

export async function getConversationIdForBooking(bookingId, providedConversationId = null) {
  if (providedConversationId) return String(providedConversationId)
  const { data } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('booking_id', bookingId)
    .maybeSingle()
  return data?.id ? String(data.id) : null
}

export async function getProfileSafe(userId) {
  if (!userId) return null
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, email, role, language, telegram_id')
    .eq('id', userId)
    .maybeSingle()
  return data || null
}
