/**
 * GoStayLo — Chat Invoice API
 * POST /api/v2/chat/invoice  — Creates an invoice message in chat
 * GET  /api/v2/chat/invoice?conversationId=  — List invoice messages for a conversation
 *
 * Security: senderId is always taken from the server-side session.
 * Clients MUST NOT pass senderId in the request body — it is ignored.
 */

import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { getSessionPayload } from '@/lib/services/session-service'
import {
  canWriteConversation,
  effectiveRoleFromProfile,
  userParticipatesInConversation,
} from '@/lib/services/chat/access'
import { getEffectiveRate } from '@/lib/services/currency.service'
import { formatPrivacyDisplayNameForParticipant } from '@/lib/utils/name-formatter'
import { PricingService } from '@/lib/services/pricing.service'
import { CalendarService } from '@/lib/services/calendar.service'

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

export async function POST(request) {
  try {
    // ── Authentication ────────────────────────────────────────────────────
    const session = await getSessionPayload()
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.userId

    const body = await request.json()
    const {
      conversationId,
      amount,
      currency = 'THB',
      paymentMethod = 'CARD',
      description,
      bookingId,
      listingId,
      listingTitle,
      checkIn,
      checkOut,
      holdHours: rawHoldHours,
      guestsCount: rawHoldGuests,
      guests_count: rawHoldGuestsSnake,
      intent: rawIntent,
      newCheckOut: rawNewCheckOut,
      new_check_out: rawNewCheckOutSnake,
    } = body

    if (!conversationId || !amount) {
      return NextResponse.json(
        { success: false, error: 'conversationId and amount are required' },
        { status: 400 }
      )
    }

    // ── Authorization ─────────────────────────────────────────────────────
    const [conversation, profile] = await Promise.all([
      fetchConversation(conversationId),
      fetchProfile(userId),
    ])

    if (!conversation) {
      return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 })
    }

    const accessRole = effectiveRoleFromProfile(profile)

    // canWriteConversation already checks participation; one call is enough.
    if (!canWriteConversation(userId, accessRole, conversation)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const isHost =
      String(conversation.partner_id) === String(userId) ||
      String(conversation.owner_id) === String(userId)
    if (!isHost && accessRole !== 'ADMIN' && accessRole !== 'MODERATOR') {
      return NextResponse.json(
        { success: false, error: 'Only the host can create invoices' },
        { status: 403 }
      )
    }

    // ── Build invoice ─────────────────────────────────────────────────────
    const senderName = formatPrivacyDisplayNameForParticipant(
      profile?.first_name,
      profile?.last_name,
      profile?.email,
      'Partner'
    )

    const invoiceId = `inv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const parsedAmount = parseFloat(amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ success: false, error: 'amount must be a positive number' }, { status: 400 })
    }

    const holdHours = Math.min(168, Math.max(1, parseInt(rawHoldHours ?? 24, 10) || 24))
    const holdMs = holdHours * 60 * 60 * 1000

    const cur = String(currency || 'THB').toUpperCase()
    if (!['THB', 'USDT', 'USD', 'RUB'].includes(cur)) {
      return NextResponse.json({ success: false, error: 'Unsupported currency' }, { status: 400 })
    }
    const payMethod = String(paymentMethod || 'CARD').toUpperCase()
    if (!['CARD', 'MIR', 'CRYPTO'].includes(payMethod)) {
      return NextResponse.json({ success: false, error: 'Unsupported payment method' }, { status: 400 })
    }
    const allowedMethods = payMethod === 'CRYPTO' ? ['CRYPTO', 'CARD', 'MIR'] : [payMethod, 'CARD', 'MIR', 'CRYPTO']
    let usdtAmount
    let amountThb
    if (cur === 'THB') {
      const mult = await getEffectiveRate('THB', 'USDT')
      usdtAmount = Math.round(parsedAmount * mult * 100) / 100
      amountThb = Math.round(parsedAmount)
    } else {
      const multToThb = await getEffectiveRate(cur, 'THB')
      amountThb = Math.round(parsedAmount * multToThb)
      const multThbToUsdt = await getEffectiveRate('THB', 'USDT')
      usdtAmount = Math.round(amountThb * multThbToUsdt * 100) / 100
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

    const effectiveListingId = listingId || conversation.listing_id || null
    const effectiveBookingId = bookingId || conversation.booking_id || null
    const intent = String(rawIntent || '').trim().toLowerCase()
    if (intent && intent !== 'extension') {
      return NextResponse.json({ success: false, error: 'Unsupported intent' }, { status: 400 })
    }

    let effCheckIn = checkIn ? String(checkIn).slice(0, 10) : null
    let effCheckOut = checkOut ? String(checkOut).slice(0, 10) : null
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

    let extensionMeta = null
    if (intent === 'extension') {
      if (!effectiveBookingId) {
        return NextResponse.json(
          { success: false, error: 'bookingId is required for extension intent' },
          { status: 400 },
        )
      }
      if (!bookingRow?.check_out) {
        return NextResponse.json(
          { success: false, error: 'Booking not found for extension intent' },
          { status: 404 },
        )
      }

      const nextOutRaw = rawNewCheckOut ?? rawNewCheckOutSnake
      if (!nextOutRaw) {
        return NextResponse.json(
          { success: false, error: 'new_check_out is required for extension intent' },
          { status: 400 },
        )
      }

      const baseOut = new Date(bookingRow.check_out)
      const nextOut = new Date(nextOutRaw)
      if (!Number.isFinite(baseOut.getTime()) || !Number.isFinite(nextOut.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid extension date format' },
          { status: 400 },
        )
      }
      if (nextOut.getTime() <= baseOut.getTime()) {
        return NextResponse.json(
          { success: false, error: 'new_check_out must be later than current booking check_out' },
          { status: 400 },
        )
      }

      extensionMeta = {
        intent: 'extension',
        new_check_out: nextOut.toISOString(),
        base_check_out: baseOut.toISOString(),
      }
    }

    if (effectiveListingId && effCheckIn && effCheckOut) {
      const fit = await CalendarService.validateManualBlockFits(
        effectiveListingId,
        effCheckIn,
        effCheckOut,
        effGuests
      )
      if (!fit.success) {
        return NextResponse.json(
          {
            success: false,
            error: fit.error || 'Cannot soft-hold inventory for these dates',
            conflicts: fit.conflicts || null,
          },
          { status: 409 }
        )
      }

      const holdUntil = new Date(Date.now() + holdMs).toISOString()
      const { error: holdErr } = await supabaseAdmin.from('calendar_blocks').insert({
        listing_id: effectiveListingId,
        start_date: effCheckIn,
        end_date: effCheckOut,
        source: 'invoice_hold',
        units_blocked: effGuests,
        reason: `Invoice ${invoiceId} — payment pending (${holdHours}h)`,
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
      check_in: effCheckIn || checkIn,
      check_out: effCheckOut || checkOut,
      hold_hours: holdHours,
      guests_held: effGuests,
      commission_rate: commission.commissionRate,
      commission_thb: commission.commissionThb,
      partner_earnings_thb: commission.partnerEarnings,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + holdMs).toISOString(),
      ...(extensionMeta || {}),
    }

    const currencySymbol = cur === 'THB' ? '฿' : cur === 'RUB' ? '₽' : '$'
    const line = `💳 Invoice: ${currencySymbol}${parsedAmount.toLocaleString()} ${cur}`

    // ── Persist invoice row ───────────────────────────────────────────────
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
        hold_hours: holdHours,
        guests_held: effGuests,
        commission_rate: commission.commissionRate,
        commission_thb: commission.commissionThb,
        partner_earnings_thb: commission.partnerEarnings,
        ...(extensionMeta || {}),
      },
    })

    if (invTableError) {
      console.warn('[invoice] invoices table insert warn:', invTableError.message)
    }

    // ── Persist message ───────────────────────────────────────────────────
    const messageId = `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const now = new Date().toISOString()

    const { data: message, error: messageError } = await supabaseAdmin
      .from('messages')
      .insert({
        id: messageId,
        conversation_id: conversationId,
        sender_id: userId,
        sender_role: accessRole,
        sender_name: senderName,
        message: line,
        content: line,
        type: 'invoice',
        metadata: { invoice, invoice_id: invoiceId },
        is_read: false,
        created_at: now,
      })
      .select()
      .single()

    if (messageError) {
      console.error('[invoice] message insert error:', messageError)
      return NextResponse.json(
        { success: false, error: messageError.message },
        { status: 400 }
      )
    }

    // Update conversation timestamp
    await supabaseAdmin
      .from('conversations')
      .update({ updated_at: now, last_message_at: now })
      .eq('id', conversationId)

    return NextResponse.json({ success: true, message, invoice })
  } catch (error) {
    console.error('[invoice] unexpected error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function GET(request) {
  const session = await getSessionPayload()
  if (!session?.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.userId

  const { searchParams } = new URL(request.url)
  const invoiceId = searchParams.get('id')
  const conversationId = searchParams.get('conversationId')

  if (!invoiceId && !conversationId) {
    return NextResponse.json(
      { success: false, error: 'invoiceId or conversationId required' },
      { status: 400 }
    )
  }

  try {
    // Authorization: verify caller participates
    if (conversationId) {
      const conv = await fetchConversation(conversationId)
      if (!conv) {
        return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
      }
      const profile = await fetchProfile(userId)
      const accessRole = effectiveRoleFromProfile(profile)
      if (!canWriteConversation(userId, accessRole, conv) && !userParticipatesInConversation(userId, conv)) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      }
    }

    if (invoiceId) {
      const { data: invRow, error: invErr } = await supabaseAdmin
        .from('invoices')
        .select('id,conversation_id,booking_id,amount,status,metadata,created_at')
        .eq('id', invoiceId)
        .maybeSingle()
      if (invErr) {
        return NextResponse.json({ success: false, error: invErr.message }, { status: 400 })
      }
      if (!invRow) {
        return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
      }
      const conv = await fetchConversation(invRow.conversation_id)
      if (!conv) {
        return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
      }
      const profile = await fetchProfile(userId)
      const accessRole = effectiveRoleFromProfile(profile)
      if (!canWriteConversation(userId, accessRole, conv) && !userParticipatesInConversation(userId, conv)) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
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
      return NextResponse.json({ success: true, invoices: [one] })
    }

    let query = supabaseAdmin
      .from('messages')
      .select('*')
      .or('type.eq.invoice,type.eq.INVOICE')

    if (conversationId) query = query.eq('conversation_id', conversationId)

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }

    const invoices = (data || []).map((m) => ({
      messageId: m.id,
      ...m.metadata?.invoice,
      createdAt: m.created_at,
    }))

    return NextResponse.json({ success: true, invoices })
  } catch (error) {
    console.error('[invoice GET] error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
