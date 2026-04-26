/**
 * POST /api/cron/partner-client-review-invite
 * После календарного check_out: PARTNER_GUEST_REVIEW_INVITE (Telegram + FCM), Stage 47.2.
 * Не вызывается при разморозке эскроу — см. lib/services/partner-client-review-invite-cron.service.js
 */

export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'
import { startOpsJobRun, finishOpsJobRun } from '@/lib/ops-job-runs'
import { processPartnerClientReviewInvitesDue } from '@/lib/services/partner-client-review-invite-cron.service'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'

export async function POST(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied
  const run = await startOpsJobRun('partner-client-review-invite')
  try {
    const result = await processPartnerClientReviewInvitesDue({ limit: 80 })
    await finishOpsJobRun(run, {
      status: 'success',
      stats: { processed: result.processed ?? 0, skipped: result.skipped ?? 0 },
    })
    if (result.errors?.length) {
      void notifySystemAlert(
        `⭐ <b>Cron: partner-client-review-invite</b> partial errors\n<code>${escapeSystemAlertHtml(
          result.errors.slice(0, 5).join('\n'),
        )}</code>`,
      )
    }
    return NextResponse.json({
      success: true,
      processed: result.processed,
      skipped: result.skipped,
      errors: result.errors,
    })
  } catch (error) {
    void notifySystemAlert(
      `⭐ <b>Cron: partner-client-review-invite</b>\n<code>${escapeSystemAlertHtml(error?.message || error)}</code>`,
    )
    await finishOpsJobRun(run, { status: 'error', errorMessage: error?.message })
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function GET(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied
  return NextResponse.json({
    success: true,
    message: 'Partner client review invite — runs after check_out (listing calendar date)',
  })
}
