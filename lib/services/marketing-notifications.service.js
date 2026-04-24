import { supabaseAdmin } from '@/lib/supabase'
import {
  sendTelegramMessagePayload,
  sendToAdmin,
} from '@/lib/services/notifications/telegram.service'
import { getPublicSiteUrl } from '@/lib/site-url'
import { normalizeAllowedListingIdsFromRow } from '@/lib/promo/allowed-listing-ids'
import { buildFlash1hReminderKey } from '@/lib/promo/flash-reminder-keys'
import { buildFlashSaleGuestCongratsTelegramText } from '@/lib/translations/marketing-guest-notifications'

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
  }

  /**
   * Guest DM after a confirmed booking was created with an active Flash Sale promo (Stage 40.0).
   */
  static async notifyGuestFlashSaleBookingCongrats({ renterId, listingTitle }) {
    const rid = String(renterId || '').trim()
    if (!rid || !supabaseAdmin) return { sent: false, reason: 'SKIP' }

    let profileQuery = await supabaseAdmin
      .from('profiles')
      .select('telegram_id, preferred_language, language')
      .eq('id', rid)
      .maybeSingle()
    if (
      profileQuery.error &&
      /preferred_language|column/i.test(String(profileQuery.error.message || ''))
    ) {
      profileQuery = await supabaseAdmin
        .from('profiles')
        .select('telegram_id, language')
        .eq('id', rid)
        .maybeSingle()
    }
    const profile = profileQuery.data
    const chatId = profile?.telegram_id ? String(profile.telegram_id).trim() : ''
    if (!chatId) return { sent: false, reason: 'NO_TELEGRAM' }

    const title = listingTitle ? String(listingTitle).trim() : ''
    const langPref =
      profile?.preferred_language != null && String(profile.preferred_language).trim() !== ''
        ? profile.preferred_language
        : profile?.language
    const text = buildFlashSaleGuestCongratsTelegramText(langPref, { listingTitle: title || null })

    const result = await sendTelegramMessagePayload({
      chat_id: chatId,
      text,
    })
    return { sent: result?.success === true }
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

  /**
   * Atomic idempotent lock (Stage 38.0): metadata.reminder_locks[lockKey].
   * @returns {Promise<boolean>} true if this call acquired the lock
   */
  static async tryAcquireReminderLock(promoId, lockKey) {
    if (!promoId || !lockKey || !supabaseAdmin) return false
    const { data, error } = await supabaseAdmin.rpc('promo_try_acquire_reminder_lock', {
      p_promo_id: String(promoId),
      p_lock_key: String(lockKey),
    })
    if (error) {
      console.warn('[MARKETING] promo_try_acquire_reminder_lock failed', error.message)
      return false
    }
    return data === true
  }

  static async sendPartnerFlashSaleEndingSoonReminder({ promoRow }) {
    if (!promoRow || promoRow.is_flash_sale !== true) return
    return this.sendFlashSaleReminder({ promoRow, hoursToExtend: 6 })
  }

  static async markReminderSentTimestamp(promoId) {
    if (!promoId || !supabaseAdmin) return
    const { data: row } = await supabaseAdmin
      .from('promo_codes')
      .select('metadata')
      .eq('id', promoId)
      .maybeSingle()
    const md = row?.metadata && typeof row.metadata === 'object' ? { ...row.metadata } : {}
    md.last_reminder_sent_at = new Date().toISOString()
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

    const partnerTelegramId = await this.resolvePartnerTelegramId(freshPromo.partner_id)
    if (!partnerTelegramId) {
      return { success: false, reason: 'PARTNER_TELEGRAM_MISSING' }
    }

    const reminderKey = buildFlash1hReminderKey()
    const acquired = await this.tryAcquireReminderLock(freshPromo.id, reminderKey)
    if (!acquired) {
      return { success: false, deduped: true, reason: 'REMINDER_LOCK', reminderKey }
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

    if (result?.success === true) {
      await this.markReminderSentTimestamp(freshPromo.id)
    }

    return { success: result?.success === true, deduped: false, bookingsCreated, reminderKey }
  }
}

export default MarketingNotificationsService
