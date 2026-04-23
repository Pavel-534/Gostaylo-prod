/**
 * POST — renter taps "notify host" in pre-dispute help flow (Stage 19.0).
 * Sends partner FCM PARTNER_GUEST_HELP_NUDGE.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserIdFromSession } from '@/lib/services/session-service'
import { PushService } from '@/lib/services/push.service'
import { getPublicSiteUrl } from '@/lib/site-url.js'

export const dynamic = 'force-dynamic'

export async function POST(_request, { params }) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const bookingId = String(params?.id || '').trim()
    if (!bookingId || !supabaseAdmin) {
      return NextResponse.json({ success: false, error: 'Invalid booking' }, { status: 400 })
    }

    const { data: booking, error: bErr } = await supabaseAdmin
      .from('bookings')
      .select('id, renter_id, partner_id, listing_id')
      .eq('id', bookingId)
      .maybeSingle()

    if (bErr || !booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 })
    }

    if (String(booking.renter_id) !== String(userId)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const partnerId = booking.partner_id ? String(booking.partner_id) : ''
    if (!partnerId) {
      return NextResponse.json({ success: false, error: 'No partner on booking' }, { status: 400 })
    }

    let listingTitle = 'Listing'
    if (booking.listing_id) {
      const { data: listingRow } = await supabaseAdmin
        .from('listings')
        .select('title')
        .eq('id', String(booking.listing_id))
        .maybeSingle()
      if (listingRow?.title) listingTitle = String(listingRow.title)
    }
    const base = (getPublicSiteUrl() || '').replace(/\/$/, '')
    const link = `${base}/partner/bookings?booking=${encodeURIComponent(bookingId)}`

    await PushService.sendToUser(partnerId, 'PARTNER_GUEST_HELP_NUDGE', {
      listing: String(listingTitle),
      link,
      bookingId,
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[guest-help-partner-nudge]', e)
    return NextResponse.json({ success: false, error: e?.message || 'error' }, { status: 500 })
  }
}
