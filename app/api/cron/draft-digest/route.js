/**
 * Daily Telegram reminder: partners with linked Telegram and draft listings.
 * POST /api/cron/draft-digest — cron trigger (x-cron-secret / Authorization)
 * GET  /api/cron/draft-digest?secret=... — только для ручного теста (секрет в URL попадает в логи прокси)
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { NotificationService } from '@/lib/services/notification.service'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'

const CRON_SECRET = process.env.CRON_SECRET

function isAuthorizedPost(request) {
  if (!CRON_SECRET) return false
  const authHeader = request.headers.get('authorization')
  const cronHeader = request.headers.get('x-cron-secret')
  return authHeader === `Bearer ${CRON_SECRET}` || cronHeader === CRON_SECRET
}

async function runAndRespond() {
  const result = await NotificationService.runDailyDraftDigestReminders()
  return NextResponse.json({ success: true, ...result })
}

export async function GET(request) {
  try {
    if (!isAuthorizedPost(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    return await runAndRespond()
  } catch (e) {
    console.error('[CRON DRAFT DIGEST GET]', e)
    void notifySystemAlert(
      `⏰ <b>Cron: draft-digest</b> (GET)\n<code>${escapeSystemAlertHtml(e?.message || e)}</code>`,
    )
    return NextResponse.json({ success: false, error: e?.message || 'error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    if (!isAuthorizedPost(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    return await runAndRespond()
  } catch (e) {
    console.error('[CRON DRAFT DIGEST POST]', e)
    void notifySystemAlert(
      `⏰ <b>Cron: draft-digest</b> (POST)\n<code>${escapeSystemAlertHtml(e?.message || e)}</code>`,
    )
    return NextResponse.json({ success: false, error: e?.message || 'error' }, { status: 500 })
  }
}
