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

function displayNameFromProfile(p) {
  if (!p) return '—'
  const n = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
  return n || p.email || p.id || '—'
}

function firstRel(value) {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

function mapListRow(row) {
  const bookingRaw = firstRel(row.bookings) || firstRel(row.booking)
  const booking = bookingRaw ? normalizeEmbeddedListingBooking(bookingRaw) : null
  const listing = booking?.listings || booking?.listing || null
  const opener = firstRel(row.opener)
  const bForUnified = booking ? { ...booking, listings: listing, listing } : null
  const unified = bForUnified ? toUnifiedOrder(bForUnified) : null
  const orderType = unified?.type === 'transport' ? 'transport' : 'home'

  if (!booking) {
    return {
      id: row.id,
      bookingId: row.booking_id,
      conversationId: row.conversation_id || null,
      status: row.status,
      freezePayment: row.freeze_payment === true,
      forceRefundRequested: row.force_refund_requested === true,
      openedById: row.opened_by,
      openedByLabel: displayNameFromProfile(opener),
      createdAt: row.created_at,
      orderType: 'home',
      unifiedOrder: null,
    }
  }

  return {
    id: row.id,
    bookingId: row.booking_id,
    conversationId: row.conversation_id || null,
    status: row.status,
    freezePayment: row.freeze_payment === true,
    forceRefundRequested: row.force_refund_requested === true,
    openedById: row.opened_by,
    openedByLabel: displayNameFromProfile(opener),
    createdAt: row.created_at,
    orderType,
    unifiedOrder: unified,
  }
}

export async function GET(request) {
  try {
    const session = await getSessionPayload()
    if (!session?.userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const staff = await verifyStaff(session.userId)
    if (!staff) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const filter = String(searchParams.get('filter') || searchParams.get('status') || 'all').toLowerCase()
    const limit = Math.min(300, Math.max(1, Number(searchParams.get('limit')) || 120))

    let query = supabaseAdmin
      .from('disputes')
      .select(
        `
        id,
        booking_id,
        conversation_id,
        opened_by,
        status,
        freeze_payment,
        force_refund_requested,
        created_at,
        updated_at,
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
          listing:listings (
            id,
            title,
            district,
            category_id,
            metadata,
            images,
            cover_image,
            categories ( slug )
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
      .order('created_at', { ascending: false })
      .limit(limit)

    if (filter === 'open') {
      query = query.in('status', ['OPEN', 'IN_REVIEW', 'PENDING_MEDIATION'])
    } else if (filter === 'resolved') {
      query = query.in('status', ['RESOLVED', 'CLOSED', 'REJECTED'])
    } else if (filter === 'frozen') {
      query = query.eq('freeze_payment', true).in('status', ['OPEN', 'IN_REVIEW'])
    }

    const { data, error } = await query
    if (error) {
      console.error('[ADMIN DISPUTES LIST]', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const rows = Array.isArray(data) ? data : []
    return NextResponse.json({
      success: true,
      data: rows.map(mapListRow),
    })
  } catch (e) {
    console.error('[ADMIN DISPUTES LIST]', e)
    return NextResponse.json({ success: false, error: e.message || 'Internal error' }, { status: 500 })
  }
}
