/**
 * GET /api/admin/blacklist — кошельки и телефоны в чёрном списке (только ADMIN).
 */

import { NextResponse } from 'next/server'
import { resolveAdminSecurityProfile } from '@/lib/admin-security-access'
import { listAdminBlacklist } from '@/lib/admin/blacklist-api'

export const dynamic = 'force-dynamic'

export async function GET() {
  const gate = await resolveAdminSecurityProfile()
  if (gate.error) {
    return NextResponse.json({ error: gate.error.message }, { status: gate.error.status })
  }

  const result = await listAdminBlacklist()
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    success: true,
    data: { wallets: result.wallets, phones: result.phones },
  })
}
