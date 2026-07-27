/**
 * GET /api/v2/me/unpaid-checkout-hold — Wave H1 in-app checkout nudge payload.
 */

import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/api/api-guard'
import { supabaseAdmin } from '@/lib/supabase'
import {
  resolveCheckoutHoldExpiresAtIso,
  isCheckoutHoldExpired,
} from '@/lib/booking/checkout-hold-policy.js'
import { unpaidCheckoutDeepLink } from '@/lib/booking/unpaid-checkout-retention-policy.js'

export const dynamic = 'force-dynamic'

export async function GET() {
  const scope = await requireSession()
  if (!scope.ok) return scope.response

  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'database_unavailable' }, { status: 503 })
  }

  const userId = String(scope.session.userId)

  const { data: rows, error } = await supabaseAdmin
    .from('bookings')
    .select('id, status, created_at, metadata, listings(title)')
    .eq('renter_id', userId)
    .eq('status', 'AWAITING_PAYMENT')
    .order('updated_at', { ascending: false })
    .limit(8)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const nowMs = Date.now()
  let best = null

  for (const booking of rows || []) {
    const bookingId = String(booking.id || '')
    if (!bookingId) continue
    const meta = booking.metadata && typeof booking.metadata === 'object' ? booking.metadata : {}

    const { data: intents } = await supabaseAdmin
      .from('payment_intents')
      .select('initiated_at, created_at, expires_at')
      .eq('booking_id', bookingId)
      .order('initiated_at', { ascending: false, nullsFirst: false })
      .limit(1)

    const intentRow = intents?.[0]
    let invoice = null
    const invId = meta.chat_invoice_id || meta.invoiceId
    if (invId) {
      const { data: inv } = await supabaseAdmin
        .from('invoices')
        .select('id, booking_id, status, metadata, created_at')
        .eq('id', String(invId))
        .maybeSingle()
      invoice = inv
    }

    if (
      isCheckoutHoldExpired({
        booking,
        invoice,
        intentStartedAt: intentRow?.initiated_at || intentRow?.created_at || meta.paymentInitiatedAt || null,
        intentExpiresAt: intentRow?.expires_at || null,
        nowMs,
      })
    ) {
      continue
    }

    const expiresAt = resolveCheckoutHoldExpiresAtIso({
      booking,
      invoice,
      intentStartedAt: intentRow?.initiated_at || intentRow?.created_at || meta.paymentInitiatedAt || null,
      intentExpiresAt: intentRow?.expires_at || null,
    })
    if (!expiresAt) continue

    const expiryMs = Date.parse(String(expiresAt))
    if (!Number.isFinite(expiryMs) || expiryMs <= nowMs) continue

    if (!best || expiryMs < best.expiryMs) {
      best = {
        expiryMs,
        bookingId,
        listingTitle: booking?.listings?.title || meta.listing_title || '',
        expiresAt: String(expiresAt),
        checkoutPath: unpaidCheckoutDeepLink(bookingId),
      }
    }
  }

  if (!best) {
    return NextResponse.json({ success: true, data: null })
  }

  return NextResponse.json({
    success: true,
    data: {
      bookingId: best.bookingId,
      listingTitle: best.listingTitle,
      expiresAt: best.expiresAt,
      checkoutPath: best.checkoutPath,
    },
  })
}
