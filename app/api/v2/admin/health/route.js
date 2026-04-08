/**
 * GET /api/v2/admin/health
 * Aggregates ops_job_runs (7d) + critical_signal_events (PRICE_TAMPERING, 7d).
 * Access: ADMIN role or email in ADMIN_HEALTH_EMAILS (see lib/admin-health-access.js).
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveAdminHealthProfile } from '@/lib/admin-health-access'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const WINDOW_DAYS = 7
const OPS_MISSING = "Could not find the table 'public.ops_job_runs'"
const CRITICAL_MISSING = "Could not find the table 'public.critical_signal_events'"

function sinceIso() {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - WINDOW_DAYS)
  return d.toISOString()
}

function pickLatestRuns(rows, jobName) {
  const list = (rows || []).filter((r) => r.job_name === jobName)
  list.sort((a, b) => new Date(b.started_at || 0) - new Date(a.started_at || 0))
  return list
}

function aggregateJob(rows, jobName) {
  const runs = pickLatestRuns(rows, jobName)
  const last = runs[0] || null
  let successRuns = 0
  let errorRuns = 0
  let sumDelivered = 0
  let sumStuckFound = 0
  let sumRemoved = 0
  let sumProbed = 0
  let sumSynced = 0
  let sumIcalErrors = 0
  let sumTotal = 0

  for (const r of runs) {
    if (r.status === 'success') successRuns += 1
    else if (r.status === 'error') errorRuns += 1
    const s = r.stats && typeof r.stats === 'object' ? r.stats : {}
    if (jobName === 'push-sweeper') {
      sumDelivered += Number(s.delivered || 0)
      sumStuckFound += Number(s.stuck_found || 0)
    }
    if (jobName === 'push-token-hygiene') {
      sumRemoved += Number(s.removed || 0)
      sumProbed += Number(s.probed || 0)
    }
    if (jobName === 'ical-sync') {
      sumSynced += Number(s.synced || 0)
      sumIcalErrors += Number(s.errors || 0)
      sumTotal += Number(s.total || 0)
    }
  }

  return {
    jobName,
    runCount: runs.length,
    successRuns,
    errorRuns,
    lastStatus: last?.status || null,
    lastStartedAt: last?.started_at || null,
    lastFinishedAt: last?.finished_at || null,
    lastErrorMessage: last?.error_message || null,
    totals:
      jobName === 'push-sweeper'
        ? { delivered: sumDelivered, stuck_found: sumStuckFound }
        : jobName === 'push-token-hygiene'
          ? { removed: sumRemoved, probed: sumProbed }
          : jobName === 'ical-sync'
            ? { synced: sumSynced, errors: sumIcalErrors, listings_considered: sumTotal }
            : {},
  }
}

export async function GET() {
  const session = await resolveAdminHealthProfile()
  if (session.error) {
    return NextResponse.json(
      { success: false, error: session.error.message },
      { status: session.error.status },
    )
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { success: false, error: 'Server database client unavailable' },
      { status: 500 },
    )
  }

  const since = sinceIso()
  let opsRows = []
  let opsError = null
  const { data: opsData, error: opsFetchError } = await supabaseAdmin
    .from('ops_job_runs')
    .select('job_name,status,started_at,finished_at,stats,error_message')
    .gte('started_at', since)
    .order('started_at', { ascending: false })
    .limit(2000)

  if (opsFetchError) {
    if (!String(opsFetchError.message || '').includes(OPS_MISSING)) {
      opsError = opsFetchError.message
    }
  } else {
    opsRows = Array.isArray(opsData) ? opsData : []
  }

  let tamperCount = 0
  let tamperRecent = []
  let criticalError = null
  const { count, error: countErr } = await supabaseAdmin
    .from('critical_signal_events')
    .select('*', { count: 'exact', head: true })
    .eq('signal_key', 'PRICE_TAMPERING')
    .gte('created_at', since)

  if (countErr) {
    if (!String(countErr.message || '').includes(CRITICAL_MISSING)) {
      criticalError = countErr.message
    }
  } else {
    tamperCount = Number(count || 0)
  }

  const { data: recentRows, error: recentErr } = await supabaseAdmin
    .from('critical_signal_events')
    .select('id, signal_key, created_at, detail')
    .eq('signal_key', 'PRICE_TAMPERING')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(12)

  if (recentErr) {
    if (!String(recentErr.message || '').includes(CRITICAL_MISSING) && !criticalError) {
      criticalError = recentErr.message
    }
  } else {
    tamperRecent = Array.isArray(recentRows) ? recentRows : []
  }

  const jobNames = ['ical-sync', 'push-sweeper', 'push-token-hygiene']
  const jobs = Object.fromEntries(jobNames.map((name) => [name, aggregateJob(opsRows, name)]))

  return NextResponse.json({
    success: true,
    windowDays: WINDOW_DAYS,
    since,
    jobs,
    security: {
      priceTamperingCount: tamperCount,
      recent: tamperRecent,
      error: criticalError,
    },
    meta: {
      opsError,
      opsTablePresent: !opsFetchError || !String(opsFetchError.message || '').includes(OPS_MISSING),
    },
  })
}
