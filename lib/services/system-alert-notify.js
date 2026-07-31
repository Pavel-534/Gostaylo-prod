/** Escape user/DB text for Telegram HTML snippets in system alerts */
export function escapeSystemAlertHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const localWindowGuard = new Map()

/** AUDIT_03 C3.11: sliding/hourly window — default 20/hour (was hard daily=1). */
const SYSTEM_ALERT_WINDOW_MS = Math.max(
  60_000,
  parseInt(process.env.SYSTEM_ALERT_WINDOW_MS || String(60 * 60 * 1000), 10) || 60 * 60 * 1000,
)
const SYSTEM_ALERT_MAX_PER_WINDOW = Math.max(
  1,
  parseInt(process.env.SYSTEM_ALERT_HOURLY_LIMIT || process.env.SYSTEM_ALERT_DAILY_LIMIT || '20', 10) ||
    20,
)

function windowBucketKey(d = new Date()) {
  // Hour bucket UTC (reuses system_alert_daily_guard.alert_day_utc column as bucket key).
  return d.toISOString().slice(0, 13)
}

/** Separate money-ish alerts from noise when possible. */
export function classifySystemAlert(htmlMessage) {
  const s = String(htmlMessage || '')
  if (/PRICE_TAMPER|PRICE_MISMATCH|TAMPER/i.test(s)) return 'PRICE_TAMPERING'
  if (/crypto\/confirm|Webhook: crypto|txid/i.test(s)) return 'CRYPTO_WEBHOOK'
  if (/ledger|payout|escrow|FINANCE/i.test(s)) return 'FINANCE'
  if (/FX|exchange.?rate|stale/i.test(s)) return 'FX'
  const tagged = s.match(/\[([A-Z][A-Z0-9_]{2,40})\]/)
  if (tagged) return tagged[1]
  return 'GENERAL'
}

function guardKey(bucket, alertClass) {
  return `${bucket}::${alertClass}`
}

function previewMessage(htmlMessage) {
  return String(htmlMessage || '').slice(0, 280)
}

function canSendByLocalGuard(key) {
  const now = Date.now()
  const row = localWindowGuard.get(key) || { sent: 0, resetAt: now + SYSTEM_ALERT_WINDOW_MS }
  if (now > row.resetAt) {
    row.sent = 0
    row.resetAt = now + SYSTEM_ALERT_WINDOW_MS
  }
  if (row.sent >= SYSTEM_ALERT_MAX_PER_WINDOW) {
    localWindowGuard.set(key, row)
    return false
  }
  row.sent += 1
  localWindowGuard.set(key, row)
  return true
}

async function canSendByDatabase(bucketKey, alertClass, htmlMessage) {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase.js')
    if (!supabaseAdmin?.from) return null

    const dayKey = guardKey(bucketKey, alertClass)
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

    if (existing && Number(existing.sent_count || 0) >= SYSTEM_ALERT_MAX_PER_WINDOW) {
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
    const bucket = windowBucketKey()
    const alertClass = classifySystemAlert(htmlMessage)
    const key = guardKey(bucket, alertClass)
    const dbDecision = await canSendByDatabase(bucket, alertClass, htmlMessage)
    const allowed = dbDecision == null ? canSendByLocalGuard(key) : dbDecision
    if (!allowed) {
      console.warn('[system-alert] suppressed by window guard', { bucket, alertClass })
      return
    }
    const { NotificationService } = await import('./notification.service.js')
    await NotificationService.sendSystemAlert(htmlMessage, opts)
  } catch (e) {
    console.warn('[system-alert] notify failed:', e?.message || e)
  }
}
