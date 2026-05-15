/**
 * GET/POST /api/cron/cleanup-storage
 * Orphan / stale Supabase Storage objects (Stage 95.1).
 *
 * Auth: CRON_SECRET (`Authorization: Bearer …` or `x-cron-secret`).
 * Query: `dryRun=false` to delete (default **dryRun=true** for safety).
 * Optional: `minAgeDays`, `graceHours`.
 */

import { NextResponse } from 'next/server'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'
import { supabaseAdmin } from '@/lib/supabase'
import { runStorageCleanup } from '@/lib/storage/storage-cleanup.service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/** Hobby: 10s; Pro: до 60s. Внутренний budgetMs укладывает работу раньше таймаута платформы. */
export const maxDuration = 60

async function handle(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied

  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'Supabase admin unavailable' }, { status: 503 })
  }

  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dryRun') !== 'false'
  const minAgeDays = url.searchParams.get('minAgeDays')
  const graceHours = url.searchParams.get('graceHours')
  const budgetMs = url.searchParams.get('budgetMs')

  const defaultBudget =
    Number(process.env.STORAGE_CLEANUP_BUDGET_MS) ||
    (process.env.VERCEL_ENV === 'production' ? 22_000 : 9_000)

  try {
    const result = await runStorageCleanup({
      supabaseAdmin,
      dryRun,
      minAgeDays: minAgeDays ? Number(minAgeDays) : undefined,
      graceHours: graceHours ? Number(graceHours) : undefined,
      budgetMs: budgetMs ? Number(budgetMs) : defaultBudget,
    })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (e) {
    console.error('[cron/cleanup-storage]', e)
    return NextResponse.json(
      { success: false, error: e?.message || 'cleanup_failed' },
      { status: 500 },
    )
  }
}

export async function GET(request) {
  return handle(request)
}

export async function POST(request) {
  return handle(request)
}
