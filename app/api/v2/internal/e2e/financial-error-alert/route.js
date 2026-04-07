/**
 * POST /api/v2/internal/e2e/financial-error-alert
 * Playwright Accountant Bot: критический сигнал [FINANCIAL_ERROR] через recordCriticalSignal → Telegram.
 *
 * Заголовок: x-e2e-fixture-secret: <E2E_FIXTURE_SECRET>
 * Тело: { detail: string } — например "Mismatch: Expected 500.00, Got 499.99"
 */

import { NextResponse } from 'next/server'
import { recordCriticalSignal } from '@/lib/critical-telemetry.js'

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

  let body = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const detail = typeof body.detail === 'string' ? body.detail.trim() : ''
  if (!detail) {
    return NextResponse.json({ success: false, error: 'detail required' }, { status: 400 })
  }

  recordCriticalSignal('FINANCIAL_ERROR', {
    tag: '[FINANCIAL_ERROR]',
    threshold: 1,
    windowMs: 120_000,
    detailLines: [detail],
  })

  return NextResponse.json({ success: true })
}
