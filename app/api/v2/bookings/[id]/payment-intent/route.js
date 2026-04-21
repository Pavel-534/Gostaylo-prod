import { NextResponse } from 'next/server'
import { getUserIdFromSession } from '@/lib/services/session-service'
import { supabaseAdmin } from '@/lib/supabase'
import PaymentIntentService from '@/lib/services/payment-intent.service'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  const bookingId = params.id
  if (!bookingId) {
    return NextResponse.json({ success: false, error: 'Booking ID required' }, { status: 400 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const invoiceId = searchParams.get('invoiceId') ? String(searchParams.get('invoiceId')) : null

    const { data: booking, error: bErr } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle()
    if (bErr || !booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 })
    }

    const sessionUserId = await getUserIdFromSession()
    if (booking.renter_id) {
      if (!sessionUserId) {
        return NextResponse.json({ success: false, error: 'Please log in to view payment data' }, { status: 401 })
      }
      if (String(booking.renter_id) !== String(sessionUserId)) {
        return NextResponse.json({ success: false, error: 'Access denied. This is not your booking.' }, { status: 403 })
      }
    }

    let invoice = null
    if (invoiceId) {
      const { data: inv, error: invErr } = await supabaseAdmin
        .from('invoices')
        .select('id,booking_id,amount,status,metadata,created_at')
        .eq('id', invoiceId)
        .maybeSingle()
      if (invErr || !inv) {
        return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 })
      }
      if (String(inv.booking_id || '') !== String(bookingId)) {
        return NextResponse.json({ success: false, error: 'Invoice does not belong to booking' }, { status: 400 })
      }
      if (String(inv.status || '').toLowerCase() === 'cancelled') {
        return NextResponse.json({ success: false, error: 'Invoice is cancelled' }, { status: 400 })
      }
      invoice = inv
    }

    const intentRes = await PaymentIntentService.resolveOrCreateForCheckout({
      booking,
      invoice,
      createdBy: sessionUserId || null,
    })
    if (!intentRes.success || !intentRes.intent) {
      return NextResponse.json({ success: false, error: intentRes.error || 'intent_resolve_failed' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: intentRes.intent,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to resolve payment intent' },
      { status: 500 },
    )
  }
}

