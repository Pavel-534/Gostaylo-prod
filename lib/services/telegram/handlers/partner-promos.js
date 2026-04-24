/**
 * Partner Telegram: active Flash promos snapshot (Stage 38.0).
 */
import { supabaseAdmin } from '@/lib/supabase'
import { sendTelegram, withMainMenuForChat } from '../api.js'
import { getTelegramMessages } from '../messages/index.js'
import { MarketingNotificationsService } from '@/lib/services/marketing-notifications.service'

function esc(s) {
  if (s == null || s === '') return ''
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function formatRemainingHm(validUntilIso) {
  const end = new Date(String(validUntilIso || '')).getTime()
  if (!Number.isFinite(end)) return '00:00'
  const ms = Math.max(0, end - Date.now())
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export async function handlePartnerPromoCommand(chatId, lang) {
  const t = getTelegramMessages(lang)
  if (!supabaseAdmin) {
    await sendTelegram(chatId, t.promo_flash_db_error, await withMainMenuForChat(lang, chatId))
    return
  }

  const { data: profile, error: profErr } = await supabaseAdmin
    .from('profiles')
    .select('id,role')
    .eq('telegram_id', String(chatId))
    .maybeSingle()

  if (profErr || !profile?.id) {
    await sendTelegram(chatId, t.promo_flash_link_first, await withMainMenuForChat(lang, chatId))
    return
  }

  const role = String(profile.role || '').toUpperCase()
  if (!['PARTNER', 'ADMIN'].includes(role)) {
    await sendTelegram(chatId, t.promo_flash_partner_only, await withMainMenuForChat(lang, chatId))
    return
  }

  const partnerId = String(profile.id)
  const nowIso = new Date().toISOString()
  const { data: rows, error: promoErr } = await supabaseAdmin
    .from('promo_codes')
    .select('id,code,valid_until,is_flash_sale,is_active,allowed_listing_ids')
    .eq('partner_id', partnerId)
    .eq('is_flash_sale', true)
    .eq('is_active', true)
    .gt('valid_until', nowIso)
    .order('valid_until', { ascending: true })

  if (promoErr) {
    await sendTelegram(chatId, t.promo_flash_db_error, await withMainMenuForChat(lang, chatId))
    return
  }

  const list = Array.isArray(rows) ? rows : []
  if (list.length === 0) {
    await sendTelegram(chatId, t.promo_flash_empty, await withMainMenuForChat(lang, chatId))
    return
  }

  const lines = []
  const bookingCounts = []
  for (const row of list) {
    const hm = formatRemainingHm(row.valid_until)
    const code = String(row.code || '').trim().toUpperCase()
    const n = code ? await MarketingNotificationsService.getCreatedBookingsCountByPromoCode(code) : 0
    bookingCounts.push(n)
    const listingTitle = (await MarketingNotificationsService.resolveListingTitleForPromo(row)) || null
    const nameRaw = listingTitle || code || 'Flash'
    const name = esc(String(nameRaw))
    lines.push(
      `• <b>${name}</b> — ${esc(t.promo_flash_line_remaining(hm))} — ${esc(t.promo_flash_line_bookings(n))}`,
    )
  }

  const maxN = bookingCounts.length ? Math.max(...bookingCounts) : 0
  const allZero = list.length > 0 && bookingCounts.every((c) => c === 0)
  let coach = ''
  if (maxN > 3) coach = `\n\n${esc(t.promo_flash_coach_high())}`
  else if (allZero) coach = `\n\n${esc(t.promo_flash_coach_zero())}`

  const body = `<b>${esc(t.promo_flash_header)}</b>\n\n${lines.join('\n')}${coach}`
  await sendTelegram(chatId, body, await withMainMenuForChat(lang, chatId))
}
