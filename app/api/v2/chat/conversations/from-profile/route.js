/**
 * POST /api/v2/chat/conversations/from-profile
 * Старт диалога с пользователем с публичной страницы /u/[id].
 * Тело: { targetUserId }
 *
 * Поддерживаются пары: (рентер/стафф → партнёр) и (партнёр → рентер/юзер).
 * Нужен активный листинг партнёра (сторона partner_id).
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSessionPayload } from '@/lib/services/session-service'
import { isStaffRole, effectiveRoleFromProfile } from '@/lib/services/chat/access'
import { getPublicSiteUrl } from '@/lib/site-url.js'
import { PushService } from '@/lib/services/push.service.js'
import { formatPrivacyDisplayNameForParticipant } from '@/lib/utils/name-formatter'

export const dynamic = 'force-dynamic'

function displayNameFromProfile(p) {
  if (!p) return 'Guest'
  return formatPrivacyDisplayNameForParticipant(p.first_name, p.last_name, p.email, 'User')
}

export async function POST(request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 })
  }

  const session = await getSessionPayload()
  if (!session?.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const viewerId = String(session.userId)

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const targetUserId = body?.targetUserId != null ? String(body.targetUserId).trim() : ''
  const langRaw = body?.language != null ? String(body.language).toLowerCase().slice(0, 5) : 'en'
  if (!targetUserId) {
    return NextResponse.json({ success: false, error: 'targetUserId required' }, { status: 400 })
  }

  if (viewerId === targetUserId) {
    return NextResponse.json({ success: false, error: 'Cannot chat with yourself' }, { status: 400 })
  }

  const { data: viewer, error: ve } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, role, email')
    .eq('id', viewerId)
    .single()

  const { data: target, error: te } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, role')
    .eq('id', targetUserId)
    .single()

  if (ve || !viewer || te || !target) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
  }

  const viewerRole = String(viewer.role || 'USER').toUpperCase()
  const targetRole = String(target.role || 'USER').toUpperCase()

  const viewerIsPartner = viewerRole === 'PARTNER'
  const targetIsPartner = targetRole === 'PARTNER'
  const viewerIsRenterLike =
    viewerRole === 'RENTER' || viewerRole === 'USER' || isStaffRole(viewerRole)
  const targetIsRenterLike = targetRole === 'RENTER' || targetRole === 'USER'

  let renterId
  let partnerId
  let listingRow

  if (targetIsPartner && viewerIsRenterLike && !viewerIsPartner) {
    renterId = viewerId
    partnerId = targetUserId
    const { data: listing } = await supabaseAdmin
      .from('listings')
      .select('id, title, owner_id, category_id')
      .eq('owner_id', targetUserId)
      .eq('status', 'ACTIVE')
      .limit(1)
      .maybeSingle()
    listingRow = listing
  } else if (viewerIsPartner && targetIsRenterLike && !targetIsPartner) {
    renterId = targetUserId
    partnerId = viewerId
    const { data: listing } = await supabaseAdmin
      .from('listings')
      .select('id, title, owner_id, category_id')
      .eq('owner_id', viewerId)
      .eq('status', 'ACTIVE')
      .limit(1)
      .maybeSingle()
    listingRow = listing
  } else {
    return NextResponse.json(
      {
        success: false,
        error: 'CHAT_UNAVAILABLE',
        errorKey: 'publicProfileChatUnavailable',
      },
      { status: 400 }
    )
  }

  if (!listingRow?.id) {
    return NextResponse.json(
      {
        success: false,
        error: 'NO_ACTIVE_LISTING',
        errorKey: 'publicProfileChatNoListing',
      },
      { status: 404 }
    )
  }

  const listingId = listingRow.id
  const renterProfile = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, role, email')
    .eq('id', renterId)
    .single()
    .then((r) => r.data)

  const partnerProfile = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, role, email')
    .eq('id', partnerId)
    .single()
    .then((r) => r.data)

  const renterName = displayNameFromProfile(renterProfile)
  const partnerName = displayNameFromProfile(partnerProfile)

  const { data: existing } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('listing_id', listingId)
    .eq('partner_id', partnerId)
    .eq('renter_id', renterId)
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    return NextResponse.json({
      success: true,
      data: { id: existing.id },
      existing: true,
      introSent: false,
    })
  }

  const convId = `conv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const now = new Date().toISOString()
  const listingCategory = listingRow.category_id != null ? String(listingRow.category_id) : null

  const conversationRow = {
    id: convId,
    listing_id: listingId,
    listing_category: listingCategory,
    partner_id: partnerId,
    partner_name: partnerName,
    renter_id: renterId,
    renter_name: renterName,
    type: 'INQUIRY',
    status: 'OPEN',
    status_label: 'OPEN',
    is_priority: false,
    created_at: now,
    updated_at: now,
    last_message_at: null,
  }

  const { error: insErr } = await supabaseAdmin.from('conversations').insert(conversationRow)

  if (insErr) {
    console.error('[from-profile] insert conv', insErr)
    return NextResponse.json(
      { success: false, error: insErr.message || 'Could not create conversation' },
      { status: 400 }
    )
  }

  const finalId = convId
  const listingTitle = listingRow.title || 'listing'
  const introText =
    langRaw === 'ru'
      ? `Здравствуйте! Пишу вам со страницы профиля GoStayLo по объекту «${listingTitle}».`
      : langRaw === 'zh'
        ? `您好！我在 GoStayLo 用户资料页看到「${listingTitle}」，想和您联系。`
        : langRaw === 'th'
          ? `สวัสดีครับ/ค่ะ เขียนจากหน้าโปรไฟล์ GoStayLo เกี่ยวกับ «${listingTitle}»`
          : `Hello! I'm messaging you from your GoStayLo profile page regarding «${listingTitle}».`
  const msgId = `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const msgNow = new Date().toISOString()
  const accessRole = effectiveRoleFromProfile(viewer)
  const senderName = displayNameFromProfile(viewer)

  const messageData = {
    id: msgId,
    conversation_id: finalId,
    sender_id: viewerId,
    sender_role: accessRole,
    sender_name: senderName,
    message: introText,
    content: introText,
    type: 'text',
    metadata: { source: 'profile_inquiry' },
    is_read: false,
    created_at: msgNow,
  }

  const { error: msgErr } = await supabaseAdmin.from('messages').insert(messageData)

  let introSent = false
  if (!msgErr) {
    introSent = true
    await supabaseAdmin
      .from('conversations')
      .update({ updated_at: msgNow, last_message_at: msgNow })
      .eq('id', finalId)

    const recipientId = viewerId === partnerId ? renterId : partnerId
    const base = getPublicSiteUrl()
    const link = `${base}/messages/${encodeURIComponent(finalId)}`
    PushService.sendToUser(recipientId, 'NEW_MESSAGE', {
      sender: senderName,
      senderId: viewerId,
      link,
      conversationId: finalId,
      messageId: msgId,
    }).catch((e) => console.error('[from-profile] FCM', e?.message || e))
  }

  return NextResponse.json({
    success: true,
    data: { id: finalId },
    existing: false,
    introSent,
  })
}
