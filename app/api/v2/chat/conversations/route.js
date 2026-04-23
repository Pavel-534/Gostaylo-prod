/**
 * GET /api/v2/chat/conversations
 * Список бесед текущего пользователя; ?listing_category= — фильтр по категории листинга.
 *
 * POST /api/v2/chat/conversations
 * Создание (или возврат) беседы по объявлению: { listingId, partnerId, sendIntro? }
 * Только для авторизованного пользователя; partnerId должен совпадать с owner_id листинга.
 */

import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { effectiveRoleFromProfile, isStaffRole } from '@/lib/services/chat/access'
import { getPublicSiteUrl } from '@/lib/site-url.js'
import { PushService } from '@/lib/services/push.service.js'
import { formatPrivacyDisplayNameForParticipant } from '@/lib/utils/name-formatter'
import { isMarkedE2eTestData } from '@/lib/e2e/test-data-tag'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const hdr = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
}

const hdrWrite = {
  ...hdr,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}

async function fetchProfileShort(userId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,first_name,last_name,role,email`,
    { headers: hdr, cache: 'no-store' }
  )
  const rows = await res.json()
  return Array.isArray(rows) ? rows[0] : null
}

function displayNameFromProfile(p) {
  if (!p) return 'Guest'
  return formatPrivacyDisplayNameForParticipant(p.first_name, p.last_name, p.email, 'User')
}

function normalizeListingRow(L) {
  if (!L) return null
  let images = L.images
  if (typeof images === 'string') {
    try {
      const p = JSON.parse(images)
      images = Array.isArray(p) ? p : []
    } catch {
      images = []
    }
  }
  if (!Array.isArray(images)) images = []
  let category_slug = ''
  if (L.categories) {
    const c = Array.isArray(L.categories) ? L.categories[0] : L.categories
    if (c && c.slug) category_slug = String(c.slug)
  }
  const { categories: _c, ...rest } = L
  return { ...rest, images, category_slug }
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
    isPriority: c.is_priority === true,
  }
}

async function filterOutE2eRows(rows) {
  if (!rows.length) return rows

  const listingIds = [...new Set(rows.map((r) => r.listing_id).filter(Boolean))]
  const bookingIds = [...new Set(rows.map((r) => r.booking_id).filter(Boolean))]
  const listingById = new Map()
  const bookingById = new Map()

  if (listingIds.length) {
    const inList = listingIds.map((id) => encodeURIComponent(id)).join(',')
    const lr = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?id=in.(${inList})&select=id,title,description,metadata`,
      { headers: hdr, cache: 'no-store' }
    )
    const list = await lr.json()
    if (Array.isArray(list)) {
      for (const row of list) listingById.set(String(row.id), row)
    }
  }

  if (bookingIds.length) {
    const inB = bookingIds.map((id) => encodeURIComponent(id)).join(',')
    const br = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?id=in.(${inB})&select=id,special_requests,guest_name`,
      { headers: hdr, cache: 'no-store' }
    )
    const list = await br.json()
    if (Array.isArray(list)) {
      for (const row of list) bookingById.set(String(row.id), row)
    }
  }

  return rows.filter((c) => {
    const listing = c.listing_id ? listingById.get(String(c.listing_id)) : null
    const booking = c.booking_id ? bookingById.get(String(c.booking_id)) : null
    return !isMarkedE2eTestData(listing) && !isMarkedE2eTestData(booking)
  })
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
      for (const L of list) listingsById[L.id] = normalizeListingRow(L)
    }
  }

  const bookingIds = [...new Set(rows.map((r) => r.booking_id).filter(Boolean))]
  const bookingsById = {}
  if (bookingIds.length) {
    const inB = bookingIds.map((id) => encodeURIComponent(id)).join(',')
    const br = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?id=in.(${inB})&select=id,check_in,check_out,status,guest_name,price_thb,currency,guests_count`,
      { headers: hdr, cache: 'no-store' }
    )
    const bl = await br.json()
    if (Array.isArray(bl)) {
      for (const b of bl) bookingsById[b.id] = b
    }
  }

  const participantIds = [
    ...new Set(
      rows
        .flatMap((r) => [r.partner_id, r.owner_id, r.renter_id, r.admin_id])
        .filter(Boolean)
        .map((v) => String(v)),
    ),
  ]
  const participantLastSeenById = {}
  if (participantIds.length) {
    const inProfiles = participantIds.map((id) => encodeURIComponent(id)).join(',')
    const pr = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=in.(${inProfiles})&select=id,last_seen_at`,
      { headers: hdr, cache: 'no-store' }
    )
    const profiles = await pr.json()
    if (Array.isArray(profiles)) {
      for (const p of profiles) {
        participantLastSeenById[String(p.id)] = p.last_seen_at ?? null
      }
    }
  }

  const lastById = {}
  const unreadById = {}
  const viewerUid = String(viewerUserId)
  const convById = new Map(rows.map((c) => [String(c.id), c]))
  const conversationIds = [...convById.keys()]
  if (conversationIds.length > 0) {
    const inConversations = conversationIds.map((id) => encodeURIComponent(id)).join(',')
    const msgRes = await fetch(
      `${SUPABASE_URL}/rest/v1/messages?conversation_id=in.(${inConversations})&order=created_at.desc&select=id,conversation_id,content,message,type,created_at,sender_id,read_at_renter,read_at_partner,is_read`,
      { headers: hdr, cache: 'no-store' }
    )
    const msgRows = await msgRes.json()
    if (Array.isArray(msgRows)) {
      for (const m of msgRows) {
        const cid = String(m.conversation_id || '')
        if (!cid) continue
        if (lastById[cid] == null) {
          lastById[cid] = {
            id: m.id,
            content: m.content ?? m.message,
            message: m.message ?? m.content,
            type: m.type,
            createdAt: m.created_at,
            created_at: m.created_at,
          }
        }
        const c = convById.get(cid)
        if (!c) continue
        if (String(m.sender_id || '') === viewerUid) continue
        const isRenter = String(c.renter_id) === viewerUid
        const isHostSide =
          String(c.renter_id) !== viewerUid &&
          (String(c.partner_id) === viewerUid || String(c.owner_id) === viewerUid)
        const unread =
          isRenter
            ? m.read_at_renter == null
            : isHostSide
              ? m.read_at_partner == null
              : m.is_read === false
        if (unread) unreadById[cid] = (unreadById[cid] || 0) + 1
      }
    }
  }

  return rows.map((c) => {
    const base = mapConversationRow(c)
    const listing = c.listing_id ? listingsById[c.listing_id] ?? null : null
    const booking = c.booking_id ? bookingsById[c.booking_id] ?? null : null
    return {
      ...base,
      listing,
      booking,
      partnerLastSeenAt: c.partner_id ? participantLastSeenById[String(c.partner_id)] ?? null : null,
      renterLastSeenAt: c.renter_id ? participantLastSeenById[String(c.renter_id)] ?? null : null,
      adminLastSeenAt: c.admin_id ? participantLastSeenById[String(c.admin_id)] ?? null : null,
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
  const e2eBypass = request.headers.get('x-e2e-test-mode') === '1'

  const { searchParams } = new URL(request.url)
  const listingCategory = searchParams.get('listing_category') || searchParams.get('listingCategory')
  const listingIdFilter = searchParams.get('listing_id') || searchParams.get('listingId')
  const enrich =
    searchParams.get('enrich') === '1' ||
    searchParams.get('enrich') === 'true'
  const singleId = searchParams.get('id')
  const archivedParam = searchParams.get('archived') || searchParams.get('archivedOnly')
  const archivedOnly = archivedParam === 'only' || archivedParam === '1'
  // ?archived=all → include archived conversations (used by ChatContext for full unread count)
  const archivedAll = archivedParam === 'all'
  // Caller may request more via ?limit=N; default inbox limit is 20.
  const limitParam = parseInt(searchParams.get('limit') || '0', 10)
  const pageLimit = limitParam > 0 && limitParam <= 200 ? limitParam : 20
  const offsetParam = parseInt(searchParams.get('offset') || '0', 10)
  const inboxLimit = singleId ? '' : `&limit=${pageLimit}&offset=${offsetParam >= 0 ? offsetParam : 0}`

  const isFavoriteFilter =
    searchParams.get('is_favorite') === 'true' ||
    searchParams.get('is_favorite') === '1' ||
    searchParams.get('isFavorite') === 'true'

  let url
  if (staff) {
    url = `${SUPABASE_URL}/rest/v1/conversations?select=*&order=is_priority.desc,last_message_at.desc.nullslast`
    if (singleId) {
      url += `&id=eq.${encodeURIComponent(singleId)}`
    } else {
      url += inboxLimit
    }
    if (listingCategory) {
      url += `&listing_category=eq.${encodeURIComponent(listingCategory)}`
    }
    if (listingIdFilter) {
      url += `&listing_id=eq.${encodeURIComponent(listingIdFilter)}`
    }
  } else {
    const orFilter = `(partner_id.eq.${userId},renter_id.eq.${userId},owner_id.eq.${userId},admin_id.eq.${userId})`
    url =
      `${SUPABASE_URL}/rest/v1/conversations?select=*&or=${encodeURIComponent(orFilter)}` +
      '&order=last_message_at.desc.nullslast'
    if (singleId) {
      url += `&id=eq.${encodeURIComponent(singleId)}`
    } else {
      url += inboxLimit
    }
    if (listingCategory) {
      url += `&listing_category=eq.${encodeURIComponent(listingCategory)}`
    }
    if (listingIdFilter) {
      url += `&listing_id=eq.${encodeURIComponent(listingIdFilter)}`
    }
  }

  try {
    let res
    let data

    if (isFavoriteFilter && !singleId) {
      const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rpc_chat_conversations_favorites_page`, {
        method: 'POST',
        headers: hdrWrite,
        body: JSON.stringify({
          p_user_id: userId,
          p_limit: pageLimit,
          p_offset: offsetParam >= 0 ? offsetParam : 0,
          p_is_staff: staff,
        }),
      })
      data = await rpcRes.json()
      res = rpcRes
      if (!rpcRes.ok) {
        return NextResponse.json(
          {
            success: false,
            error:
              data?.message ||
              data?.hint ||
              'Favorites page RPC failed (run migration 010_chat_conversation_favorites.sql?)',
            details: data,
          },
          { status: rpcRes.status }
        )
      }
    } else {
      res = await fetch(url, { headers: hdr, cache: 'no-store' })
      data = await res.json()
    }

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: data?.message || data?.hint || 'Fetch failed', details: data },
        { status: res.status }
      )
    }

    let rows = Array.isArray(data) ? data : []

    if (!staff) {
      if (archivedOnly) {
        rows = rows.filter((c) => {
          if (String(c.renter_id) === String(userId) && c.renter_archived_at) return true
          if (String(c.partner_id) === String(userId) && c.partner_archived_at) return true
          return false
        })
      } else if (!archivedAll && !singleId) {
        // Inbox: hide archived. Direct ?id= link — keep it.
        // ?archived=all (ChatContext) — skip this filter so everything is returned.
        rows = rows.filter((c) => {
          if (c.renter_archived_at && String(c.renter_id) === String(userId)) return false
          if (c.partner_archived_at && String(c.partner_id) === String(userId)) return false
          return true
        })
      }
    }

    if (!staff && !e2eBypass) {
      rows = await filterOutE2eRows(rows)
    }

    const payload = enrich
      ? await enrichConversationRows(rows, userId)
      : rows.map((c) => mapConversationRow(c))

    // hasMore: если вернулось столько, сколько запрашивали — возможно, есть ещё
    const hasMore = !singleId && rows.length >= pageLimit

    return NextResponse.json({
      success: true,
      data: payload,
      meta: {
        total: rows.length,
        offset: offsetParam,
        limit: pageLimit,
        hasMore,
        listingCategory: listingCategory || null,
        enrich,
        archivedOnly: !!archivedOnly && !staff,
        isFavorite: !!isFavoriteFilter && !singleId,
      },
    })
  } catch (e) {
    console.error('[chat/conversations]', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 })
  }

  const session = await getSessionPayload()
  if (!session?.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const renterUserId = session.userId

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { listingId, partnerId, sendIntro = true } = body || {}
  if (!listingId || !partnerId) {
    return NextResponse.json({ success: false, error: 'listingId and partnerId required' }, { status: 400 })
  }

  if (String(renterUserId) === String(partnerId)) {
    return NextResponse.json({ success: false, error: 'Cannot start a chat with yourself' }, { status: 400 })
  }

  const listRes = await fetch(
    `${SUPABASE_URL}/rest/v1/listings?id=eq.${encodeURIComponent(listingId)}&select=id,title,owner_id,category_id`,
    { headers: hdr, cache: 'no-store' }
  )
  const listRows = await listRes.json()
  const listing = Array.isArray(listRows) ? listRows[0] : null
  if (!listing) {
    return NextResponse.json({ success: false, error: 'Listing not found' }, { status: 404 })
  }

  if (String(listing.owner_id) !== String(partnerId)) {
    return NextResponse.json({ success: false, error: 'partnerId does not match listing owner' }, { status: 403 })
  }

  const renterProfile = await fetchProfileShort(renterUserId)
  const partnerProfile = await fetchProfileShort(partnerId)
  const renterName = displayNameFromProfile(renterProfile)
  const partnerName = displayNameFromProfile(partnerProfile)

  const existingUrl =
    `${SUPABASE_URL}/rest/v1/conversations?listing_id=eq.${encodeURIComponent(listingId)}` +
    `&partner_id=eq.${encodeURIComponent(partnerId)}` +
    `&renter_id=eq.${encodeURIComponent(renterUserId)}` +
    '&select=*&limit=1'

  const exRes = await fetch(existingUrl, { headers: hdr, cache: 'no-store' })
  const exRows = await exRes.json()
  if (Array.isArray(exRows) && exRows.length > 0) {
    const row = exRows[0]
    return NextResponse.json({
      success: true,
      data: { id: row.id },
      existing: true,
      introSent: false,
    })
  }

  const convId = `conv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const now = new Date().toISOString()
  const listingCategory = listing.category_id != null ? String(listing.category_id) : null

  const conversationRow = {
    id: convId,
    listing_id: listingId,
    listing_category: listingCategory,
    partner_id: partnerId,
    partner_name: partnerName,
    renter_id: renterUserId,
    renter_name: renterName,
    type: 'INQUIRY',
    status: 'OPEN',
    status_label: 'OPEN',
    is_priority: false,
    created_at: now,
    updated_at: now,
    last_message_at: null,
  }

  const insRes = await fetch(`${SUPABASE_URL}/rest/v1/conversations`, {
    method: 'POST',
    headers: hdrWrite,
    body: JSON.stringify(conversationRow),
  })

  const insData = await insRes.json()
  if (!insRes.ok) {
    return NextResponse.json(
      { success: false, error: insData?.message || insData?.hint || 'Could not create conversation', details: insData },
      { status: 400 }
    )
  }

  const created = Array.isArray(insData) ? insData[0] : conversationRow
  const finalId = created.id || convId

  let introSent = false
  if (sendIntro) {
    const listingTitle = listing.title || 'this listing'
    const introText = `I'm interested in this ${listingTitle}. Could you provide more details?`
    const msgId = `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const msgNow = new Date().toISOString()
    const accessRole = effectiveRoleFromProfile(renterProfile)
    const messageData = {
      id: msgId,
      conversation_id: finalId,
      sender_id: renterUserId,
      sender_role: accessRole,
      sender_name: renterName,
      message: introText,
      content: introText,
      type: 'text',
      metadata: { source: 'listing_inquiry' },
      is_read: false,
      created_at: msgNow,
    }

    const msgRes = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
      method: 'POST',
      headers: hdrWrite,
      body: JSON.stringify(messageData),
    })

    if (msgRes.ok) {
      introSent = true
      await fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${encodeURIComponent(finalId)}`, {
        method: 'PATCH',
        headers: hdrWrite,
        body: JSON.stringify({ updated_at: msgNow, last_message_at: msgNow }),
      })

      const base = getPublicSiteUrl()
      const link = `${base}/messages/${encodeURIComponent(finalId)}`
      try {
        await PushService.sendToUser(partnerId, 'NEW_MESSAGE', {
          sender: renterName,
          senderId: renterUserId,
          link,
          conversationId: finalId,
          messageId: msgId,
          listingId,
        })
      } catch (e) {
        console.error('[chat/conversations] FCM intro', e?.message || e)
      }
    }
  }

  return NextResponse.json({
    success: true,
    data: { id: finalId },
    existing: false,
    introSent,
  })
}
