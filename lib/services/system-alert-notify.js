/** Escape user/DB text for Telegram HTML snippets in system alerts */
export function escapeSystemAlertHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const localDailyAlertGuard = new Map()
const SYSTEM_ALERT_DAILY_LIMIT = Math.max(
  1,
  parseInt(process.env.SYSTEM_ALERT_DAILY_LIMIT || '1', 10) || 1,
)

function utcDateKey(d = new Date()) {
  return d.toISOString().slice(0, 10)
}

function previewMessage(htmlMessage) {
  return String(htmlMessage || '').slice(0, 280)
}

function canSendByLocalGuard(dayKey) {
  const now = Date.now()
  const row = localDailyAlertGuard.get(dayKey) || { sent: 0, resetAt: now + 24 * 60 * 60 * 1000 }
  if (now > row.resetAt) {
    row.sent = 0
    row.resetAt = now + 24 * 60 * 60 * 1000
  }
  if (row.sent >= SYSTEM_ALERT_DAILY_LIMIT) {
    localDailyAlertGuard.set(dayKey, row)
    return false
  }
  row.sent += 1
  localDailyAlertGuard.set(dayKey, row)
  return true
}

async function canSendByDatabase(dayKey, htmlMessage) {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase.js')
    if (!supabaseAdmin?.from) return null

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('system_alert_daily_guard')
      .select('id, sent_count, suppressed_count')
      .eq('alert_day_utc', dayKey)
      .maybeSingle()
    if (existingError) {
      const msg = String(existingError.message || '')
      if (msg.includes("Could not find the table 'public.system_alert_daily_guard'")) {
        return null
      }
      console.warn('[system-alert] guard read failed:', msg)
      return null
    }

    if (existing && Number(existing.sent_count || 0) >= SYSTEM_ALERT_DAILY_LIMIT) {
      const nextSuppressed = Number(existing.suppressed_count || 0) + 1
      await supabaseAdmin
        .from('system_alert_daily_guard')
        .update({
          suppressed_count: nextSuppressed,
          last_seen_at: new Date().toISOString(),
          last_message_preview: previewMessage(htmlMessage),
        })
        .eq('id', existing.id)
      return false
    }

    if (!existing) {
      const { error: insertError } = await supabaseAdmin
        .from('system_alert_daily_guard')
        .insert({
          alert_day_utc: dayKey,
          sent_count: 1,
          suppressed_count: 0,
          first_sent_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          last_message_preview: previewMessage(htmlMessage),
        })
      if (insertError) {
        const msg = String(insertError.message || '')
        if (msg.includes("Could not find the table 'public.system_alert_daily_guard'")) {
          return null
        }
        if (msg.toLowerCase().includes('duplicate key')) {
          return false
        }
        console.warn('[system-alert] guard insert failed:', msg)
        return null
      }
      return true
    }

    const nextSent = Number(existing.sent_count || 0) + 1
    await supabaseAdmin
      .from('system_alert_daily_guard')
      .update({
        sent_count: nextSent,
        last_seen_at: new Date().toISOString(),
        last_message_preview: previewMessage(htmlMessage),
      })
      .eq('id', existing.id)
    return true
  } catch (e) {
    console.warn('[system-alert] guard db fallback:', e?.message || e)
    return null
  }
}

/**
 * Fire-and-forget Telegram system topic (TELEGRAM_SYSTEM_ALERTS_TOPIC_ID).
 * Keeps heavy callers free of duplicate dynamic-import boilerplate.
 * @param {string} htmlMessage
 * @param {{ reply_markup?: { inline_keyboard?: { text: string, url?: string, callback_data?: string }[][] } }} [opts]
 */
export async function notifySystemAlert(htmlMessage, opts = {}) {
  try {
    const dayKey = utcDateKey()
    const dbDecision = await canSendByDatabase(dayKey, htmlMessage)
    const allowed = dbDecision == null ? canSendByLocalGuard(dayKey) : dbDecision
    if (!allowed) {
      console.warn('[system-alert] suppressed by daily guard')
      return
    }
    const { NotificationService } = await import('./notification.service.js')
    await NotificationService.sendSystemAlert(htmlMessage, opts)
  } catch (e) {
    console.warn('[system-alert] notify failed:', e?.message || e)
  }
}
