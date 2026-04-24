import { supabaseAdmin } from '@/lib/supabase'
import {
  sendTelegramMessagePayload,
  sendToAdmin,
} from '@/lib/services/notifications/telegram.service'
import { getPublicSiteUrl } from '@/lib/site-url'
import { normalizeAllowedListingIdsFromRow } from '@/lib/promo/allowed-listing-ids'

function writeAlphaNotificationLog(channel, payload) {
  const ts = new Date().toISOString()
  console.log(`[MARKETING-NOTIFY:${channel}]`, JSON.stringify({ ts, ...payload }))
}

const REMINDER_DEDUP_WINDOW_MS = 45 * 60 * 1000
const BASE_URL = getPublicSiteUrl()

export class MarketingNotificationsService {
  static async onPartnerFlashSaleCreated({ promoRow, partnerId }) {
    if (!promoRow || promoRow.is_flash_sale !== true) return

    const code = String(promoRow.code || '').toUpperCase()
    await sendToAdmin(
      `🔥 <b>New Partner Flash Sale</b>\n\n` +
        `👤 Partner: <code>${String(partnerId || '')}</code>\n` +
        `🎟️ Code: <b>${code}</b>\n` +
        `⏳ Valid until: ${String(promoRow.valid_until || '—')}\n\n` +
        `<i>Marketing delivery adapter is active.</i>`,
    )

    writeAlphaNotificationLog('flash-sale-created.admin-or-audience', {
      partnerId: String(partnerId || ''),
      promoCode: code,
      validUntil: promoRow.valid_until || null,
      message:
        'Flash Sale created by partner. Admin delivery sent via Telegram.',
    })
  }

  static async getCreatedBookingsCountByPromoCode(code) {
    const normalized = String(code || '').trim().toUpperCase()
    if (!normalized || !supabaseAdmin) return 0

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('id')
      .eq('promo_code_used', normalized)

    if (error || !Array.isArray(data)) return 0
    return data.length
  }

  static async sendPartnerFlashSaleEndingSoonReminder({ promoRow }) {
    if (!promoRow || promoRow.is_flash_sale !== true) return
    return this.sendFlashSaleReminder({ promoRow, hoursToExtend: 6 })
  }

  static canSendReminderByMetadata(metadata) {
    const md = metadata && typeof metadata === 'object' ? metadata : {}
    const lastIso = md.last_reminder_sent_at ? String(md.last_reminder_sent_at) : ''
    if (!lastIso) return { ok: true }
    const lastMs = new Date(lastIso).getTime()
    if (!Number.isFinite(lastMs)) return { ok: true }
    const elapsed = Date.now() - lastMs
    if (elapsed < REMINDER_DEDUP_WINDOW_MS) {
      return { ok: false, reason: 'DEDUP_WINDOW', retryAfterMs: REMINDER_DEDUP_WINDOW_MS - elapsed }
    }
    return { ok: true }
  }

  static async markReminderSent(promoId, metadata) {
    if (!promoId || !supabaseAdmin) return
    const nowIso = new Date().toISOString()
    const md = metadata && typeof metadata === 'object' ? { ...metadata } : {}
    md.last_reminder_sent_at = nowIso
    await supabaseAdmin.from('promo_codes').update({ metadata: md }).eq('id', promoId)
  }

  static async resolveListingTitleForPromo(promoRow) {
    if (!supabaseAdmin) return null
    const allowed = normalizeAllowedListingIdsFromRow(promoRow?.allowed_listing_ids)
    if (!allowed?.length) return null
    const listingId = String(allowed[0] || '')
    if (!listingId) return null
    const { data } = await supabaseAdmin
      .from('listings')
      .select('id,title')
      .eq('id', listingId)
      .maybeSingle()
    return data?.title ? String(data.title) : null
  }

  static async resolvePartnerTelegramId(partnerId) {
    const pid = String(partnerId || '')
    if (!pid || !supabaseAdmin) return null
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('telegram_id')
      .eq('id', pid)
      .maybeSingle()
    const tg = data?.telegram_id ? String(data.telegram_id).trim() : ''
    return tg || null
  }

  static async sendFlashSaleReminder({ promoRow, hoursToExtend = 6 }) {
    if (!promoRow || promoRow.is_flash_sale !== true || !supabaseAdmin) {
      return { success: false, reason: 'INVALID_PROMO' }
    }

    const { data: freshPromo } = await supabaseAdmin
      .from('promo_codes')
      .select(
        'id,code,partner_id,is_flash_sale,valid_until,metadata,allowed_listing_ids,created_by_type,is_active',
      )
      .eq('id', promoRow.id)
      .maybeSingle()
    if (!freshPromo || freshPromo.is_flash_sale !== true) {
      return { success: false, reason: 'PROMO_NOT_FOUND' }
    }

    const dedup = this.canSendReminderByMetadata(freshPromo.metadata)
    if (!dedup.ok) {
      return { success: false, deduped: true, reason: dedup.reason, retryAfterMs: dedup.retryAfterMs }
    }

    await this.markReminderSent(freshPromo.id, freshPromo.metadata)

    const partnerTelegramId = await this.resolvePartnerTelegramId(freshPromo.partner_id)
    if (!partnerTelegramId) {
      return { success: false, reason: 'PARTNER_TELEGRAM_MISSING' }
    }

    const bookingsCreated = await this.getCreatedBookingsCountByPromoCode(freshPromo.code)
    const listingTitle = (await this.resolveListingTitleForPromo(freshPromo)) || 'вашего листинга'
    const code = String(freshPromo.code || '').toUpperCase()
    const extendUrl =
      `${BASE_URL}/partner/promo?flashCode=${encodeURIComponent(code)}` +
      `&extendHours=${encodeURIComponent(String(hoursToExtend))}`

    const text =
      `🔥 Ваш Flash Sale для ${listingTitle} закончится через 1 час!\n` +
      `📊 Успех: создано ${bookingsCreated} броней.\n` +
      `Хотите продлить акцию еще на ${hoursToExtend} часов?`

    const result = await sendTelegramMessagePayload({
      chat_id: partnerTelegramId,
      text,
      reply_markup: {
        inline_keyboard: [[{ text: 'Продлить на 6 часов', url: extendUrl }]],
      },
    })

    writeAlphaNotificationLog('flash-sale-ending-soon.partner', {
      partnerId: String(freshPromo.partner_id || ''),
      promoCode: code,
      validUntil: freshPromo.valid_until || null,
      listingTitle,
      bookingsCreated,
      sent: result?.success === true,
    })

    return { success: result?.success === true, deduped: false, bookingsCreated }
  }
}

export default MarketingNotificationsService

