/**
 * Stage 19.0 — cron: warn partner on Telegram if guest message awaits reply >30 min (SLA).
 * Dedup: `partner_sla_nudge_events` (migration 041).
 * Stage 42.1 — локаль из профиля (`resolveUserLocale`), алерты при критических сбоях.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { sendTelegram, withMainMenuForChat } from '@/lib/services/telegram/api.js'
import { getPublicSiteUrl } from '@/lib/site-url.js'
import { resolveUserLocale } from '@/lib/i18n/locale-resolver.js'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'

const WAIT_MS = 30 * 60 * 1000
const BATCH = 80

function isRenterMessage(m, renterId) {
  const rid = String(renterId || '')
  const sid = m?.sender_id != null ? String(m.sender_id) : ''
  if (sid && sid === rid) return true
  return String(m?.sender_role || '').toUpperCase() === 'RENTER'
}

function buildSlaNudgeHtml(locale, link) {
  if (locale === 'ru') {
    return (
      `⏱ <b>SLA под угрозой</b>\n\n` +
      `Гость ждёт ответа в чате уже более <b>30 минут</b>. Ответьте сейчас, чтобы сохранить буст в поиске.\n\n` +
      `<a href="${link}">Открыть диалог</a>`
    )
  }
  return (
    `⏱ <b>SLA at risk</b>\n\n` +
    `A guest has been waiting for a reply in chat for over <b>30 minutes</b>. Reply now to protect your search boost.\n\n` +
    `<a href="${link}">Open conversation</a>`
  )
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
    console.error('[partner-sla-telegram-nudge] conversations', cErr.message)
    void notifySystemAlert(
      `⏱ <b>Cron: partner-sla-telegram-nudge</b>\n<code>${escapeSystemAlertHtml(cErr.message || 'conversations query failed')}</code>`,
    )
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
        void notifySystemAlert(
          `⏱ <b>Cron: partner-sla-telegram-nudge</b>\n<code>${escapeSystemAlertHtml(insErr.message || 'nudge table missing')}</code>`,
        )
        break
      }
      console.error('[partner-sla-telegram-nudge] insert', insErr.message)
      errors += 1
      continue
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('telegram_id, notification_preferences, preferred_language, language')
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
    const locale = resolveUserLocale(profile)
    const text = buildSlaNudgeHtml(locale, link)
    const ok = await sendTelegram(tg, text, await withMainMenuForChat(locale, tg, { menuVariant: 'partner' }))
    if (!ok) errors += 1
    else sent += 1
  }

  return { scanned: (convs || []).length, sent, skipped, errors }
}
