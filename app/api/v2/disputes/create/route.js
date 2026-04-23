import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { supabaseAdmin } from '@/lib/supabase'
import DisputeService from '@/lib/services/dispute.service'

export const dynamic = 'force-dynamic'

function normalizeCategory(value) {
  const s = String(value || '').trim().toLowerCase()
  if (!s) return 'general'
  return s.slice(0, 64)
}

export async function POST(request) {
  try {
    const session = await getSessionPayload()
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const bookingId = String(body.bookingId || '').trim()
    const reason = String(body.reason || '').trim().slice(0, 2000)
    const category = normalizeCategory(body.category)
    const providedConversationId = String(body.conversationId || '').trim() || null
    const rawEvidence = body.evidenceUrls ?? body.evidence_urls
    const evidenceUrls = Array.isArray(rawEvidence)
      ? rawEvidence
          .map((u) => String(u || '').trim().slice(0, 800))
          .filter((u) => u.startsWith('/_storage/') || u.startsWith('http'))
          .slice(0, 3)
      : []

    if (!bookingId) {
      return NextResponse.json({ success: false, error: 'bookingId is required' }, { status: 400 })
    }

    const { data: booking, error: bookingErr } = await supabaseAdmin
      .from('bookings')
      .select('id, status, renter_id, partner_id, check_in, check_out, listing_id')
      .eq('id', bookingId)
      .maybeSingle()

    if (bookingErr || !booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 })
    }

    const actorId = String(session.userId)
    const isParticipant =
      String(booking.renter_id || '') === actorId || String(booking.partner_id || '') === actorId
    const isStaff = ['ADMIN', 'MODERATOR'].includes(String(session.role || '').toUpperCase())
    if (!isParticipant && !isStaff) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const created = await DisputeService.createOfficialDispute({
      actorId,
      booking,
      reason,
      category,
      conversationId: providedConversationId,
      evidenceUrls,
    })

    if (!created.success) {
      const status =
        created.code === 'FORBIDDEN'
          ? 403
          : created.code === 'DISPUTE_NOT_ALLOWED' ||
              created.code === 'COOLDOWN' ||
              created.code === 'MEDIATION_WINDOW_ACTIVE'
            ? 400
            : 500
      return NextResponse.json(
        {
          success: false,
          error: created.error || 'Failed to create dispute',
          code: created.code || 'UNKNOWN_ERROR',
          ...(created.code === 'MEDIATION_WINDOW_ACTIVE'
            ? { unlockAt: created.unlockAt, minutesLeft: created.minutesLeft }
            : {}),
        },
        { status },
      )
    }

    return NextResponse.json({
      success: true,
      data: created.dispute,
      alreadyExists: created.alreadyExists === true,
      phase: created.phase || null,
      unlockAt: created.unlockAt || null,
      upgradedFromMediation: created.upgradedFromMediation === true,
    })
  } catch (error) {
    console.error('[DISPUTES CREATE]', error)
    return NextResponse.json({ success: false, error: error.message || 'Internal error' }, { status: 500 })
  }
}
