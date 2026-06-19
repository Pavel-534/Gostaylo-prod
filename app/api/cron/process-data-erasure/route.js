/**
 * POST /api/cron/process-data-erasure — execute due erasure requests after grace period.
 */

import { NextResponse } from 'next/server'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret'
import { processDueErasureRequests } from '@/lib/privacy/data-subject-erasure.service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request) {
  const cron = assertCronAuthorized(request)
  if (cron) return cron

  try {
    const result = await processDueErasureRequests()
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    console.error('[cron/process-data-erasure]', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}

export async function GET(request) {
  return POST(request)
}
