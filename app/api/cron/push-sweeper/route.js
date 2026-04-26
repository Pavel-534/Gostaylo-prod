/**
 * Push sweeper: восстанавливает "зависшие" chat_push_delivery_batch.
 * Ищет пачки с дедлайном старше 10 минут, форсированно отправляет и очищает таблицу.
 */

import { NextResponse } from 'next/server'
import { PushService } from '@/lib/services/push.service'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'
import { startOpsJobRun, finishOpsJobRun } from '@/lib/ops-job-runs'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function runSweep() {
  return PushService.runStaleChatPushSweeper({ staleMinutes: 10, limit: 200 })
}

export async function POST(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied
  const run = await startOpsJobRun('push-sweeper')
  try {
    const result = await runSweep()
    await finishOpsJobRun(run, {
      status: result?.ok ? 'success' : 'error',
      stats: {
        stuck_found: Number(result?.stuckFound || 0),
        delivered: Number(result?.delivered || 0),
        checked: Number(result?.checked || 0),
        table_missing: result?.tableMissing === true,
      },
      errorMessage: result?.ok ? null : result?.error || null,
    })
    if (!result?.tableMissing && Number(result?.stuckFound || 0) > 0) {
      void notifySystemAlert(
        `🧹 <b>Push Sweeper</b>: найдены зависшие сообщения\n` +
          `• stale window: <b>10m+</b>\n` +
          `• rows: <b>${result.stuckFound}</b>\n` +
          `• delivered: <b>${result.delivered}</b>`,
      )
    }
    return NextResponse.json(result)
  } catch (e) {
    const err = e?.message || 'push sweeper failed'
    await finishOpsJobRun(run, {
      status: 'error',
      stats: {},
      errorMessage: err,
    })
    void notifySystemAlert(
      `🧹 <b>Cron: push-sweeper</b> — исключение\n<code>${escapeSystemAlertHtml(err)}</code>`,
    )
    return NextResponse.json({ ok: false, error: err }, { status: 500 })
  }
}

export async function GET(request) {
  return POST(request)
}
