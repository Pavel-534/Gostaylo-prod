/**
 * ADR-203 Phase 1 — shadow reconcile status-derived vs ledger-derived partner cash.
 * Does not mutate balances or payout eligibility.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { getPartnerBalance } from '@/lib/services/escrow/balance.service.js'
import { getPartnerBalanceFromLedger } from '@/lib/services/ledger/partner-ledger-balance.js'
import { round2 } from '@/lib/services/ledger/ledger-shared.js'
import { recordCriticalSignal } from '@/lib/critical-telemetry.js'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'

export const SHADOW_DRIFT_TOLERANCE_THB = 0.05
export const LEDGER_SHADOW_JOB_NAME = 'ledger_shadow_reconcile'
export const PROOF_ZERO_DRIFT_DAYS = 30

/**
 * @param {string} partnerId
 * @param {{ asOfDate?: string | Date | null, alignPendingPayoutReserve?: boolean }} [opts]
 */
export async function comparePartnerLedgerShadow(partnerId, opts = {}) {
  const pid = String(partnerId || '').trim()
  const alignReserve = opts.alignPendingPayoutReserve !== false

  const [statusRes, ledgerRes] = await Promise.all([
    getPartnerBalance(pid),
    getPartnerBalanceFromLedger(pid, { asOfDate: opts.asOfDate }),
  ])

  if (!statusRes?.success) {
    return {
      success: false,
      partnerId: pid,
      error: statusRes?.error || 'status_balance_failed',
    }
  }
  if (!ledgerRes?.success) {
    return {
      success: false,
      partnerId: pid,
      error: ledgerRes?.error || 'ledger_balance_failed',
    }
  }

  const bal = statusRes.balance || {}
  const pendingReserve = round2(bal.pendingPayoutReserveThb || 0)
  const statusAvailable = round2(bal.availableBalanceThb ?? bal.availableBalance ?? 0)
  const statusFrozen = round2(bal.frozenBalanceThb ?? bal.escrowBalance ?? 0)
  const statusTotal = round2(statusAvailable + statusFrozen)

  let ledgerAvailable = round2(ledgerRes.availableThb)
  if (alignReserve && pendingReserve > 0) {
    ledgerAvailable = round2(Math.max(0, ledgerAvailable - pendingReserve))
  }
  const ledgerFrozen = round2(ledgerRes.frozenThb)
  const ledgerTotal = round2(ledgerAvailable + ledgerFrozen)

  const delta = {
    availableThb: round2(ledgerAvailable - statusAvailable),
    frozenThb: round2(ledgerFrozen - statusFrozen),
    totalThb: round2(ledgerTotal - statusTotal),
  }

  const absMax = Math.max(
    Math.abs(delta.availableThb),
    Math.abs(delta.frozenThb),
    Math.abs(delta.totalThb),
  )
  const withinTolerance = absMax <= SHADOW_DRIFT_TOLERANCE_THB

  return {
    success: true,
    partnerId: pid,
    asOf: ledgerRes.asOf,
    withinTolerance,
    absMaxDeltaThb: absMax,
    statusDerived: {
      availableThb: statusAvailable,
      frozenThb: statusFrozen,
      totalThb: statusTotal,
      thawHoldBalanceThb: round2(bal.thawHoldBalanceThb || 0),
      disputeHoldBalanceThb: round2(bal.disputeHoldBalanceThb || 0),
      pendingPayoutReserveThb: pendingReserve,
      grossAvailableBalanceThb: round2(bal.grossAvailableBalanceThb || 0),
    },
    ledgerDerived: {
      availableThb: ledgerAvailable,
      frozenThb: ledgerFrozen,
      totalThb: ledgerTotal,
      accountNetThb: round2(ledgerRes.accountNetThb),
      earningsThb: round2(ledgerRes.earningsThb),
      payoutsThb: round2(ledgerRes.payoutsThb),
      holdsThb: round2(ledgerRes.holdsThb),
      refundsThb: round2(ledgerRes.refundsThb),
      alignPendingPayoutReserve: alignReserve,
    },
    delta,
  }
}

/**
 * Partners with recent money-pipe activity + PARTNER_EARNINGS accounts.
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<string[]>}
 */
export async function listShadowReconcilePartnerIds(opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit) || 80, 1), 200)
  if (!supabaseAdmin) return []

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const ids = new Set()

  const { data: recent } = await supabaseAdmin
    .from('bookings')
    .select('partner_id')
    .gte('updated_at', since)
    .not('partner_id', 'is', null)
    .limit(2000)
  for (const r of recent || []) {
    if (r?.partner_id) ids.add(String(r.partner_id))
  }

  const { data: accounts } = await supabaseAdmin
    .from('ledger_accounts')
    .select('partner_id')
    .eq('code', 'PARTNER_EARNINGS')
    .not('partner_id', 'is', null)
    .limit(500)
  for (const a of accounts || []) {
    if (a?.partner_id) ids.add(String(a.partner_id))
  }

  return [...ids].slice(0, limit)
}

