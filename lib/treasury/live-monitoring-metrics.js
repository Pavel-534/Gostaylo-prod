/**
 * Stage 126.0 — read-only метрики для Live Monitoring (FinTech).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { isFintechTestBookingRow } from '@/lib/admin/fintech-test-data-markers.js'
import { TREASURY_ALERT_TYPES } from '@/lib/treasury/treasury-monitoring-alerts.js'
import { loadControlledLiveState } from '@/lib/treasury/controlled-live.js'

const POST_ESCROW = ['PAID_ESCROW', 'CHECKED_IN', 'THAWED', 'READY_FOR_PAYOUT', 'COMPLETED']

function sinceIso(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

/**
 * @param {{
 *   driftThb?: number,
 *   pendingFiscalCount?: number,
 * }} [scanHints]
 */
export async function loadLiveMonitoringMetrics(scanHints = {}) {
  const controlledLive = await loadControlledLiveState()
  const empty = {
    generatedAt: new Date().toISOString(),
    controlledLive,
    payments24h: 0,
    payments7d: 0,
    paidEscrowAwaitingThaw: 0,
    driftThb: Math.abs(Number(scanHints.driftThb) || 0),
    pendingFiscalCount: Number(scanHints.pendingFiscalCount) || 0,
    webhookErrors7d: 0,
    treasuryErrors7d: 0,
  }

  if (!supabaseAdmin) return empty

  const since24 = sinceIso(24)
  const since7d = sinceIso(24 * 7)

  const { data: recentRows } = await supabaseAdmin
    .from('bookings')
    .select('id, status, updated_at, metadata, listing_id, renter_id, partner_id, guest_email')
    .in('status', POST_ESCROW)
    .gte('updated_at', since7d)
    .limit(500)

  const rows = (recentRows || []).filter((b) => !isFintechTestBookingRow(b))
  const payments24h = rows.filter((b) => String(b.updated_at) >= since24).length
  const payments7d = rows.length

  const { count: escrowCount } = await supabaseAdmin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'PAID_ESCROW')

  let paidEscrowAwaitingThaw = escrowCount ?? 0
  if (paidEscrowAwaitingThaw > 0) {
    const { data: escrowRows } = await supabaseAdmin
      .from('bookings')
      .select('id, metadata, listing_id, renter_id, partner_id, guest_email')
      .eq('status', 'PAID_ESCROW')
      .limit(300)
    paidEscrowAwaitingThaw = (escrowRows || []).filter((b) => !isFintechTestBookingRow(b)).length
  }

  const { count: webhookErrors7d } = await supabaseAdmin
    .from('critical_signal_events')
    .select('id', { count: 'exact', head: true })
    .eq('signal_key', TREASURY_ALERT_TYPES.WEBHOOK_ERROR)
    .gte('created_at', since7d)

  const treasuryErrorKeys = [
    TREASURY_ALERT_TYPES.WEBHOOK_ERROR,
    TREASURY_ALERT_TYPES.LEDGER_DRIFT,
    TREASURY_ALERT_TYPES.FISCAL_PENDING,
  ]
  const { count: treasuryErrors7d } = await supabaseAdmin
    .from('critical_signal_events')
    .select('id', { count: 'exact', head: true })
    .in('signal_key', treasuryErrorKeys)
    .gte('created_at', since7d)

  return {
    ...empty,
    payments24h,
    payments7d,
    paidEscrowAwaitingThaw,
    webhookErrors7d: webhookErrors7d ?? 0,
    treasuryErrors7d: treasuryErrors7d ?? 0,
  }
}

export default { loadLiveMonitoringMetrics }
