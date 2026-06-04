/**
 * GET /api/v2/listings/[id]/booking-quote — server SSOT for booking price attestation (PDP).
 * Query: checkIn, checkOut, guestsCount?, currency?
 */

import { NextResponse } from 'next/server'
import { computeListingBookingQuote } from '@/lib/services/booking/booking-quote.js'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  const listingId = String(params?.id || '').trim()
  const { searchParams } = new URL(request.url)
  const checkIn = searchParams.get('checkIn') || searchParams.get('check_in')
  const checkOut = searchParams.get('checkOut') || searchParams.get('check_out')
  const guestsCount = searchParams.get('guestsCount') || searchParams.get('guests')
  const currency = searchParams.get('currency') || 'THB'

  if (!listingId) {
    return NextResponse.json({ success: false, error: 'Missing listing id' }, { status: 400 })
  }

  const quote = await computeListingBookingQuote({
    listingId,
    checkIn,
    checkOut,
    guestsCount,
    currency,
  })

  if (quote.error) {
    const status = quote.code === 'NOT_FOUND' ? 404 : 400
    return NextResponse.json(
      { success: false, error: quote.error, code: quote.code || 'QUOTE_FAILED' },
      { status },
    )
  }

  return NextResponse.json({
    success: true,
    data: {
      listingId,
      clientQuotedSubtotalThb: quote.subtotalThb,
      clientQuotedGuestTotalThb: quote.guestTotalThb,
      pricingEngineV2Active: quote.pricingEngineV2Active,
      roundingMode: quote.roundingMode,
    },
  })
}
