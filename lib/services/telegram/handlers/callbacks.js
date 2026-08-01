import { NextResponse } from 'next/server'
import { telegramEnv } from '../env.js'
import {
  answerCallback,
  answerCallbackDismiss,
  editTelegramMessage,
  sendTelegram,
  withMainMenuForChat,
} from '../api.js'
import { getTelegramMessages, getHelpHtmlForMenuVariant } from '../messages/index.js'
import { resolveContentMenuVariantForTelegramChat } from '../menu-variant.js'
import { resolveTelegramLang, resolveTelegramLanguageForChat, normalizeTelegramUiLang } from '../locale.js'
import { handleStatusCheck } from './accounts.js'
import { handleMyDrafts } from './drafts.js'
import { transitionBookingStatus } from '@/lib/services/booking/booking-status.service.js'
import { BookingService } from '@/lib/services/booking.service'
import { NotificationService, NotificationEvents } from '@/lib/services/notification.service'
import { releaseInquirySoftHold } from '@/lib/booking/inquiry-soft-hold.js'
import { recordCriticalSignal } from '@/lib/critical-telemetry.js'

const MENU_ACTIONS = new Set([
  'help',
  'my',
  'status',
  'lazy',
  'lazy_hint',
  'guest_on',
  'partner_mode',
])

function alertTelegramBookingFsmFailure({ bookingId, action, error, fromId }) {
  recordCriticalSignal('TELEGRAM_BOOKING_FSM_FAIL', {
    severity: 'CRITICAL',
    tag: '[FINANCE]',
    threshold: 1,
    windowMs: 60 * 60 * 1000,
    detailLines: [
      `bookingId=${bookingId || 'unknown'}`,
      `action=${action || 'unknown'}`,
      `fromTelegramId=${fromId || 'unknown'}`,
      `error=${String(error || 'unknown').slice(0, 400)}`,
    ],
  })
}

async function fetchProfileForTelegramMenu(chatId) {
  const { supabaseUrl, serviceKey } = telegramEnv()
  if (!supabaseUrl || !serviceKey) return null
  const res = await fetch(
    `${supabaseUrl}/rest/v1/profiles?telegram_id=eq.${encodeURIComponent(String(chatId))}&select=id,role,notification_preferences`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    }
  )
  const rows = await res.json()
  return Array.isArray(rows) ? rows[0] : null
}

async function setTelegramGuestMenuPreference(chatId, enabled) {
  const { supabaseUrl, serviceKey } = telegramEnv()
  const row = await fetchProfileForTelegramMenu(chatId)
  if (!row?.id) return false
  const prev = row.notification_preferences && typeof row.notification_preferences === 'object' ? row.notification_preferences : {}
  const notification_preferences = { ...prev, telegram_guest_menu: Boolean(enabled) }
  const patch = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(row.id)}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ notification_preferences }),
  })
  return patch.ok
}

async function handleBotMenuCallback(callbackQuery) {
  const { id: callbackId, data, from, message } = callbackQuery
  const chatId = message?.chat?.id
  if (!chatId) return NextResponse.json({ ok: true })

  const action = String(data || '').replace(/^menu:/, '')
  if (!MENU_ACTIONS.has(action)) {
    const t0 = getTelegramMessages(normalizeTelegramUiLang(from?.language_code))
    await answerCallback(callbackId, t0.callbackUnknown())
    return NextResponse.json({ ok: true })
  }

  await answerCallbackDismiss(callbackId)

  const lang = await resolveTelegramLanguageForChat(chatId, from?.language_code)
  const t = getTelegramMessages(lang)

  try {
    if (action === 'help') {
      const contentVariant = await resolveContentMenuVariantForTelegramChat(chatId)
      const helpHtml = getHelpHtmlForMenuVariant(t, lang, contentVariant)
      await sendTelegram(chatId, helpHtml, await withMainMenuForChat(lang, chatId))
    } else if (action === 'my') {
      await handleMyDrafts(chatId, lang)
    } else if (action === 'status') {
      await handleStatusCheck(chatId, lang)
    } else if (action === 'lazy_hint' || action === 'lazy') {
      await sendTelegram(chatId, t.createListingPhotoHint, await withMainMenuForChat(lang, chatId))
    } else if (action === 'guest_on') {
      const row = await fetchProfileForTelegramMenu(chatId)
      const role = String(row?.role || '').toUpperCase()
      if (!['PARTNER', 'ADMIN'].includes(role)) {
        await sendTelegram(chatId, t.guestModePartnerOnly(), await withMainMenuForChat(lang, chatId))
      } else {
        await setTelegramGuestMenuPreference(chatId, true)
        await sendTelegram(chatId, t.guestModeEnabled(), await withMainMenuForChat(lang, chatId))
      }
    } else if (action === 'partner_mode') {
      await setTelegramGuestMenuPreference(chatId, false)
      await sendTelegram(chatId, t.partnerModeRestored(), await withMainMenuForChat(lang, chatId))
    }
  } catch (e) {
    console.error('[MENU CALLBACK]', e)
  }
  return NextResponse.json({ ok: true })
}

