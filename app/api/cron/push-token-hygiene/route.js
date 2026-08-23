/**
 * Ежедневная гигиена FCM: тихий badge-push по каждому токену; UNREGISTERED → удаление в PushService.
 * Stage 189.38 — skip iOS web tokens (silent badge unreliable); skip recently pinged tokens.
 * Триггер: GitHub Actions cron или Vercel Cron с Authorization: Bearer CRON_SECRET.
 */

import { NextResponse } from 'next/server'
import { PushService } from '@/lib/services/push.service'
import { supabaseAdmin } from '@/lib/supabase'
import { startOpsJobRun, finishOpsJobRun } from '@/lib/ops-job-runs'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'
import {
  shouldSkipHygieneByRecentActivity,
  shouldSkipSilentBadgeHygieneProbe,
} from '@/lib/push/push-token-hygiene.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const BATCH = 25
const MAX_TOKENS = 800
const RECENT_ACTIVITY_HOURS = 48

async function runHygiene() {
  if (!supabaseAdmin || typeof supabaseAdmin.from !== 'function') {
    return { ok: false, error: 'supabaseAdmin.from is unavailable', probed: 0, removed: 0 }
  }
  let beforeCount = 0
  try {
    const { count } = await supabaseAdmin.from('user_push_tokens').select('*', { count: 'exact', head: true })
    beforeCount = Number(count || 0)
  } catch {
    beforeCount = 0
  }

  let selectCols = 'token, device_info, last_seen_at'
  let { data: rows, error } = await supabaseAdmin
    .from('user_push_tokens')
    .select(selectCols)
    .order('last_seen_at', { ascending: true, nullsFirst: true })
    .limit(MAX_TOKENS)

  if (
    error &&
    /last_seen_at/i.test(String(error?.message || '')) &&
    /does not exist/i.test(String(error?.message || ''))
  ) {
    selectCols = 'token, device_info'
    ;({ data: rows, error } = await supabaseAdmin
      .from('user_push_tokens')
      .select(selectCols)
      .limit(MAX_TOKENS))
  }

  if (error) {
    return { ok: false, error: error.message, probed: 0, removed: 0 }
  }

  const candidates = (Array.isArray(rows) ? rows : [])
    .map((r) => ({
      token: String(r?.token || '').trim(),
      device_info: r?.device_info && typeof r.device_info === 'object' ? r.device_info : {},
      last_seen_at: r?.last_seen_at ?? null,
    }))
    .filter((r) => r.token)

  let skippedIos = 0
  let skippedRecent = 0
  const tokensToProbe = []
  for (const row of candidates) {
    if (shouldSkipSilentBadgeHygieneProbe(row.device_info)) {
      skippedIos += 1
      continue
    }
    if (shouldSkipHygieneByRecentActivity(row.last_seen_at, RECENT_ACTIVITY_HOURS)) {
      skippedRecent += 1
      continue
    }
    tokensToProbe.push(row.token)
  }

  let probed = 0
  for (let i = 0; i < tokensToProbe.length; i += BATCH) {
    const chunk = tokensToProbe.slice(i, i + BATCH)
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
    skippedIos,
    skippedRecent,
    candidates: candidates.length,
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
        skipped_ios: Number(result?.skippedIos || 0),
        skipped_recent: Number(result?.skippedRecent || 0),
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
