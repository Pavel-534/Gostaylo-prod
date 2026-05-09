import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { toUnifiedOrder } from '@/lib/models/unified-order'
import { normalizeEmbeddedListingBooking } from '@/lib/services/booking/query.service'
import { requireAccess } from '@/lib/security/access-guard'
import DisputeService from '@/lib/services/dispute.service'

export const dynamic = 'force-dynamic'

export async function GET(_request, { params }) {
  try {
    const access = await requireAccess({ roles: ['ADMIN'] })
    if (access.error) return access.error

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
        resolution_reason,
        current_deadline_at,
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

    const evidenceSigned = await DisputeService.getEvidenceSignedUrls(disputeId)

    const { data: eventRows, error: evErr } = await supabaseAdmin
      .from('dispute_events')
      .select('id, event_type, from_status, to_status, actor_id, actor_role, reason, metadata, created_at')
      .eq('dispute_id', disputeId)
      .order('created_at', { ascending: true })

    if (evErr) {
      console.warn('[ADMIN DISPUTE GET] dispute_events:', evErr.message)
    }

    const disputeEvents = (eventRows || []).map((e) => ({
      id: e.id,
      eventType: e.event_type,
      fromStatus: e.from_status ?? null,
      toStatus: e.to_status ?? null,
      actorId: e.actor_id ?? null,
      actorRole: e.actor_role ?? null,
      reason: e.reason ?? '',
      metadata: e.metadata ?? {},
      createdAt: e.created_at,
    }))

    return NextResponse.json({
      success: true,
      data: {
        evidenceSignedUrls: evidenceSigned.ok ? evidenceSigned.items : [],
        disputeEvents,
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
          resolutionReason: row.resolution_reason ?? null,
          currentDeadlineAt: row.current_deadline_at ?? null,
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
