/**
 * GET /api/v2/bookings/[id]/emergency-context
 * Stage 24.0: renter UI — partner quiet-hours flag + lifecycle eligibility for emergency CTA.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserIdFromSession } from '@/lib/services/session-service'
import { isPartnerInQuietHoursNow } from '@/lib/services/availability.service'
import { canRenterUseEmergencyContactBooking } from '@/lib/emergency-contact-eligibility'
import { resolveEmergencyServiceKindFromCategorySlug } from '@/lib/emergency-contact-protocol'

export const dynamic = 'force-dynamic'

export async function GET(_request, { params }) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId || !supabaseAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const bookingId = String(params?.id || '').trim()
    if (!bookingId) {
      return NextResponse.json({ success: false, error: 'Invalid booking' }, { status: 400 })
    }

    const { data: booking, error: bErr } = await supabaseAdmin
      .from('bookings')
      .select('id, renter_id, partner_id, listing_id, status, check_out')
      .eq('id', bookingId)
      .maybeSingle()

    if (bErr || !booking || String(booking.renter_id) !== String(userId)) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    const partnerId = booking.partner_id ? String(booking.partner_id) : ''
    if (!partnerId) {
      return NextResponse.json({
        success: true,
        data: {
          bookingEligible: false,
          partnerInQuietHours: false,
          emergencyServiceKind: 'stay',
          reason: 'no_partner',
        },
      })
    }

    const life = canRenterUseEmergencyContactBooking({
      status: booking.status,
      checkOutIso: booking.check_out,
    })

    if (!life.allowed) {
      return NextResponse.json({
        success: true,
        data: {
          bookingEligible: false,
          partnerInQuietHours: false,
          emergencyServiceKind: 'stay',
          reason: life.reason,
        },
      })
    }

    let emergencyServiceKind = 'stay'
    if (booking.listing_id) {
      const { data: lst } = await supabaseAdmin
        .from('listings')
        .select('category_id')
        .eq('id', booking.listing_id)
        .maybeSingle()
      if (lst?.category_id) {
        const { data: cat } = await supabaseAdmin
          .from('listing_categories')
          .select('slug')
          .eq('id', lst.category_id)
          .maybeSingle()
        if (cat?.slug) emergencyServiceKind = resolveEmergencyServiceKindFromCategorySlug(cat.slug)
      }
    }

    const partnerInQuietHours = await isPartnerInQuietHoursNow(partnerId, {
      bookingId,
      listingId: booking.listing_id ? String(booking.listing_id) : null,
    })

    return NextResponse.json({
      success: true,
      data: {
        bookingEligible: true,
        partnerInQuietHours,
        emergencyServiceKind,
        reason: null,
      },
    })
  } catch (e) {
    console.error('[emergency-context]', e)
    return NextResponse.json({ success: false, error: e?.message || 'error' }, { status: 500 })
  }
}
