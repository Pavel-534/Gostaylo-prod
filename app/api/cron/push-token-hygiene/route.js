/**
 * Ежедневная гигиена FCM: тихий badge-push по каждому токену; UNREGISTERED → удаление в PushService.
 * Триггер: GitHub Actions cron или Vercel Cron с Authorization: Bearer CRON_SECRET.
 */

import { NextResponse } from 'next/server'
import { PushService } from '@/lib/services/push.service'
import { supabaseAdmin } from '@/lib/supabase'
import { startOpsJobRun, finishOpsJobRun } from '@/lib/ops-job-runs'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const BATCH = 25
const MAX_TOKENS = 800

async function runHygiene() {
  if (!supabaseAdmin) {
    return { ok: false, error: 'supabaseAdmin unavailable', probed: 0, removed: 0 }
  }
  let beforeCount = 0
  try {
    const { count } = await supabaseAdmin.from('user_push_tokens').select('*', { count: 'exact', head: true })
    beforeCount = Number(count || 0)
  } catch {
    beforeCount = 0
  }
  const { data: rows, error } = await supabaseAdmin
    .from('user_push_tokens')
    .select('token')
    .limit(MAX_TOKENS)

  if (error) {
    return { ok: false, error: error.message, probed: 0, removed: 0 }
  }

  const tokens = (Array.isArray(rows) ? rows : [])
    .map((r) => String(r?.token || '').trim())
    .filter(Boolean)

  let probed = 0
  for (let i = 0; i < tokens.length; i += BATCH) {
    const chunk = tokens.slice(i, i + BATCH)
    await Promise.all(
      chunk.map(async (token) => {
        probed += 1
        await PushService.sendSilentBadgeUpdate(token, 0)
      }),
    )
  }

  let afterCount = beforeCount
  try {
    const { count } = await supabaseAdmin.from('user_push_tokens').select('*', { count: 'exact', head: true })
    afterCount = Number(count || 0)
  } catch {
    afterCount = beforeCount
  }

  return {
    ok: true,
    probed,
    maxTokens: MAX_TOKENS,
    removed: Math.max(0, beforeCount - afterCount),
  }
}

export async function POST(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied
  const run = await startOpsJobRun('push-token-hygiene')
  try {
    const result = await runHygiene()
    await finishOpsJobRun(run, {
      status: result?.ok ? 'success' : 'error',
      stats: {
        probed: Number(result?.probed || 0),
        removed: Number(result?.removed || 0),
        max_tokens: Number(result?.maxTokens || MAX_TOKENS),
      },
      errorMessage: result?.ok ? null : result?.error || null,
    })
    return NextResponse.json(result)
  } catch (e) {
    const err = e?.message || 'hygiene failed'
    await finishOpsJobRun(run, { status: 'error', stats: {}, errorMessage: err })
    return NextResponse.json({ error: err }, { status: 500 })
  }
}

export async function GET(request) {
  return POST(request)
}
