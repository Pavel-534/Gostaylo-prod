/**
 * GET /api/v2/admin/bookings/[id] — booking snapshot + emergency logs (ADMIN only).
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveAdminSecurityProfile } from '@/lib/admin-security-access'
import { attachPartnerTrustToBookings } from '@/lib/booking/attach-partner-trust-to-bookings'

export const dynamic = 'force-dynamic'

export async function GET(_request, { params }) {
  const session = await resolveAdminSecurityProfile()
  if (session.error) {
    return NextResponse.json(
      { success: false, error: session.error.message },
      { status: session.error.status },
    )
  }

  const bookingId = String(params?.id || '').trim()
  if (!bookingId || !supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'Invalid booking id' }, { status: 400 })
  }

  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .select(
      'id, status, renter_id, partner_id, listing_id, check_in, check_out, metadata, guest_name, created_at, updated_at',
    )
    .eq('id', bookingId)
    .maybeSingle()

  if (error || !booking) {
    return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 })
  }

  const [withTrust] = await attachPartnerTrustToBookings([booking])
  return NextResponse.json({ success: true, data: { booking: withTrust } })
}
