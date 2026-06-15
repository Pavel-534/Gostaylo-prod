/**
 * POST /api/v2/chat/support/join
 * ADMIN/MODERATOR: assign self to conversation, set priority, insert support_joined system message.
 */

import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import {
  canReadConversation,
  effectiveRoleFromProfile,
  isStaffRole,
} from '@/lib/services/chat/access'
import { supabaseAdmin } from '@/lib/supabase'
import { formatPrivacyDisplayNameForParticipant } from '@/lib/utils/name-formatter'
import {
  buildSupportJoinedChatPayload,
  resolveAnnouncementText,
} from '@/lib/booking-chat-copy.js'

export const dynamic = 'force-dynamic'

function displayNameFromProfile(p) {
  if (!p) return 'Support'
  return formatPrivacyDisplayNameForParticipant(p.first_name, p.last_name, p.email, 'Support')
}

function supportJoinedCopy(lang, adminName, forDispute = false) {
  const copies = buildSupportJoinedChatPayload({ adminName, forDispute })
  const { title, body } = resolveAnnouncementText(
    {
      ru: { title: copies.announcement_title, body: copies.announcement_body },
      en: { title: copies.announcement_title_en, body: copies.announcement_body_en },
      zh: { title: copies.announcement_title_zh, body: copies.announcement_body_zh },
      th: { title: copies.announcement_title_th, body: copies.announcement_body_th },
    },
    lang,
  )
  return `${title}\n\n${body}`.trim()
}

export async function POST(request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 })
  }

  const session = await getSessionPayload()
  if (!session?.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id,first_name,last_name,role,email')
    .eq('id', session.userId)
    .maybeSingle()

  const accessRole = effectiveRoleFromProfile(profile)
  if (!isStaffRole(accessRole)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const conversationId = body?.conversationId
  if (!conversationId) {
    return NextResponse.json({ success: false, error: 'conversationId required' }, { status: 400 })
  }

  const lang = typeof body?.lang === 'string' ? body.lang : 'en'

  const { data: conversation, error: convErr } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle()

  if (convErr || !conversation) {
    return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 })
  }

  if (!canReadConversation(session.userId, accessRole, conversation)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const uid = String(session.userId)
  const adminName = displayNameFromProfile(profile)
  const now = new Date().toISOString()

  /** Same admin: no duplicate banner / message (e.g. page refresh or repeated click). */
  if (String(conversation.admin_id || '') === uid) {
    return NextResponse.json({
      success: true,
      data: { alreadyJoined: true, conversationId },
    })
  }

  const forDispute = body?.forDispute === true || body?.disputeContext === true
  const textBody = supportJoinedCopy(lang, adminName, forDispute)
  const payload = buildSupportJoinedChatPayload({ adminName, forDispute })
  const messageId = `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

  const { error: msgErr } = await supabaseAdmin.from('messages').insert({
    id: messageId,
    conversation_id: conversationId,
    sender_id: session.userId,
    sender_role: accessRole,
    sender_name: adminName,
    message: textBody,
    content: textBody,
    type: 'system',
    metadata: payload,
    is_read: false,
    created_at: now,
  })

  if (msgErr) {
    console.error('[chat/support/join] message insert', msgErr)
    return NextResponse.json({ success: false, error: msgErr.message }, { status: 400 })
  }

  const { error: patchErr } = await supabaseAdmin
    .from('conversations')
    .update({
      admin_id: session.userId,
      admin_name: adminName,
      is_priority: true,
      updated_at: now,
      last_message_at: now,
    })
    .eq('id', conversationId)

  if (patchErr) {
    console.error('[chat/support/join] conversation update', patchErr)
    return NextResponse.json({ success: false, error: patchErr.message }, { status: 400 })
  }

  return NextResponse.json({
    success: true,
    data: { messageId, conversationId, adminName },
  })
}
