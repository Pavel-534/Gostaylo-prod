/**
 * Daily Telegram reminder: partners with linked Telegram and draft listings.
 * POST /api/cron/draft-digest
 *
 * Vercel Cron: ~09:00 Bangkok (02:00 UTC)
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { NotificationService } from '@/lib/services/notification.service'

const CRON_SECRET = process.env.CRON_SECRET || 'gostaylo-cron-2026'

export async function POST(request) {
  try {
    const vercelCron = request.headers.get('x-vercel-cron')
    const authHeader = request.headers.get('x-cron-secret') || request.headers.get('authorization')
    if (!vercelCron && authHeader !== CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const result = await NotificationService.runDailyDraftDigestReminders()
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    console.error('[CRON DRAFT DIGEST]', e)
    return NextResponse.json({ success: false, error: e?.message || 'error' }, { status: 500 })
  }
}
