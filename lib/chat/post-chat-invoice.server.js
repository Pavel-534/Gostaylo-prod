/**
 * Stage 110.4 — SSOT server: POST/GET /api/v2/chat/invoice.
 * Сообщение в чат — `executePostChatMessageForUser` (post-chat-message.server.js).
 * Клиент: `lib/chat/post-chat-invoice.js`
 */

import { supabaseAdmin } from '@/lib/supabase'
import { getSessionPayload } from '@/lib/services/session-service'
import {
  canWriteConversation,
  effectiveRoleFromProfile,
  userParticipatesInConversation,
} from '@/lib/services/chat/access'
import { PricingService } from '@/lib/services/pricing.service'
import { settleInvoiceDisplayAmount } from '@/lib/pricing/fx-display.js'
import { CalendarService } from '@/lib/services/calendar.service'
import { executePostChatMessageForUser } from '@/lib/chat/post-chat-message.server.js'
import { ensureInquiryBookingForChatInvoice } from '@/lib/chat/ensure-inquiry-booking-for-invoice.server.js'
import { syncBookingForPayableChatInvoice } from '@/lib/chat/sync-booking-for-chat-invoice.server.js'
import { logStructured, recordCriticalSignal } from '@/lib/critical-telemetry.js'
import { addListingDays } from '@/lib/listing-date'
import { releaseInquirySoftHold } from '@/lib/booking/inquiry-soft-hold.js'
import { INVOICE_HOLD_SOURCE } from '@/lib/calendar/block-source-display.js'
import {
  buildInvoicePaymentWindowSystemMessage,
  resolvePaymentWindowExpiresAt,
  resolvePaymentWindowMinutes,
} from '@/lib/booking/payment-window-policy.js'
import { resolveGuestNotifyLocale } from '@/lib/i18n/resolve-notify-locale.js'

const INVOICE_BOOKING_REQUIRED_MESSAGE =
  'Невозможно выставить счет без указания дат или ID бронирования'

function logChatInvoiceGateEvent({
  level = 'warn',
  status,
  error,
  conversationId,
  listingId,
  hostUserId,
  extra = {},
}) {
  logStructured({
    module: 'post-chat-invoice',
    stage: 'ADR-172',
    level,
    httpStatus: status,
    error,
    conversationId: conversationId || undefined,
    listingId: listingId || undefined,
    hostUserId: hostUserId || undefined,
    ...extra,
  })
  if (status === 400 || status === 409) {
    recordCriticalSignal('CHAT_INVOICE_GATE_REJECT', {
      tag: '[CHAT_INVOICE]',
      threshold: 8,
      windowMs: 10 * 60 * 1000,
      detailLines: [
        `status=${status}`,
        `error=${error || 'unknown'}`,
        `conversationId=${conversationId || '—'}`,
        `listingId=${listingId || '—'}`,
        `hostUserId=${hostUserId || '—'}`,
      ],
    })
  }
}

/** @returns {{ status: number, body: object }} */
function chatApiJson(body, status = 200) {
  return { status, body }
}

/** Occupied nights [check_in, check_out) — last night is day before check_out (iCal / booking SSOT). */
function invoiceHoldBlockEndDate(checkIn, checkOut) {
  const cin = String(checkIn || '').slice(0, 10)
  const cout = String(checkOut || '').slice(0, 10)
  if (!cin || !cout || cout <= cin) return cout || null
  return addListingDays(cout, -1)
}

async function fetchProfile(userId) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id,first_name,last_name,role,email')
    .eq('id', userId)
    .single()
  return data ?? null
}

async function fetchConversation(conversationId) {
  const { data } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single()
  return data ?? null
}