/**
 * Partner approve/decline via Telegram — must use transitionBookingStatus (AUDIT_MONEY_FLOW_04).
 * Parity with PUT /api/v2/partner/bookings/[id]: inventory, soft-hold release, snapshot, guest notify.
 */
async function applyTelegramPartnerBookingDecision({
  bookingId,
  action,
  booking,
  from,
  callbackId,
  chatId,
  message,
  t,
  loc,
}) {
  const newStatus = action === 'approve' ? 'CONFIRMED' : 'CANCELLED'
  const trigger =
    action === 'approve' ? 'telegram_callback_approve' : 'telegram_callback_decline'
  const partnerId = String(booking.partner_id || booking.partner?.id || '').trim() || null

  if (newStatus === 'CONFIRMED') {
    const inv = await BookingService.verifyInventoryBeforePartnerConfirm(bookingId)
    if (!inv.ok) {
      const hasInquiryHoldConflict =
        Array.isArray(inv.conflicts) &&
        inv.conflicts.some((c) => String(c?.source || c?.reason || '').includes('inquiry'))
      const msg =
        inv.error === 'INSUFFICIENT_CAPACITY'
          ? hasInquiryHoldConflict
            ? 'Даты заняты другой заявкой (hold). Подождите или подтвердите другую.'
            : 'Недостаточно мест на эти даты.'
          : inv.error || t.callbackUpdateError()
      await answerCallback(callbackId, String(msg).slice(0, 180))
      return NextResponse.json({ ok: true })
    }
  }

  const statusRes = await transitionBookingStatus(bookingId, newStatus, {
    scope: 'partner',
    actorContext: {
      actorId: partnerId,
      actorRole: 'PARTNER',
      trigger,
    },
    metadata: {
      reason: 'telegram_bot_callback',
      channel: 'telegram',
    },
  })

  if (!statusRes?.success) {
    const err = statusRes?.error || 'BOOKING_STATUS_TRANSITION_FAILED'
    alertTelegramBookingFsmFailure({
      bookingId,
      action,
      error: err,
      fromId: from?.id,
    })
    await answerCallback(callbackId, t.callbackUpdateError())
    return NextResponse.json({ ok: true })
  }

  if (newStatus === 'CONFIRMED' || newStatus === 'CANCELLED') {
    try {
      await releaseInquirySoftHold(bookingId)
    } catch (e) {
      console.error('[BOOKING CALLBACK] releaseInquirySoftHold', e)
    }
  }

  if (newStatus === 'CONFIRMED') {
    try {
      await BookingService.attachSettlementSnapshotForBooking(bookingId)
    } catch (e) {
      console.error('[BOOKING CALLBACK] settlement snapshot', e)
    }
    try {
      const full = await BookingService.getBookingById(bookingId)
      if (full) {
        await NotificationService.dispatch(NotificationEvents.BOOKING_CONFIRMED, {
          booking: full,
          renter: full.renter,
          listing: full.listings,
        })
      }
    } catch (e) {
      console.error('[BOOKING CALLBACK] BOOKING_CONFIRMED notify', e)
    }
  }

  if (newStatus === 'CANCELLED') {
    try {
      const full = await BookingService.getBookingById(bookingId)
      if (full) {
        await NotificationService.dispatch(NotificationEvents.BOOKING_CANCELLED, {
          booking: full,
          guest: full.renter,
          listing: full.listings,
          partner: full.partner || { id: full.partner_id },
          reason: 'telegram_bot_callback',
          notifyPartner: false,
        })
      }
    } catch (e) {
      console.error('[BOOKING CALLBACK] BOOKING_CANCELLED notify', e)
    }
  }

  const successMessage =
    action === 'approve' ? t.callbackApproveToast() : t.callbackDeclineToast()
  await answerCallback(callbackId, successMessage)

  const pe = parseFloat(booking.partner_earnings_thb)
  const partnerEarnings =
    Number.isFinite(pe) && pe >= 0 ? pe : Math.max(0, (booking.price_thb || 0) - (booking.commission_thb || 0))
  const listingTitle = booking.listing?.title || t.listingFallbackTitle()
  const updatedText =
    action === 'approve'
      ? t.bookingApprovedBody({
          listingTitle,
          guestName: booking.guest_name || '—',
          checkIn: booking.check_in,
          checkOut: booking.check_out,
          partnerEarningsFormatted: `฿${partnerEarnings.toLocaleString(loc)}`,
        })
      : t.bookingDeclinedBody({
          listingTitle,
          guestName: booking.guest_name || '—',
          checkIn: booking.check_in,
          checkOut: booking.check_out,
        })

  await editTelegramMessage(chatId, message.message_id, updatedText)
  console.log(`[BOOKING CALLBACK] ${action} booking ${bookingId} by user ${from?.id} via FSM`)
  return NextResponse.json({ ok: true })
}

