/**
 * POST /api/v2/internal/e2e/referral-dashboard-visual
 * Stage 133 — ambassador + team seed for Playwright visual snapshots.
 *
 * Header: x-e2e-fixture-secret: <E2E_FIXTURE_SECRET>
 */
import { NextResponse } from 'next/server'
import { createReferralDashboardVisualFixture } from '@/lib/e2e/referral-dashboard-visual-fixture'

export const dynamic = 'force-dynamic'

function getSecret() {
  return String(process.env.E2E_FIXTURE_SECRET || '').trim()
}

export async function POST(request) {
  const expected = getSecret()
  if (!expected) {
    return NextResponse.json({ success: false, error: 'Fixture API disabled' }, { status: 404 })
  }

  const hdr = request.headers.get('x-e2e-fixture-secret') || ''
  if (hdr !== expected) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const data = await createReferralDashboardVisualFixture()
    return NextResponse.json({ success: true, data })
  } catch (e) {
    const msg = e?.message || String(e)
    console.error('[e2e/referral-dashboard-visual]', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
