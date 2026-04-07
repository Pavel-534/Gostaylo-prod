/**
 * POST /api/v2/internal/e2e/seo-spy-alert
 * Telegram system topic: [SEO_FAILURE] для Playwright SEO Spy Bot (сценарий №25).
 *
 * Заголовок: x-e2e-fixture-secret: <E2E_FIXTURE_SECRET>
 * Тело: { url: string, detail?: string }
 */

import { NextResponse } from 'next/server'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify'

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

  const url = typeof body.url === 'string' ? body.url.trim() : ''
  const detail = typeof body.detail === 'string' ? body.detail.trim() : ''
  if (!url) {
    return NextResponse.json({ success: false, error: 'url required' }, { status: 400 })
  }

  const safeUrl = escapeSystemAlertHtml(url)
  const safeDetail = escapeSystemAlertHtml(detail)
  const html = [
    '<b>[SEO_FAILURE]</b> Missing metadata on page',
    `<code>${safeUrl}</code>`,
    safeDetail ? safeDetail : '',
  ]
    .filter(Boolean)
    .join('\n')

  await notifySystemAlert(html)

  return NextResponse.json({ success: true })
}
