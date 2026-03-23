/**
 * POST /api/v2/chat/invoice/cancel — партнёр отменяет свой счёт (PENDING).
 * body: { messageId }
 */

import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { effectiveRoleFromProfile, userParticipatesInConversation } from '@/lib/services/chat/access'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const hdr = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

async function fetchProfile(userId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,role,first_name,last_name,email`,
    { headers: hdr, cache: 'no-store' }
  )
  const rows = await res.json()
  return Array.isArray(rows) ? rows[0] : null
}

async function fetchConversation(conversationId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${encodeURIComponent(conversationId)}&select=*`, {
    headers: hdr,
    cache: 'no-store',
  })
  const rows = await res.json()
  return Array.isArray(rows) ? rows[0] : null
}

export async function POST(request) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 })
  }

  const session = await getSessionPayload()
  if (!session?.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const messageId = body.messageId
  if (!messageId || typeof messageId !== 'string') {
    return NextResponse.json({ success: false, error: 'messageId required' }, { status: 400 })
  }

  const profile = await fetchProfile(session.userId)
  const role = effectiveRoleFromProfile(profile)
  if (role !== 'PARTNER') {
    return NextResponse.json({ success: false, error: 'Partner only' }, { status: 403 })
  }

  const msgRes = await fetch(
    `${SUPABASE_URL}/rest/v1/messages?id=eq.${encodeURIComponent(messageId)}&select=*`,
    { headers: hdr, cache: 'no-store' }
  )
  const msgRows = await msgRes.json()
  const message = Array.isArray(msgRows) ? msgRows[0] : null
  if (!message) {
    return NextResponse.json({ success: false, error: 'Message not found' }, { status: 404 })
  }

  const t = String(message.type || '').toLowerCase()
  if (t !== 'invoice') {
    return NextResponse.json({ success: false, error: 'Not an invoice message' }, { status: 400 })
  }

  const conv = await fetchConversation(message.conversation_id)
  if (!conv || !userParticipatesInConversation(session.userId, conv)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  if (String(conv.partner_id) !== String(session.userId)) {
    return NextResponse.json({ success: false, error: 'Only listing partner can cancel' }, { status: 403 })
  }

  const meta = message.metadata || {}
  const inv = meta.invoice || {}
  const invoiceId = meta.invoice_id || inv.id
  const st = String(inv.status || 'PENDING').toUpperCase()
  if (st !== 'PENDING') {
    return NextResponse.json({ success: false, error: 'Invoice is not pending' }, { status: 400 })
  }

  const now = new Date().toISOString()

  if (invoiceId) {
    await fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${encodeURIComponent(invoiceId)}`, {
      method: 'PATCH',
      headers: hdr,
      body: JSON.stringify({ status: 'cancelled', updated_at: now }),
    })
  }

  const newMeta = {
    ...meta,
    invoice: {
      ...inv,
      status: 'CANCELLED',
    },
  }

  const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/messages?id=eq.${encodeURIComponent(messageId)}`, {
    method: 'PATCH',
    headers: hdr,
    body: JSON.stringify({ metadata: newMeta }),
  })

  if (!patchRes.ok) {
    const err = await patchRes.text()
    console.error('[invoice/cancel]', err)
    return NextResponse.json({ success: false, error: 'Could not update message' }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: { messageId, invoiceId, status: 'CANCELLED' } })
}
