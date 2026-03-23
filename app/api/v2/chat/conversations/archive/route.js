import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'

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
  Prefer: 'return=minimal',
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

  const { conversationId, archived = true } = body || {}
  if (!conversationId) {
    return NextResponse.json({ success: false, error: 'conversationId required' }, { status: 400 })
  }

  const fc = await fetch(
    `${SUPABASE_URL}/rest/v1/conversations?id=eq.${encodeURIComponent(conversationId)}&select=id,renter_id,partner_id`,
    { headers: hdr, cache: 'no-store' }
  )
  const rows = await fc.json()
  const row = Array.isArray(rows) ? rows[0] : null
  if (!row) {
    return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 })
  }

  const uid = String(session.userId)
  const isRenter = String(row.renter_id) === uid
  const isPartner = String(row.partner_id) === uid
  if (!isRenter && !isPartner) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const nowIso = new Date().toISOString()
  let patch
  if (isRenter) {
    patch = archived ? { renter_archived_at: nowIso } : { renter_archived_at: null }
  } else {
    patch = archived ? { partner_archived_at: nowIso } : { partner_archived_at: null }
  }
  const patchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/conversations?id=eq.${encodeURIComponent(conversationId)}`,
    { method: 'PATCH', headers: hdrWrite, body: JSON.stringify(patch) }
  )

  if (!patchRes.ok) {
    const err = await patchRes.text()
    return NextResponse.json(
      {
        success: false,
        error: err || 'Could not update conversation',
        hint: 'Run migrations 007_renter_conversation_archive.sql and 008_partner_conversation_archive.sql if columns missing',
      },
      { status: 400 }
    )
  }

  return NextResponse.json({ success: true, archived: !!archived })
}
