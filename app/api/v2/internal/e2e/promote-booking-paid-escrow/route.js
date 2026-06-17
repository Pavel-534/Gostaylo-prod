/**
 * POST /api/v2/internal/e2e/promote-booking-paid-escrow
 * Promotes an existing E2E booking to PAID_ESCROW (EscrowService.moveToEscrow).
 *
 * Header: x-e2e-fixture-secret: <E2E_FIXTURE_SECRET>
 * Body: { bookingId: string }
 */

import { NextResponse } from 'next/server'
import EscrowService from '@/lib/services/escrow.service'
import { supabaseAdmin } from '@/lib/supabase'
import { E2E_TEST_DATA_TAG } from '@/lib/e2e/test-data-tag'

export const dynamic = 'force-dynamic'

function getSecret() {
  return String(process.env.E2E_FIXTURE_SECRET || '').trim()
}

export async function POST(request) {
  const expected = getSecret()
  if (!expected) {
    return NextResponse.json({ success: false, error: 'Fixture API disabled' }, { status: 404 })
  }

  const hdr = request.headers.get('x-e2e-fixture-secret') || ''
  if (hdr !== expected) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const bookingId = String(body.bookingId || '').trim()
  if (!bookingId) {
    return NextResponse.json({ success: false, error: 'bookingId required' }, { status: 400 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'supabase_unavailable' }, { status: 503 })
  }

  try {
    const { data: row, error } = await supabaseAdmin
      .from('bookings')
      .select('id, status, renter_id, special_requests, metadata')
      .eq('id', bookingId)
      .maybeSingle()

    if (error || !row?.id) {
      return NextResponse.json({ success: false, error: 'booking_not_found' }, { status: 404 })
    }

    const tag = String(row.special_requests || '')
    const metaTag = JSON.stringify(row.metadata || {})
    const isTaggedE2e =
      tag.includes(E2E_TEST_DATA_TAG) ||
      metaTag.includes(E2E_TEST_DATA_TAG) ||
      metaTag.includes('e2eFixture')

    const allowedRenterEmail = (
      (typeof body.renterEmail === 'string' && body.renterEmail.trim()) ||
      process.env.E2E_RENTER_EMAIL ||
      ''
    ).toLowerCase()

    if (!isTaggedE2e && allowedRenterEmail) {
      const { data: renter } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('id', String(row.renter_id))
        .maybeSingle()
      if (renter?.email?.toLowerCase() !== allowedRenterEmail) {
        return NextResponse.json({ success: false, error: 'renter_mismatch' }, { status: 403 })
      }
    } else if (!isTaggedE2e && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ success: false, error: 'not_e2e_booking' }, { status: 403 })
    }

    const escrow = await EscrowService.moveToEscrow(bookingId, {
      source: 'e2e_promote_booking_paid_escrow',
      txId: null,
    })
    if (!escrow?.success) {
      throw new Error(escrow?.error || 'moveToEscrow failed')
    }

    return NextResponse.json({
      success: true,
      data: { bookingId, status: 'PAID_ESCROW' },
    })
  } catch (e) {
    const msg = e?.message || String(e)
    console.error('[e2e/promote-booking-paid-escrow]', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
