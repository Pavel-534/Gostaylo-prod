/**
 * GET /api/v2/chat/conversations
 * Список бесед текущего пользователя; ?listing_category= — фильтр по категории листинга.
 */

import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { isStaffRole } from '@/lib/services/chat/access'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const hdr = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
}

function mapConversationRow(c) {
  return {
    id: c.id,
    bookingId: c.booking_id ?? null,
    listingId: c.listing_id ?? null,
    listingCategory: c.listing_category ?? null,
    statusLabel: c.status_label ?? c.status ?? null,
    lastMessageAt: c.last_message_at ?? c.updated_at ?? null,
    updatedAt: c.updated_at ?? null,
    createdAt: c.created_at ?? null,
    partnerId: c.partner_id ?? null,
    partnerName: c.partner_name ?? null,
    renterId: c.renter_id ?? null,
    renterName: c.renter_name ?? null,
    ownerId: c.owner_id ?? null,
    adminId: c.admin_id ?? null,
    adminName: c.admin_name ?? null,
    type: c.type ?? null,
  }
}

async function enrichConversationRows(rows, viewerUserId) {
  if (!rows.length) return []

  const listingIds = [...new Set(rows.map((r) => r.listing_id).filter(Boolean))]
  const listingsById = {}
  if (listingIds.length) {
    const inList = listingIds.map((id) => encodeURIComponent(id)).join(',')
    const lr = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?id=in.(${inList})&select=id,title,images,district,base_price_thb,category_id`,
      { headers: hdr, cache: 'no-store' }
    )
    const list = await lr.json()
    if (Array.isArray(list)) {
      for (const L of list) listingsById[L.id] = L
    }
  }

  const bookingIds = [...new Set(rows.map((r) => r.booking_id).filter(Boolean))]
  const bookingsById = {}
  if (bookingIds.length) {
    const inB = bookingIds.map((id) => encodeURIComponent(id)).join(',')
    const br = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?id=in.(${inB})&select=id,check_in,check_out,status,guest_name`,
      { headers: hdr, cache: 'no-store' }
    )
    const bl = await br.json()
    if (Array.isArray(bl)) {
      for (const b of bl) bookingsById[b.id] = b
    }
  }

  const lastById = {}
  const unreadById = {}
  const uid = encodeURIComponent(String(viewerUserId))

  await Promise.all(
    rows.map(async (c) => {
      const cid = encodeURIComponent(c.id)
      const [lastRes, unreadRes] = await Promise.all([
        fetch(
          `${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${cid}&order=created_at.desc&limit=1&select=*`,
          { headers: hdr, cache: 'no-store' }
        ),
        fetch(
          `${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${cid}&is_read=eq.false&sender_id=neq.${uid}&select=id`,
          { headers: hdr, cache: 'no-store' }
        ),
      ])
      const lastArr = await lastRes.json()
      const unreadArr = await unreadRes.json()
      const last = Array.isArray(lastArr) ? lastArr[0] : null
      lastById[c.id] = last
        ? {
            id: last.id,
            content: last.content ?? last.message,
            message: last.message ?? last.content,
            type: last.type,
            createdAt: last.created_at,
            created_at: last.created_at,
          }
        : null
      unreadById[c.id] = Array.isArray(unreadArr) ? unreadArr.length : 0
    })
  )

  return rows.map((c) => {
    const base = mapConversationRow(c)
    const listing = c.listing_id ? listingsById[c.listing_id] ?? null : null
    const booking = c.booking_id ? bookingsById[c.booking_id] ?? null : null
    return {
      ...base,
      listing,
      booking,
      lastMessage: lastById[c.id] ?? null,
      unreadCount: unreadById[c.id] ?? 0,
    }
  })
}

export async function GET(request) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 })
  }

  const session = await getSessionPayload()
  if (!session?.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.userId
  const staff = isStaffRole(session.role)

  const { searchParams } = new URL(request.url)
  const listingCategory = searchParams.get('listing_category') || searchParams.get('listingCategory')
  const enrich =
    searchParams.get('enrich') === '1' ||
    searchParams.get('enrich') === 'true'
  const singleId = searchParams.get('id')

  let url
  if (staff) {
    url = `${SUPABASE_URL}/rest/v1/conversations?select=*&order=last_message_at.desc.nullslast`
    if (singleId) {
      url += `&id=eq.${encodeURIComponent(singleId)}`
    }
    if (listingCategory) {
      url += `&listing_category=eq.${encodeURIComponent(listingCategory)}`
    }
  } else {
    const orFilter = `(partner_id.eq.${userId},renter_id.eq.${userId},owner_id.eq.${userId},admin_id.eq.${userId})`
    url =
      `${SUPABASE_URL}/rest/v1/conversations?select=*&or=${encodeURIComponent(orFilter)}` +
      '&order=last_message_at.desc.nullslast'
    if (singleId) {
      url += `&id=eq.${encodeURIComponent(singleId)}`
    }
    if (listingCategory) {
      url += `&listing_category=eq.${encodeURIComponent(listingCategory)}`
    }
  }

  try {
    const res = await fetch(url, { headers: hdr, cache: 'no-store' })
    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: data?.message || data?.hint || 'Fetch failed', details: data },
        { status: res.status }
      )
    }

    const rows = Array.isArray(data) ? data : []

    const payload = enrich
      ? await enrichConversationRows(rows, userId)
      : rows.map((c) => mapConversationRow(c))

    return NextResponse.json({
      success: true,
      data: payload,
      meta: { total: rows.length, listingCategory: listingCategory || null, enrich },
    })
  } catch (e) {
    console.error('[chat/conversations]', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
