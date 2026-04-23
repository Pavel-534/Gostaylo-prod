/**
 * Stage 19.0 — cron: warn partner on Telegram if guest message awaits reply >30 min (SLA).
 * Dedup: `partner_sla_nudge_events` (migration 041).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { sendTelegram, withMainMenuForChat } from '@/lib/services/telegram/api.js'
import { getPublicSiteUrl } from '@/lib/site-url.js'

const WAIT_MS = 30 * 60 * 1000
const BATCH = 80

function isRenterMessage(m, renterId) {
  const rid = String(renterId || '')
  const sid = m?.sender_id != null ? String(m.sender_id) : ''
  if (sid && sid === rid) return true
  return String(m?.sender_role || '').toUpperCase() === 'RENTER'
}

export async function runPartnerSlaTelegramNudges() {
  if (!supabaseAdmin) return { scanned: 0, sent: 0, skipped: 0, errors: 0 }

  const threshold = new Date(Date.now() - WAIT_MS).toISOString()
  const { data: convs, error: cErr } = await supabaseAdmin
    .from('conversations')
    .select('id, partner_id, renter_id, last_message_at')
    .eq('status', 'OPEN')
    .not('partner_id', 'is', null)
    .not('renter_id', 'is', null)
    .lt('last_message_at', threshold)
    .order('last_message_at', { ascending: true })
    .limit(BATCH)

  if (cErr) {
    console.warn('[partner-sla-telegram-nudge] conversations', cErr.message)
    return { scanned: 0, sent: 0, skipped: 0, errors: 1 }
  }

  let sent = 0
  let skipped = 0
  let errors = 0

  for (const c of convs || []) {
    const cid = String(c.id)
    const partnerId = String(c.partner_id)
    const renterId = String(c.renter_id)

    const { data: lastMsg, error: mErr } = await supabaseAdmin
      .from('messages')
      .select('id, sender_id, sender_role, created_at')
      .eq('conversation_id', cid)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (mErr || !lastMsg?.id) {
      skipped += 1
      continue
    }
    if (!isRenterMessage(lastMsg, renterId)) {
      skipped += 1
      continue
    }
    const msgTs = new Date(lastMsg.created_at).getTime()
    if (!Number.isFinite(msgTs) || Date.now() - msgTs < WAIT_MS) {
      skipped += 1
      continue
    }

    const anchorId = String(lastMsg.id)
    const { error: insErr } = await supabaseAdmin.from('partner_sla_nudge_events').insert({
      conversation_id: cid,
      anchor_message_id: anchorId,
      partner_id: partnerId,
    })

    if (insErr) {
      if (insErr.code === '23505' || /duplicate|unique/i.test(insErr.message || '')) {
        skipped += 1
        continue
      }
      if (/partner_sla_nudge_events|does not exist|42P01/i.test(insErr.message || '')) {
        errors += 1
        break
      }
      console.warn('[partner-sla-telegram-nudge] insert', insErr.message)
      errors += 1
      continue
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('telegram_id, notification_preferences')
      .eq('id', partnerId)
      .maybeSingle()

    const tg = profile?.telegram_id
    const prefs = profile?.notification_preferences
    const tgOn =
      prefs && typeof prefs === 'object' && prefs.telegram === true && tg != null && String(tg).trim() !== ''

    if (!tgOn) {
      skipped += 1
      continue
    }

    const base = (getPublicSiteUrl() || '').replace(/\/$/, '')
    const link = `${base}/messages/${encodeURIComponent(cid)}`
    const textRu =
      `⏱ <b>SLA под угрозой</b>\n\n` +
      `Гость ждёт ответа в чате уже более <b>30 минут</b>. Ответьте сейчас, чтобы сохранить буст в поиске.\n\n` +
      `<a href="${link}">Открыть диалог</a>`

    const lang = 'ru'
    const ok = await sendTelegram(tg, textRu, await withMainMenuForChat(lang, tg, { menuVariant: 'partner' }))
    if (!ok) errors += 1
    else sent += 1
  }

  return { scanned: (convs || []).length, sent, skipped, errors }
}
