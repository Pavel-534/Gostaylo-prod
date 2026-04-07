/**
 * POST /api/v2/internal/e2e/performance-low-alert
 * Speed Bot: после 3 подряд замеров LCP > порога и вне «тихого» окна 6 ч → notifySystemAlert [PERFORMANCE_LOW].
 *
 * Заголовок: x-e2e-fixture-secret
 * Тело: { pageKey?: string, url: string, lcpMs: number, serverTtfbMs?: number, thresholdMs?: number }
 */

import { NextResponse } from 'next/server'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify'
import { processPerformanceSample } from '@/lib/e2e/performance-low-alert-state'

export const dynamic = 'force-dynamic'

function getSecret() {
  return String(process.env.E2E_FIXTURE_SECRET || '').trim()
}

function recommendationRu(serverTtfbMs) {
  const t = Number(serverTtfbMs)
  if (Number.isFinite(t) && t > 800) {
    return 'Проверьте время ответа API и нагрузку на сервер (TTFB высокий).'
  }
  return 'Проверьте вес изображений и LCP-элемент на странице (кэш CDN, приоритет загрузки).'
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
  const pageKey = typeof body.pageKey === 'string' ? body.pageKey.trim() : 'page'
  const lcpMs = Number(body.lcpMs)
  const serverTtfbMs = body.serverTtfbMs != null ? Number(body.serverTtfbMs) : NaN
  const thresholdRaw = body.thresholdMs != null ? Number(body.thresholdMs) : 3500
  const thresholdUsed = Number.isFinite(thresholdRaw) ? thresholdRaw : 3500

  if (!url || !Number.isFinite(lcpMs)) {
    return NextResponse.json({ success: false, error: 'url and lcpMs required' }, { status: 400 })
  }

  const result = processPerformanceSample(pageKey, lcpMs, thresholdUsed)

  if (result.fired) {
    const rec = recommendationRu(serverTtfbMs)
    const safeUrl = escapeSystemAlertHtml(url)
    const ttfbLine =
      Number.isFinite(serverTtfbMs) && serverTtfbMs >= 0
        ? `\nTTFB сервера: <b>${escapeSystemAlertHtml(String(Math.round(serverTtfbMs)))}</b> мс`
        : ''
    const html = [
      '<b>[PERFORMANCE_LOW]</b> Медленная отрисовка страницы',
      `URL: <code>${safeUrl}</code>`,
      `LCP: <b>${escapeSystemAlertHtml(String(Math.round(lcpMs)))}</b> мс (порог ${escapeSystemAlertHtml(String(thresholdUsed))} мс)${ttfbLine}`,
      `<i>${escapeSystemAlertHtml(rec)}</i>`,
    ].join('\n')
    await notifySystemAlert(html)
  }

  return NextResponse.json({
    success: true,
    ...result,
  })
}
