/**
 * GET  /api/v2/chat/templates — вернуть массив шаблонов быстрых ответов из profiles.metadata.chat_templates
 * POST /api/v2/chat/templates — сохранить новый шаблон (добавляет в массив)
 * DELETE /api/v2/chat/templates?id=N — удалить шаблон по индексу или id
 */

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
  Prefer: 'return=representation',
}

async function getProfile(userId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=metadata`,
    { headers: hdr, cache: 'no-store' }
  )
  const rows = await res.json()
  return Array.isArray(rows) ? rows[0] : null
}

function getTemplates(profile) {
  try {
    const meta = profile?.metadata
    const parsed = typeof meta === 'string' ? JSON.parse(meta) : meta
    const arr = parsed?.chat_templates
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

async function saveTemplates(userId, templates) {
  // Сначала читаем текущий metadata (чтобы не затереть другие поля)
  const profile = await getProfile(userId)
  let currentMeta = {}
  try {
    const raw = profile?.metadata
    currentMeta = typeof raw === 'string' ? JSON.parse(raw) : (raw ?? {})
  } catch { /* ignore */ }

  const newMeta = { ...currentMeta, chat_templates: templates }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: hdrWrite,
      body: JSON.stringify({ metadata: newMeta }),
    }
  )
  return res.ok
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET() {
  const session = await getSessionPayload()
  if (!session?.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  const profile = await getProfile(session.userId)
  return NextResponse.json({ success: true, data: getTemplates(profile) })
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(request) {
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

  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  const label = typeof body?.label === 'string' ? body.label.trim() : ''
  if (!text) {
    return NextResponse.json({ success: false, error: 'text is required' }, { status: 400 })
  }

  const profile = await getProfile(session.userId)
  const current = getTemplates(profile)

  // Максимум 20 шаблонов
  if (current.length >= 20) {
    return NextResponse.json(
      { success: false, error: 'Maximum 20 templates allowed' },
      { status: 400 }
    )
  }

  const newTemplate = {
    id: `tpl_${Date.now()}`,
    text,
    label: label || text.slice(0, 40),
    createdAt: new Date().toISOString(),
  }

  const updated = [...current, newTemplate]
  const ok = await saveTemplates(session.userId, updated)

  if (!ok) {
    return NextResponse.json({ success: false, error: 'Failed to save' }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: updated })
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(request) {
  const session = await getSessionPayload()
  if (!session?.userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const tplId = searchParams.get('id')
  if (!tplId) {
    return NextResponse.json({ success: false, error: 'id required' }, { status: 400 })
  }

  const profile = await getProfile(session.userId)
  const current = getTemplates(profile)
  const updated = current.filter((t) => t.id !== tplId)

  if (updated.length === current.length) {
    return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 })
  }

  const ok = await saveTemplates(session.userId, updated)
  return NextResponse.json({ success: ok, data: updated })
}
