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

const MENU_ACTIONS = new Set([
  'help',
  'my',
  'status',
  'lazy',
  'lazy_hint',
  'guest_on',
  'partner_mode',
])

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
      `${supabaseUrl}/rest/v1/bookings?id=eq.${bookingId}&select=*,listing:listings(title,owner_id),partner:profiles!bookings_partner_id_fkey(telegram_id,first_name,language)`,
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
      profileLanguage: booking?.partner?.language,
      telegramLanguageCode: from?.language_code,
    })
    const t = getTelegramMessages(lang)
    const loc = lang === 'ru' ? 'ru-RU' : 'en-US'

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

    const newStatus = action === 'approve' ? 'CONFIRMED' : 'CANCELLED'
    const timestamp = new Date().toISOString()

    const updateData = {
      status: newStatus,
      updated_at: timestamp,
      ...(action === 'approve' ? { confirmed_at: timestamp } : { cancelled_at: timestamp }),
    }

    const updateRes = await fetch(`${supabaseUrl}/rest/v1/bookings?id=eq.${bookingId}`, {
      method: 'PATCH',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    })

    if (!updateRes.ok) {
      await answerCallback(callbackId, t.callbackUpdateError())
      return NextResponse.json({ ok: true })
    }

    const successMessage =
      action === 'approve' ? t.callbackApproveToast() : t.callbackDeclineToast()
    await answerCallback(callbackId, successMessage)

    const partnerEarnings = (booking.price_thb || 0) - (booking.commission_thb || 0)
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

    console.log(`[BOOKING CALLBACK] ${action} booking ${bookingId} by user ${from?.id}`)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[CALLBACK ERROR]', error)
    await answerCallback(callbackId, getTelegramMessages('en').callbackGenericError())
    return NextResponse.json({ ok: true })
  }
}
