import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { loadBookingFinancialTimeline } from '@/lib/services/booking/booking-financial-timeline.js'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  try {
    const access = await requireAdminStaff(request)
    if (access.error) return access.error

    const bookingId = String(params?.id || '').trim()
    if (!bookingId) {
      return NextResponse.json({ success: false, error: 'Booking ID is required' }, { status: 400 })
    }

    const bundle = await loadBookingFinancialTimeline(bookingId)
    return NextResponse.json({ success: true, data: bundle })
  } catch (e) {
    console.error('[ADMIN BOOKING FINANCIAL TIMELINE]', e)
    return NextResponse.json({ success: false, error: e.message || 'Internal error' }, { status: 500 })
  }
}
