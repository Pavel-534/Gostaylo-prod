/**
 * POST /api/admin/blacklist/phone — добавить телефон в blacklist.
 */

import { NextResponse } from 'next/server'
import { resolveAdminSecurityProfile } from '@/lib/admin-security-access'
import { insertAdminBlacklistEntry } from '@/lib/admin/blacklist-api'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const gate = await resolveAdminSecurityProfile()
  if (gate.error) {
    return NextResponse.json({ error: gate.error.message }, { status: gate.error.status })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const number = String(body?.number || '').trim()
  if (!number) {
    return NextResponse.json({ error: 'number is required' }, { status: 400 })
  }

  const result = await insertAdminBlacklistEntry(
    'PHONE',
    number,
    body?.reason,
    gate.profile.id,
  )

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ success: true, data: { id: result.id } })
}
