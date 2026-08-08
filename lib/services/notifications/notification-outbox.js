/**
 * Stage 56.0 / 200.74 — persist notification for async delivery.
 * Drain: `lib/services/notifications/process-notification-outbox.js` (cron `/api/cron/notification-outbox`).
 * Payload must be JSON-serializable; correlation_id is restored on drain.
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
  let safePayload
  try {
    safePayload = JSON.parse(JSON.stringify(payload ?? {}))
  } catch {
    console.warn('[notification_outbox] payload not JSON-serializable', { event: String(event) })
    // Fail enqueue so dispatch falls back to sync handler with original in-memory payload
    throw new Error('[notification_outbox] payload must be JSON-serializable')
  }
  const { error } = await supabaseAdmin.from('notification_outbox').insert({
    event: String(event),
    payload: safePayload,
    correlation_id: getCorrelationId(),
    status: 'pending',
  })
  if (error) throw error
}