/**
 * Count consecutive calendar days (UTC) with a successful run and stats.zeroDrift === true.
 * @returns {Promise<number>}
 */
export async function countConsecutiveZeroDriftDays() {
  if (!supabaseAdmin) return 0
  const { data, error } = await supabaseAdmin
    .from('ops_job_runs')
    .select('started_at, status, stats')
    .eq('job_name', LEDGER_SHADOW_JOB_NAME)
    .eq('status', 'success')
    .order('started_at', { ascending: false })
    .limit(60)

  if (error || !data?.length) return 0

  /** @type {Map<string, boolean>} day → zeroDrift */
  const byDay = new Map()
  for (const row of data) {
    const day = String(row.started_at || '').slice(0, 10)
    if (!day || byDay.has(day)) continue
    byDay.set(day, Boolean(row.stats?.zeroDrift))
  }

  const days = [...byDay.keys()].sort().reverse()
  let streak = 0
  let expect = null
  for (const day of days) {
    if (!byDay.get(day)) break
    if (expect == null) {
      expect = day
      streak = 1
      continue
    }
    const prev = new Date(`${expect}T00:00:00.000Z`)
    prev.setUTCDate(prev.getUTCDate() - 1)
    const prevDay = prev.toISOString().slice(0, 10)
    if (day !== prevDay) break
    expect = day
    streak += 1
  }
  return streak
}

/**
 * Daily shadow scan — alerts on drift; never flips SoT.
 * @param {{ limitPartners?: number, asOfDate?: string | null, alert?: boolean }} [opts]
 */
export async function runLedgerShadowReconcile(opts = {}) {
  const alert = opts.alert !== false
  const partnerIds = await listShadowReconcilePartnerIds({ limit: opts.limitPartners })
  const drifts = []
  let compared = 0
  let errors = 0

  for (const partnerId of partnerIds) {
    const cmp = await comparePartnerLedgerShadow(partnerId, { asOfDate: opts.asOfDate })
    if (!cmp.success) {
      errors += 1
      continue
    }
    compared += 1
    if (!cmp.withinTolerance) {
      drifts.push({
        partnerId,
        absMaxDeltaThb: cmp.absMaxDeltaThb,
        delta: cmp.delta,
        statusDerived: cmp.statusDerived,
        ledgerDerived: {
          availableThb: cmp.ledgerDerived.availableThb,
          frozenThb: cmp.ledgerDerived.frozenThb,
          totalThb: cmp.ledgerDerived.totalThb,
          accountNetThb: cmp.ledgerDerived.accountNetThb,
          holdsThb: cmp.ledgerDerived.holdsThb,
        },
      })
    }
  }

  // Empty partner set (no money activity) counts as clean for greenfield proof.
  const zeroDrift = drifts.length === 0 && errors === 0

  if (alert && drifts.length > 0) {
    recordCriticalSignal('LEDGER_DRIFT', {
      tag: '[LEDGER_DRIFT]',
      severity: 'WARN',
      threshold: 1,
      windowMs: 60 * 60 * 1000,
      detailLines: [
        `shadow_partners_with_drift=${drifts.length}`,
        `compared=${compared}`,
        ...drifts.slice(0, 8).map(
          (d) =>
            `partner=${d.partnerId} Δtotal=฿${d.delta.totalThb} Δavail=฿${d.delta.availableThb} Δfrozen=฿${d.delta.frozenThb}`,
        ),
      ],
    })

    try {
      const lines = drifts
        .slice(0, 5)
        .map(
          (d) =>
            `• <code>${escapeSystemAlertHtml(d.partnerId)}</code> Δtotal=฿${d.delta.totalThb}`,
        )
        .join('\n')
      await notifySystemAlert(
        `[LEDGER_DRIFT] Shadow reconcile: ${drifts.length} partner(s) beyond ฿${SHADOW_DRIFT_TOLERANCE_THB}\n${lines}`,
      )
    } catch {
      /* non-fatal */
    }
  }

  return {
    compared,
    errors,
    driftCount: drifts.length,
    drifts: drifts.slice(0, 40),
    zeroDrift,
    toleranceThb: SHADOW_DRIFT_TOLERANCE_THB,
    proofRequiredDays: PROOF_ZERO_DRIFT_DAYS,
  }
}
