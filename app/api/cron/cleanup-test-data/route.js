/**
 * GET/POST /api/cron/cleanup-test-data
 * Removes accumulated E2E/smoke listings (+ linked bookings, storage).
 *
 * Auth: CRON_SECRET. Query: dryRun=false to delete (default dryRun=true).
 */

import { NextResponse } from 'next/server'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js'
import { runCleanupTestData } from '@/lib/e2e/cleanup-test-data.service'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

async function handle(request) {
  const denied = assertCronAuthorized(request)
  if (denied) return denied

  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'Supabase admin unavailable' }, { status: 503 })
  }

  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dryRun') !== 'false'
  const protectListingIds = String(process.env.CLEANUP_TEST_DATA_PROTECT_LISTING_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  try {
    const report = await runCleanupTestData(supabaseAdmin, { dryRun, protectListingIds })
    return NextResponse.json({ success: true, ...report })
  } catch (e) {
    console.error('[cron/cleanup-test-data]', e)
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
