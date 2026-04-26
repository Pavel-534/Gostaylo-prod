/**
 * Stage 56.0 — persist notification for async delivery (worker not in repo yet).
 */
import { supabaseAdmin } from '@/lib/supabase'
import { getCorrelationId } from '@/lib/request-correlation.js'

/**
 * @param {string} event
 * @param {unknown} payload
 */
export async function enqueueNotificationOutbox(event, payload) {
  if (!supabaseAdmin?.from) {
    throw new Error('[notification_outbox] supabaseAdmin not configured')
  }
  let safePayload = payload
  try {
    safePayload = JSON.parse(JSON.stringify(payload ?? {}))
  } catch {
    safePayload = { _raw: String(payload) }
  }
  const { error } = await supabaseAdmin.from('notification_outbox').insert({
    event: String(event),
    payload: safePayload,
    correlation_id: getCorrelationId(),
    status: 'pending',
  })
  if (error) throw error
}
