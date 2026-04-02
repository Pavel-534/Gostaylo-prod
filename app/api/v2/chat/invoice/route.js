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
import { getEffectiveRate } from '@/lib/services/currency-helper'

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
      // senderId intentionally omitted — comes from session only
      amount,
      currency = 'THB',
      paymentMethod = 'CRYPTO',
      description,
      bookingId,
      listingId,
      listingTitle,
      checkIn,
      checkOut,
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
    const senderName =
      [profile?.first_name, profile?.last_name?.replace(' [MODERATOR]', '')]
        .filter(Boolean)
        .join(' ')
        .trim() ||
      profile?.email ||
      'Partner'

    const invoiceId = `inv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const parsedAmount = parseFloat(amount)
    const cur = String(currency || 'THB').toUpperCase()
    let usdtAmount
    let amountThb
    if (cur === 'THB') {
      const mult = await getEffectiveRate('THB', 'USDT')
      usdtAmount = Math.round(parsedAmount * mult * 100) / 100
      amountThb = parsedAmount
    } else {
      usdtAmount = parsedAmount
      const mult = await getEffectiveRate('USDT', 'THB')
      amountThb = Math.round(parsedAmount * mult)
    }

    const invoice = {
      id: invoiceId,
      amount: parsedAmount,
      amount_usdt: usdtAmount,
      amount_thb: amountThb,
      currency,
      payment_method: paymentMethod,
      status: 'PENDING',
      description,
      booking_id: bookingId || conversation.booking_id || null,
      listing: { id: listingId || conversation.listing_id, title: listingTitle },
      check_in: checkIn,
      check_out: checkOut,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }

    const line = `💳 Invoice: ${currency === 'THB' ? '฿' : '$'}${parsedAmount.toLocaleString()} ${currency}`

    // ── Persist invoice row ───────────────────────────────────────────────
    const { error: invTableError } = await supabaseAdmin.from('invoices').insert({
      id: invoiceId,
      conversation_id: conversationId,
      booking_id: invoice.booking_id,
      amount: parsedAmount,
      status: 'pending',
      metadata: {
        currency,
        payment_method: paymentMethod,
        description: description || null,
        listing: invoice.listing,
        check_in: checkIn,
        check_out: checkOut,
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
