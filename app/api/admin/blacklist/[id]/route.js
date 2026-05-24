/**
 * DELETE /api/admin/blacklist/[id] — удалить запись из чёрного списка.
 */

import { NextResponse } from 'next/server'
import { resolveAdminSecurityProfile } from '@/lib/admin-security-access'
import { deleteAdminBlacklistEntry } from '@/lib/admin/blacklist-api'

export const dynamic = 'force-dynamic'

export async function DELETE(_request, { params }) {
  const gate = await resolveAdminSecurityProfile()
  if (gate.error) {
    return NextResponse.json({ error: gate.error.message }, { status: gate.error.status })
  }

  const id = params?.id
  const result = await deleteAdminBlacklistEntry(id)

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ success: true })
}