export async function handleCallbackQuery(callbackQuery) {
  const { id: callbackId, data, from, message } = callbackQuery
  const chatId = message?.chat?.id
  const { supabaseUrl, serviceKey } = telegramEnv()

  if (data?.startsWith('menu:')) {
    return handleBotMenuCallback(callbackQuery)
  }

  try {
    const match = data?.match(/^(approve|decline)_booking_(.+)$/)
    if (!match) {
      const t = getTelegramMessages(normalizeTelegramUiLang(from?.language_code))
      await answerCallback(callbackId, t.callbackUnknown())
      return NextResponse.json({ ok: true })
    }

    const action = match[1]
    const bookingId = match[2]

    const bookingRes = await fetch(
      `${supabaseUrl}/rest/v1/bookings?id=eq.${bookingId}&select=*,listing:listings(title,owner_id),partner:profiles!bookings_partner_id_fkey(id,telegram_id,first_name,language,preferred_language)`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    )
    const bookings = await bookingRes.json()
    const booking = bookings?.[0]

    const lang = resolveTelegramLang({
      preferred_language: booking?.partner?.preferred_language,
      language: booking?.partner?.language,
      telegramLanguageCode: from?.language_code,
    })
    const t = getTelegramMessages(lang)
    const loc = lang === 'ru' ? 'ru-RU' : lang === 'th' ? 'th-TH' : lang === 'zh' ? 'zh-CN' : 'en-US'

    if (!booking) {
      await answerCallback(callbackId, t.callbackBookingNotFound())
      return NextResponse.json({ ok: true })
    }

    if (booking.partner?.telegram_id?.toString() !== from?.id?.toString()) {
      await answerCallback(callbackId, t.callbackNoPermission())
      return NextResponse.json({ ok: true })
    }

    if (booking.status !== 'PENDING') {
      await answerCallback(callbackId, t.callbackAlreadyHandled(booking.status))
      return NextResponse.json({ ok: true })
    }

    return await applyTelegramPartnerBookingDecision({
      bookingId,
      action,
      booking,
      from,
      callbackId,
      chatId,
      message,
      t,
      loc,
    })
  } catch (error) {
    console.error('[CALLBACK ERROR]', error)
    try {
      const match = data?.match(/^(approve|decline)_booking_(.+)$/)
      if (match) {
        alertTelegramBookingFsmFailure({
          bookingId: match[2],
          action: match[1],
          error: error?.message || String(error),
          fromId: from?.id,
        })
      }
    } catch {
      /* ignore alert failure */
    }
    await answerCallback(callbackId, getTelegramMessages('en').callbackGenericError())
    return NextResponse.json({ ok: true })
  }
}