export async function executePostChatInvoice(request) {
  try {
    const session = await getSessionPayload()
    if (!session?.userId) {
      return chatApiJson({ success: false, error: 'Unauthorized' }, 401)
    }
    const userId = session.userId

    const body = await request.json()
    const {
      conversationId,
      amount,
      currency = 'THB',
      paymentMethod = 'CARD',
      description,
      bookingId: bookingIdCamel,
      booking_id: bookingIdSnake,
      listingId: listingIdCamel,
      listing_id: listingIdSnake,
      listingTitle,
      checkIn: checkInCamel,
      check_in: checkInSnake,
      checkOut: checkOutCamel,
      check_out: checkOutSnake,
      guestsCount: rawHoldGuests,
      guests_count: rawHoldGuestsSnake,
      intent: rawIntent,
      newCheckOut: rawNewCheckOut,
      new_check_out: rawNewCheckOutSnake,
    } = body

    const requestBookingId = bookingIdCamel ?? bookingIdSnake ?? null
    const requestListingId = listingIdCamel ?? listingIdSnake ?? null
    const requestCheckIn = checkInCamel ?? checkInSnake ?? null
    const requestCheckOut = checkOutCamel ?? checkOutSnake ?? null

    if (!conversationId || !amount) {
      return chatApiJson(
        { success: false, error: 'conversationId and amount are required' },
        400,
      )
    }

    const [conversation, profile] = await Promise.all([
      fetchConversation(conversationId),
      fetchProfile(userId),
    ])

    if (!conversation) {
      return chatApiJson({ success: false, error: 'Conversation not found' }, 404)
    }

    const accessRole = effectiveRoleFromProfile(profile)

    if (!canWriteConversation(userId, accessRole, conversation)) {
      return chatApiJson({ success: false, error: 'Forbidden' }, 403)
    }

    const isHost =
      String(conversation.partner_id) === String(userId) ||
      String(conversation.owner_id) === String(userId)
    if (!isHost && accessRole !== 'ADMIN' && accessRole !== 'MODERATOR') {
      return chatApiJson(
        { success: false, error: 'Only the host can create invoices' },
        403,
      )
    }

    const invoiceId = `inv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const parsedAmount = parseFloat(amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return chatApiJson(
        { success: false, error: 'amount must be a positive number' },
        400,
      )
    }

    let listingCategorySlug = ''
    let holdMinutes = resolvePaymentWindowMinutes(null)
    const invoiceCreatedAt = new Date().toISOString()
    let expiresAtIso = resolvePaymentWindowExpiresAt(null, invoiceCreatedAt)

    const cur = String(currency || 'THB').toUpperCase()
    if (!['THB', 'USDT', 'USD', 'RUB'].includes(cur)) {
      return chatApiJson({ success: false, error: 'Unsupported currency' }, 400)
    }
    const payMethod = String(paymentMethod || 'CARD').toUpperCase()
    if (!['CARD', 'MIR', 'CRYPTO'].includes(payMethod)) {
      return chatApiJson({ success: false, error: 'Unsupported payment method' }, 400)
    }
    const allowedMethods =
      payMethod === 'CRYPTO' ? ['CRYPTO', 'CARD', 'MIR'] : [payMethod, 'CARD', 'MIR', 'CRYPTO']
    const { amountThb, amountUsdt: usdtAmount } = await settleInvoiceDisplayAmount(parsedAmount, cur)
    if (!amountThb || amountThb <= 0) {
      return chatApiJson(
        { success: false, error: 'Could not convert amount to THB (missing FX rate)' },
        400,
      )
    }

    const effectiveListingId = requestListingId || conversation.listing_id || null

    let effectiveBookingId = requestBookingId || conversation.booking_id || null

    if (!effectiveBookingId && requestCheckIn && requestCheckOut) {
      const lazy = await ensureInquiryBookingForChatInvoice({
        conversation,
        listingId: effectiveListingId,
        checkIn: requestCheckIn,
        checkOut: requestCheckOut,
        guestsCount: rawHoldGuests ?? rawHoldGuestsSnake ?? 1,
        hostUserId: userId,
      })
      if (!lazy.ok) {
        const status = lazy.status || 400
        logChatInvoiceGateEvent({
          status,
          error: lazy.error,
          conversationId,
          listingId: effectiveListingId,
          hostUserId: userId,
          extra: { code: lazy.code || null, path: 'lazy_inquiry' },
        })
        return chatApiJson(
          {
            success: false,
            error: lazy.error || 'inquiry_booking_failed',
            code: lazy.code || null,
          },
          status,
        )
      }
      effectiveBookingId = lazy.bookingId
    }

    if (!effectiveBookingId) {
      logChatInvoiceGateEvent({
        status: 400,
        error: 'INVOICE_BOOKING_REQUIRED',
        conversationId,
        listingId: effectiveListingId,
        hostUserId: userId,
        extra: { hasCheckIn: !!requestCheckIn, hasCheckOut: !!requestCheckOut },
      })
      return chatApiJson(
        {
          success: false,
          error: 'INVOICE_BOOKING_REQUIRED',
          message: INVOICE_BOOKING_REQUIRED_MESSAGE,
        },
        400,
      )
    }

    const partnerIdForFee = conversation.partner_id || conversation.owner_id
    const commission =
      partnerIdForFee && amountThb > 0
        ? await PricingService.calculateCommission(amountThb, partnerIdForFee)
        : {
            commissionRate: 0,
            commissionThb: 0,
            partnerEarnings: amountThb,
            priceThb: amountThb,
          }

    const intent = String(rawIntent || '').trim().toLowerCase()
    if (intent && intent !== 'extension') {
      return chatApiJson({ success: false, error: 'Unsupported intent' }, 400)
    }

    let effCheckIn = requestCheckIn ? String(requestCheckIn).slice(0, 10) : null
    let effCheckOut = requestCheckOut ? String(requestCheckOut).slice(0, 10) : null
    let effGuests = Math.max(1, parseInt(rawHoldGuests ?? rawHoldGuestsSnake ?? 1, 10) || 1)
    let bookingRow = null

    if (effectiveBookingId) {
      const { data: bRow } = await supabaseAdmin
        .from('bookings')
        .select('check_in, check_out, guests_count')
        .eq('id', effectiveBookingId)
        .maybeSingle()
      bookingRow = bRow || null
      if (bRow) {
        effCheckIn = effCheckIn || String(bRow.check_in).slice(0, 10)
        effCheckOut = effCheckOut || String(bRow.check_out).slice(0, 10)
        effGuests = Math.max(1, parseInt(bRow.guests_count, 10) || effGuests)
      }
    }

    let holdUnitsBlocked = effGuests
    if (effectiveListingId) {
      const { data: listingCapRow } = await supabaseAdmin
        .from('listings')
        .select('max_capacity, category_id, metadata, categories(slug)')
        .eq('id', effectiveListingId)
        .maybeSingle()
      const listingMaxCap = Math.max(1, parseInt(listingCapRow?.max_capacity, 10) || 1)
      holdUnitsBlocked = Math.min(effGuests, listingMaxCap)
      const catRel = listingCapRow?.categories
      const catSlugFromRel = Array.isArray(catRel)
        ? String(catRel[0]?.slug || '')
        : String(catRel?.slug || '')
      const meta =
        listingCapRow?.metadata && typeof listingCapRow.metadata === 'object'
          ? listingCapRow.metadata
          : {}
      listingCategorySlug = String(
        catSlugFromRel || meta.category_slug || meta.categorySlug || '',
      )
        .toLowerCase()
        .trim()
      holdMinutes = resolvePaymentWindowMinutes(listingCategorySlug)
      expiresAtIso = resolvePaymentWindowExpiresAt(listingCategorySlug, invoiceCreatedAt)
    }

    let extensionMeta = null
    if (intent === 'extension') {
      if (!effectiveBookingId) {
        return chatApiJson(
          { success: false, error: 'bookingId is required for extension intent' },
          400,
        )
      }
      if (!bookingRow?.check_out) {
        return chatApiJson(
          { success: false, error: 'Booking not found for extension intent' },
          404,
        )
      }

      const nextOutRaw = rawNewCheckOut ?? rawNewCheckOutSnake
      if (!nextOutRaw) {
        return chatApiJson(
          { success: false, error: 'new_check_out is required for extension intent' },
          400,
        )
      }

      const baseOut = new Date(bookingRow.check_out)
      const nextOut = new Date(nextOutRaw)
      if (!Number.isFinite(baseOut.getTime()) || !Number.isFinite(nextOut.getTime())) {
        return chatApiJson(
          { success: false, error: 'Invalid extension date format' },
          400,
        )
      }
      if (nextOut.getTime() <= baseOut.getTime()) {
        return chatApiJson(
          { success: false, error: 'new_check_out must be later than current booking check_out' },
          400,
        )
      }

      extensionMeta = {
        intent: 'extension',
        new_check_out: nextOut.toISOString(),
        base_check_out: baseOut.toISOString(),
      }
    }

    const holdBlockEndDate = invoiceHoldBlockEndDate(effCheckIn, effCheckOut)

    if (effectiveListingId && effCheckIn && holdBlockEndDate) {
      if (effectiveBookingId && intent !== 'extension') {
        await releaseInquirySoftHold(effectiveBookingId)
      }

      const fit = await CalendarService.validateManualBlockFits(
        effectiveListingId,
        effCheckIn,
        holdBlockEndDate,
        holdUnitsBlocked,
      )
      if (!fit.success) {
        logChatInvoiceGateEvent({
          status: 409,
          error: fit.error || 'calendar_conflict',
          conversationId,
          listingId: effectiveListingId,
          hostUserId: userId,
          extra: { path: 'invoice_hold_validate' },
        })
        return chatApiJson(
          {
            success: false,
            error: fit.error || 'Cannot soft-hold inventory for these dates',
            conflicts: fit.conflicts || null,
          },
          409,
        )
      }

      const holdUntil = expiresAtIso
      const { error: holdErr } = await supabaseAdmin.from('calendar_blocks').insert({
        listing_id: effectiveListingId,
        start_date: effCheckIn,
        end_date: holdBlockEndDate,
        source: INVOICE_HOLD_SOURCE,
        units_blocked: holdUnitsBlocked,
        reason: `Invoice ${invoiceId} — payment pending (${holdMinutes}m)`,
        expires_at: holdUntil,
      })
      if (holdErr) {
        console.warn('[invoice] soft-hold insert:', holdErr.message)
      }
    }

    const invoice = {
      id: invoiceId,
      amount: parsedAmount,
      amount_usdt: usdtAmount,
      amount_thb: amountThb,
      currency: cur,
      payment_method: payMethod,
      allowed_payment_methods: [...new Set(allowedMethods)],
      status: 'PENDING',
      description,
      booking_id: effectiveBookingId,
      listing: { id: effectiveListingId, title: listingTitle },
      check_in: effCheckIn || requestCheckIn,
      check_out: effCheckOut || requestCheckOut,
      hold_minutes: holdMinutes,
      guests_held: effGuests,
      commission_rate: commission.commissionRate,
      commission_thb: commission.commissionThb,
      partner_earnings_thb: commission.partnerEarnings,
      created_at: invoiceCreatedAt,
      expires_at: expiresAtIso,
      ...(extensionMeta || {}),
    }

    const currencySymbol = cur === 'THB' ? '฿' : cur === 'RUB' ? '₽' : '$'
    const line = `💳 Invoice: ${currencySymbol}${parsedAmount.toLocaleString()} ${cur}`

    const { error: invTableError } = await supabaseAdmin.from('invoices').insert({
      id: invoiceId,
      conversation_id: conversationId,
      booking_id: invoice.booking_id,
      amount: parsedAmount,
      status: 'pending',
      metadata: {
        currency: cur,
        payment_method: payMethod,
        allowed_payment_methods: [...new Set(allowedMethods)],
        description: description || null,
        listing: invoice.listing,
        check_in: invoice.check_in,
        check_out: invoice.check_out,
        amount_thb: amountThb,
        hold_minutes: holdMinutes,
        expires_at: expiresAtIso,
        payment_window_tier: listingCategorySlug || null,
        guests_held: effGuests,
        commission_rate: commission.commissionRate,
        commission_thb: commission.commissionThb,
        partner_earnings_thb: commission.partnerEarnings,
        ...(extensionMeta || {}),
      },
      created_at: invoiceCreatedAt,
    })

    if (invTableError) {
      logStructured({
        module: 'post-chat-invoice',
        stage: 'ADR-172',
        level: 'error',
        error: invTableError.message,
        conversationId,
        listingId: effectiveListingId,
        hostUserId: userId,
        bookingId: effectiveBookingId,
        invoiceId,
      })
      return chatApiJson(
        {
          success: false,
          error: 'invoice_insert_failed',
          message: invTableError.message || 'Could not persist invoice',
        },
        500,
      )
    }

    if (intent !== 'extension') {
      const syncResult = await syncBookingForPayableChatInvoice({
        bookingId: effectiveBookingId,
        invoiceId,
        amountThb,
        commission,
        hostUserId: userId,
        invoiceExpiresAt: expiresAtIso,
      })
      if (!syncResult.ok) {
        logChatInvoiceGateEvent({
          level: 'error',
          status: 500,
          error: syncResult.error || 'booking_sync_failed',
          conversationId,
          listingId: effectiveListingId,
          hostUserId: userId,
          extra: { bookingId: effectiveBookingId, invoiceId, path: 'special_offer_sync' },
        })
        return chatApiJson(
          {
            success: false,
            error: 'booking_sync_failed',
            message: syncResult.error || 'Could not prepare booking for payment',
          },
          500,
        )
      }
    }

    const postResult = await executePostChatMessageForUser(userId, {
      conversationId,
      type: 'invoice',
      content: line,
      metadata: { invoice, invoice_id: invoiceId },
    })

    if (!postResult.body?.success) {
      return chatApiJson(postResult.body, postResult.status)
    }

    if (intent !== 'extension') {
      let guestLang = 'ru'
      if (effectiveBookingId) {
        const { data: bookingForLocale } = await supabaseAdmin
          .from('bookings')
          .select('renter_id, metadata')
          .eq('id', effectiveBookingId)
          .maybeSingle()
        guestLang = await resolveGuestNotifyLocale(bookingForLocale, null)
      }
      const paymentWindowNotice = buildInvoicePaymentWindowSystemMessage(
        listingCategorySlug,
        guestLang,
      )
      const noticeResult = await executePostChatMessageForUser(userId, {
        conversationId,
        type: 'system',
        content: paymentWindowNotice,
        metadata: {
          system_key: 'invoice_payment_window_notice',
          hold_minutes: holdMinutes,
          expires_at: expiresAtIso,
          invoice_id: invoiceId,
        },
      })
      if (!noticeResult.body?.success) {
        console.warn(
          '[invoice] payment window system notice failed:',
          noticeResult.body?.error || noticeResult.status,
        )
      }
    }

    return chatApiJson({
      success: true,
      message: postResult.body.data,
      invoice,
    })
  } catch (error) {
    console.error('[invoice] unexpected error:', error)
    return chatApiJson({ success: false, error: error.message }, 500)
  }
}

export async function executeGetChatInvoices(request) {
  const session = await getSessionPayload()
  if (!session?.userId) {
    return chatApiJson({ success: false, error: 'Unauthorized' }, 401)
  }
  const userId = session.userId

  const { searchParams } = new URL(request.url)
  const invoiceId = searchParams.get('id')
  const conversationId = searchParams.get('conversationId')

  if (!invoiceId && !conversationId) {
    return chatApiJson(
      { success: false, error: 'invoiceId or conversationId required' },
      400,
    )
  }

  try {
    if (conversationId) {
      const conv = await fetchConversation(conversationId)
      if (!conv) {
        return chatApiJson({ success: false, error: 'Not found' }, 404)
      }
      const profile = await fetchProfile(userId)
      const accessRole = effectiveRoleFromProfile(profile)
      if (
        !canWriteConversation(userId, accessRole, conv) &&
        !userParticipatesInConversation(userId, conv)
      ) {
        return chatApiJson({ success: false, error: 'Forbidden' }, 403)
      }
    }

    if (invoiceId) {
      const { data: invRow, error: invErr } = await supabaseAdmin
        .from('invoices')
        .select('id,conversation_id,booking_id,amount,status,metadata,created_at')
        .eq('id', invoiceId)
        .maybeSingle()
      if (invErr) {
        return chatApiJson({ success: false, error: invErr.message }, 400)
      }
      if (!invRow) {
        return chatApiJson({ success: false, error: 'Not found' }, 404)
      }
      const conv = await fetchConversation(invRow.conversation_id)
      if (!conv) {
        return chatApiJson({ success: false, error: 'Not found' }, 404)
      }
      const profile = await fetchProfile(userId)
      const accessRole = effectiveRoleFromProfile(profile)
      if (
        !canWriteConversation(userId, accessRole, conv) &&
        !userParticipatesInConversation(userId, conv)
      ) {
        return chatApiJson({ success: false, error: 'Forbidden' }, 403)
      }
      const invMeta = invRow.metadata && typeof invRow.metadata === 'object' ? invRow.metadata : {}
      const one = {
        id: invRow.id,
        booking_id: invRow.booking_id || null,
        amount: Number(invRow.amount || invMeta.amount || 0),
        status: String(invRow.status || 'pending').toUpperCase(),
        currency: String(invMeta.currency || 'THB').toUpperCase(),
        payment_method: String(invMeta.payment_method || 'CARD').toUpperCase(),
        allowed_payment_methods: Array.isArray(invMeta.allowed_payment_methods)
          ? invMeta.allowed_payment_methods
          : null,
        amount_thb: invMeta.amount_thb ?? null,
        amount_usdt: invMeta.amount_usdt ?? null,
        listing: invMeta.listing || null,
        check_in: invMeta.check_in || null,
        check_out: invMeta.check_out || null,
        description: invMeta.description || null,
        createdAt: invRow.created_at,
      }
      return chatApiJson({ success: true, invoices: [one] })
    }

    let query = supabaseAdmin
      .from('messages')
      .select('*')
      .or('type.eq.invoice,type.eq.INVOICE')

    if (conversationId) query = query.eq('conversation_id', conversationId)

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      return chatApiJson({ success: false, error: error.message }, 400)
    }

    const invoices = (data || []).map((m) => ({
      messageId: m.id,
      ...m.metadata?.invoice,
      createdAt: m.created_at,
    }))

    return chatApiJson({ success: true, invoices })
  } catch (error) {
    console.error('[invoice GET] error:', error)
    return chatApiJson({ success: false, error: error.message }, 500)
  }
}
