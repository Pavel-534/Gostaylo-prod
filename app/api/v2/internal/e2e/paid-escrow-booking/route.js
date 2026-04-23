/**
 * POST /api/v2/internal/e2e/paid-escrow-booking
 * Creates booking fixture and forces status to PAID_ESCROW.
 *
 * Header: x-e2e-fixture-secret: <E2E_FIXTURE_SECRET>
 * Body: { partnerEmail?, renterEmail? }
 */

import { NextResponse } from 'next/server'
import { createPendingChatBookingFixture } from '@/lib/e2e/create-pending-chat-booking-fixture'
import { supabaseAdmin } from '@/lib/supabase'

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

  const partnerEmail =
    (typeof body.partnerEmail === 'string' && body.partnerEmail.trim()) ||
    process.env.E2E_PARTNER_EMAIL ||
    '86boa@mail.ru'
  const renterEmail =
    (typeof body.renterEmail === 'string' && body.renterEmail.trim()) ||
    process.env.E2E_RENTER_EMAIL ||
    'pavel29031983@gmail.com'

  try {
    const pending = await createPendingChatBookingFixture({ partnerEmail, renterEmail })
    const bookingId = pending.bookingId

    const { data: existing } = await supabaseAdmin
      .from('bookings')
      .select('metadata')
      .eq('id', bookingId)
      .maybeSingle()

    const { error: updateErr } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'PAID_ESCROW',
        metadata: {
          ...(existing?.metadata || {}),
          e2eFixture: 'paid-escrow-booking',
        },
      })
      .eq('id', bookingId)

    if (updateErr) {
      throw new Error(`Failed to update booking status: ${updateErr.message || 'unknown error'}`)
    }

    return NextResponse.json({
      success: true,
      data: {
        ...pending,
        status: 'PAID_ESCROW',
      },
    })
  } catch (e) {
    const msg = e?.message || String(e)
    console.error('[e2e/paid-escrow-booking]', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
