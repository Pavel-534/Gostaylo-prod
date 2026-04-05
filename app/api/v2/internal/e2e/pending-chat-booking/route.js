/**
 * POST /api/v2/internal/e2e/pending-chat-booking
 * Создаёт тестовую беседу с PENDING-бронью (для Playwright mobile-chat).
 *
 * Заголовок: x-e2e-fixture-secret: <E2E_FIXTURE_SECRET>
 * Тело JSON: { partnerEmail?, renterEmail? } — по умолчанию из env E2E_PARTNER_EMAIL / E2E_RENTER_EMAIL
 */

import { NextResponse } from 'next/server'
import { createPendingChatBookingFixture } from '@/lib/e2e/create-pending-chat-booking-fixture'

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

  const partnerEmail =
    (typeof body.partnerEmail === 'string' && body.partnerEmail.trim()) ||
    process.env.E2E_PARTNER_EMAIL ||
    '86boa@mail.ru'
  const renterEmail =
    (typeof body.renterEmail === 'string' && body.renterEmail.trim()) ||
    process.env.E2E_RENTER_EMAIL ||
    'pavel29031983@gmail.com'

  try {
    const data = await createPendingChatBookingFixture({ partnerEmail, renterEmail })
    return NextResponse.json({ success: true, data })
  } catch (e) {
    const msg = e?.message || String(e)
    console.error('[e2e/pending-chat-booking]', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
