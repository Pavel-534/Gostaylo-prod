/**
 * GET /api/v2/debug/test-telegram
 * Sends "Test OK" to the admin Telegram group (sendToAdminGroup).
 *
 * Gated: ADMIN session + (NODE_ENV !== 'production' OR ENABLE_DEBUG_TELEGRAM=1).
 */

import { NextResponse } from 'next/server'
import { getSessionPayload } from '@/lib/services/session-service'
import { supabaseAdmin } from '@/lib/supabase'
import { sendToAdminGroup } from '@/lib/telegram'
import { PARTNER_KYC_E2E_RUNBOOK_LINES } from '@/lib/runbooks/partner-kyc-e2e-smoke'

export const dynamic = 'force-dynamic'

async function requireAdminFromDb() {
  const session = await getSessionPayload()
  if (!session?.userId) return { error: 'Unauthorized', status: 401 }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', session.userId)
    .maybeSingle()
  if (error) return { error: error.message, status: 500 }

  if (String(data?.role || '').toUpperCase() !== 'ADMIN') {
    return { error: 'Admin access required', status: 403 }
  }
  return { userId: session.userId }
}

export async function GET() {
  const debugOk =
    process.env.NODE_ENV !== 'production' || String(process.env.ENABLE_DEBUG_TELEGRAM || '') === '1'
  if (!debugOk) {
    return NextResponse.json(
      {
        success: false,
        error: 'Debug Telegram disabled in production (set ENABLE_DEBUG_TELEGRAM=1 to allow).',
      },
      { status: 403 },
    )
  }

  const auth = await requireAdminFromDb()
  if (auth.error) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  const telegram = await sendToAdminGroup('Test OK')

  const runbook = PARTNER_KYC_E2E_RUNBOOK_LINES.join('\n')
  console.info(`[DEBUG/test-telegram] Admin ${auth.userId} triggered ping. Telegram ok=${telegram?.ok}\n${runbook}`)

  return NextResponse.json({
    success: true,
    telegram: { ok: telegram?.ok, description: telegram?.description || telegram?.error },
    runbook: PARTNER_KYC_E2E_RUNBOOK_LINES,
  })
}
