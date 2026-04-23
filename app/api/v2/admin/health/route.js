/**
 * GET /api/v2/admin/health
 * Aggregates ops_job_runs (7d) + critical_signal_events (PRICE_TAMPERING, 7d).
 * Access: ADMIN role or email in ADMIN_HEALTH_EMAILS (see lib/admin-health-access.js).
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveAdminHealthProfile } from '@/lib/admin-health-access'
import { formatEmergencyChecklistRu } from '@/lib/emergency-contact-admin-notify'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const WINDOW_DAYS = 7
const OPS_MISSING = "Could not find the table 'public.ops_job_runs'"
const CRITICAL_MISSING = "Could not find the table 'public.critical_signal_events'"
const SLA_NUDGE_MISSING = "Could not find the table 'public.partner_sla_nudge_events'"

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
    if (jobName === 'partner-sla-telegram-nudge') {
      sumDelivered += Number(s.sent || 0)
      sumStuckFound += Number(s.scanned || 0)
      sumRemoved += Number(s.skipped || 0)
      sumProbed += Number(s.errors || 0)
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
            : jobName === 'partner-sla-telegram-nudge'
              ? {
                  sent: sumDelivered,
                  scanned: sumStuckFound,
                  skipped: sumRemoved,
                  errors: sumProbed,
                }
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

  const jobNames = ['ical-sync', 'push-sweeper', 'push-token-hygiene', 'partner-sla-telegram-nudge']
  const jobs = Object.fromEntries(jobNames.map((name) => [name, aggregateJob(opsRows, name)]))

  let slaNudge = {
    tablePresent: true,
    error: null,
    events7d: 0,
    lastCreatedAt: null,
    uniquePartnersSample: 0,
  }
  const { count: slaCount, error: slaCountErr } = await supabaseAdmin
    .from('partner_sla_nudge_events')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', since)

  if (slaCountErr) {
    if (String(slaCountErr.message || '').includes(SLA_NUDGE_MISSING)) {
      slaNudge = { ...slaNudge, tablePresent: false, error: null }
    } else {
      slaNudge = { ...slaNudge, error: slaCountErr.message }
    }
  } else {
    slaNudge.events7d = Number(slaCount || 0)
  }

  if (!slaNudge.error && slaNudge.tablePresent) {
    const { data: lastSla, error: lastErr } = await supabaseAdmin
      .from('partner_sla_nudge_events')
      .select('created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (lastErr && !String(lastErr.message || '').includes(SLA_NUDGE_MISSING)) {
      slaNudge.error = lastErr.message
    } else {
      slaNudge.lastCreatedAt = lastSla?.created_at || null
    }

    const { data: partnerRows, error: partErr } = await supabaseAdmin
      .from('partner_sla_nudge_events')
      .select('partner_id')
      .gte('created_at', since)
      .limit(5000)
    if (!partErr && Array.isArray(partnerRows)) {
      slaNudge.uniquePartnersSample = new Set(partnerRows.map((r) => String(r.partner_id || ''))).size
    }
  }

  const slaJob = jobs['partner-sla-telegram-nudge']
  const sent7d = Number(slaJob?.totals?.sent || 0)
  const coveragePct =
    slaNudge.events7d > 0 ? Math.min(100, Math.round((sent7d / slaNudge.events7d) * 1000) / 10) : null

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  let emergencyContacts24h = 0
  let emergencyScanError = null
  /** @type {{ bookingId: string, at: string, reasonsRu: string }[]} */
  const emergencyRecentBookings = []
  const { data: bookingRows, error: bookErr } = await supabaseAdmin
    .from('bookings')
    .select('id, metadata, updated_at')
    .gte('updated_at', since24h)
    .limit(5000)

  if (bookErr) {
    emergencyScanError = bookErr.message
  } else {
    const t0 = new Date(since24h).getTime()
    for (const row of bookingRows || []) {
      const bid = row?.id != null ? String(row.id) : ''
      const ev = row?.metadata?.emergency_contact_events
      if (!Array.isArray(ev) || !bid) continue
      for (const e of ev) {
        const at = e?.at != null ? new Date(String(e.at)).getTime() : NaN
        if (Number.isFinite(at) && at >= t0) {
          emergencyContacts24h += 1
          emergencyRecentBookings.push({
            bookingId: bid,
            at: String(e.at || ''),
            reasonsRu: formatEmergencyChecklistRu(e?.checklist),
          })
        }
      }
    }
    emergencyRecentBookings.sort((a, b) => {
      const ta = new Date(String(a.at || 0)).getTime()
      const tb = new Date(String(b.at || 0)).getTime()
      return tb - ta
    })
  }

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
    slaNudge: {
      ...slaNudge,
      opsSent7d: sent7d,
      opsScanned7d: Number(slaJob?.totals?.scanned || 0),
      opsSkipped7d: Number(slaJob?.totals?.skipped || 0),
      opsErrors7d: Number(slaJob?.totals?.errors || 0),
      telegramVsDbPercent: coveragePct,
    },
    trustSafety: {
      emergencyContacts24h,
      emergencyScanSince: since24h,
      emergencyScanError,
      emergencyRecentBookings: emergencyRecentBookings.slice(0, 40),
    },
    meta: {
      opsError,
      opsTablePresent: !opsFetchError || !String(opsFetchError.message || '').includes(OPS_MISSING),
    },
  })
}
