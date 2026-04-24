import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { supabaseAdmin } from '@/lib/supabase'
import { toUnifiedOrder } from '@/lib/models/unified-order'
import { normalizeEmbeddedListingBooking } from '@/lib/services/booking/query.service'

export const dynamic = 'force-dynamic'

async function verifyStaff(userId) {
  const { data } = await supabaseAdmin.from('profiles').select('id, role').eq('id', userId).maybeSingle()
  const role = String(data?.role || '').toUpperCase()
  if (!data?.id || !['ADMIN', 'MODERATOR'].includes(role)) return null
  return { id: String(data.id), role }
}

export async function GET(_request, { params }) {
  try {
    const session = await getSessionPayload()
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const staff = await verifyStaff(session.userId)
    if (!staff) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const disputeId = String(params?.id || '').trim()
    if (!disputeId) {
      return NextResponse.json({ success: false, error: 'Dispute ID is required' }, { status: 400 })
    }

    const { data: row, error } = await supabaseAdmin
      .from('disputes')
      .select(
        `
        id,
        booking_id,
        conversation_id,
        opened_by,
        against_user_id,
        category,
        reason_code,
        description,
        status,
        freeze_payment,
        force_refund_requested,
        penalty_requested,
        admin_action_flags,
        metadata,
        created_at,
        updated_at,
        resolved_at,
        closed_by,
        bookings (
          id,
          status,
          renter_id,
          partner_id,
          check_in,
          check_out,
          currency,
          price_thb,
          price_paid,
          metadata,
          partner_earnings_thb,
          listing_id,
          listing:listings (
            id,
            title,
            district,
            category_id,
            metadata,
            images,
            cover_image,
            categories ( slug )
          ),
          renter:profiles!renter_id (
            id,
            first_name,
            last_name,
            email,
            phone
          ),
          partner:profiles!partner_id (
            id,
            first_name,
            last_name,
            email,
            phone
          )
        ),
        opener:profiles!disputes_opened_by_fkey (
          id,
          first_name,
          last_name,
          email
        )
      `,
      )
      .eq('id', disputeId)
      .maybeSingle()

    if (error || !row) {
      return NextResponse.json({ success: false, error: 'Dispute not found' }, { status: 404 })
    }

    const firstRel = (value) => {
      if (Array.isArray(value)) return value[0] || null
      return value || null
    }
    const bookingRow = firstRel(row.bookings) || firstRel(row.booking)
    const bookingNorm = bookingRow ? normalizeEmbeddedListingBooking(bookingRow) : null
    const listing = bookingNorm?.listings || bookingNorm?.listing || null
    const bookingForCard = bookingNorm
      ? {
          ...bookingNorm,
          listing,
          listings: listing,
          conversationId: row.conversation_id || null,
          conversation_id: row.conversation_id || null,
        }
      : null

    const unifiedOrder = bookingForCard ? toUnifiedOrder(bookingForCard) : null

    return NextResponse.json({
      success: true,
      data: {
        dispute: {
          id: row.id,
          bookingId: row.booking_id,
          conversationId: row.conversation_id,
          openedBy: row.opened_by,
          againstUserId: row.against_user_id,
          category: row.category,
          reasonCode: row.reason_code,
          description: row.description,
          status: row.status,
          freezePayment: row.freeze_payment === true,
          forceRefundRequested: row.force_refund_requested === true,
          penaltyRequested: row.penalty_requested === true,
          adminActionFlags: row.admin_action_flags,
          metadata: row.metadata,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          resolvedAt: row.resolved_at,
          closedBy: row.closed_by,
        },
        opener: firstRel(row.opener),
        booking: bookingForCard,
        unifiedOrder,
      },
    })
  } catch (e) {
    console.error('[ADMIN DISPUTE GET]', e)
    return NextResponse.json({ success: false, error: e.message || 'Internal error' }, { status: 500 })
  }
}
