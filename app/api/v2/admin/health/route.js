/**
 * GET /api/v2/admin/health
 * Aggregates ops_job_runs (7d) + critical_signal_events + notification channel metrics (24h).
 * Access: ADMIN role or email in ADMIN_HEALTH_EMAILS (see lib/admin-health-access.js).
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { formatEmergencyChecklistRu } from '@/lib/emergency-contact-admin-notify'
import { resolveAdminHealthProfile } from '@/lib/admin-health-access.js'
import { loadReferralReconciliationHealth } from '@/lib/admin/referral-reconciliation-health.js'
import { loadReferralUnlockHealth } from '@/lib/admin/referral-unlock-health.js'
import { loadReferralSystemHealth } from '@/lib/admin/referral-system-health.js'
import {
  sanitizeOpsJobRows,
  buildOpsJobsMap,
  collectRecentJobFailures,
} from '@/lib/admin/ops-job-health.js'
import { loadNotificationChannelHealth } from '@/lib/admin/notification-channel-health.js'
import { loadCriticalSignalsHealth } from '@/lib/admin/critical-signals-health.js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const WINDOW_DAYS = 7
const OPS_MISSING = "Could not find the table 'public.ops_job_runs'"
const SLA_NUDGE_MISSING = "Could not find the table 'public.partner_sla_nudge_events'"

function sinceIso(days = WINDOW_DAYS) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString()
}

export async function GET(request) {
  const health = await resolveAdminHealthProfile()
  if (health.error) {
    return NextResponse.json(
      { success: false, error: health.error.message },
      { status: health.error.status || 403 },
    )
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { success: false, error: 'Server database client unavailable' },
      { status: 500 },
    )
  }

  const since = sinceIso()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

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
    opsRows = sanitizeOpsJobRows(Array.isArray(opsData) ? opsData : [])
  }

  const jobs = buildOpsJobsMap(opsRows)
  const jobFailures = collectRecentJobFailures(opsRows, { sinceIso: since, limit: 24 })

  const url = new URL(request.url)
  const signalsKey = url.searchParams.get('signalsKey')
  const signalsQ = url.searchParams.get('signalsQ')

  const [referralReconciliation, referralUnlock, referralSystemHealth, notificationChannels, criticalSignals] =
    await Promise.all([
      loadReferralReconciliationHealth(),
      loadReferralUnlockHealth(),
      loadReferralSystemHealth(),
      loadNotificationChannelHealth({ opsRows, since24hIso: since24h }),
      loadCriticalSignalsHealth({
        sinceIso: since,
        signalKey: signalsKey,
        search: signalsQ,
        limit: 50,
      }),
    ])

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
    jobFailures,
    notificationChannels,
    security: {
      priceTamperingCount: criticalSignals.priceTamperingCount ?? 0,
      recent: (criticalSignals.events || []).filter((e) => e.signalKey === 'PRICE_TAMPERING').slice(0, 12),
      error: criticalSignals.error,
      criticalSignals,
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
    referralReconciliation,
    referralUnlock,
    referralSystemHealth,
    meta: {
      opsError,
      opsTablePresent: !opsFetchError || !String(opsFetchError.message || '').includes(OPS_MISSING),
    },
  })
}
