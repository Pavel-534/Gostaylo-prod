/**
 * Production financial health scan (Stage 99).
 * PENDING_FISCAL backlog + partner ledger drift vs booking buckets.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { recordCriticalSignal } from '@/lib/critical-telemetry.js'
import { computePartnerFinancesSummary } from '@/lib/services/partner-finances-summary.service.js'

const DRIFT_TOLERANCE_THB = 0.05
const DRIFT_ALERT_THRESHOLD = 3
const PENDING_FISCAL_ALERT_THRESHOLD = 5

/**
 * @returns {Promise<{ pendingFiscalCount: number, ledgerDriftPartners: Array<object>, alertsSent: string[] }>}
 */
export async function runFinancialHealthScan() {
  const alertsSent = []
  if (!supabaseAdmin) {
    return { pendingFiscalCount: 0, ledgerDriftPartners: [], alertsSent, error: 'no_db' }
  }

  let pendingFiscalCount = 0
  const { data: fiscalRows, error: fiscalErr } = await supabaseAdmin
    .from('bookings')
    .select('id')
    .in('status', ['PAID_ESCROW', 'THAWED', 'READY_FOR_PAYOUT', 'COMPLETED'])
    .filter('metadata->fiscal->>status', 'eq', 'PENDING_FISCAL')
    .limit(500)

  if (!fiscalErr) pendingFiscalCount = fiscalRows?.length ?? 0
  else {
    const { data: fallback } = await supabaseAdmin
      .from('bookings')
      .select('id, metadata')
      .in('status', ['PAID_ESCROW', 'THAWED', 'READY_FOR_PAYOUT'])
      .limit(800)
    pendingFiscalCount = (fallback || []).filter(
      (b) => String(b?.metadata?.fiscal?.status || '') === 'PENDING_FISCAL',
    ).length
  }

  if (pendingFiscalCount >= PENDING_FISCAL_ALERT_THRESHOLD) {
    recordCriticalSignal('PENDING_FISCAL_BACKLOG', {
      tag: '[FIN_HEALTH]',
      threshold: 1,
      windowMs: 60 * 60 * 1000,
      detailLines: [
        `count=${pendingFiscalCount}`,
        'Action: admin FinTech → Retry fiscal; check FISCAL_PROVIDER_URL',
      ],
    })
    alertsSent.push('PENDING_FISCAL_BACKLOG')
  }

  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recentPartners } = await supabaseAdmin
    .from('bookings')
    .select('partner_id')
    .gte('updated_at', since)
    .not('partner_id', 'is', null)
    .limit(2000)

  const partnerIds = [...new Set((recentPartners || []).map((r) => r.partner_id).filter(Boolean))].slice(
    0,
    40,
  )

  const ledgerDriftPartners = []
  for (const partnerId of partnerIds) {
    const summary = await computePartnerFinancesSummary(partnerId)
    if (!summary.success) continue
    const rec = summary.data?.reconciliation
    if (!rec || rec.withinTolerance) continue
    ledgerDriftPartners.push({
      partnerId,
      differenceThb: rec.differenceThb,
      escrowPlusAvailableThb: rec.escrowPlusAvailableThb,
      ledgerPartnerNetThb: rec.ledgerPartnerNetThb,
    })
    if (Math.abs(rec.differenceThb) > DRIFT_TOLERANCE_THB) {
      /* keep */
    }
  }

  if (ledgerDriftPartners.length >= DRIFT_ALERT_THRESHOLD) {
    recordCriticalSignal('LEDGER_DRIFT', {
      tag: '[FIN_HEALTH]',
      threshold: 1,
      windowMs: 60 * 60 * 1000,
      detailLines: [
        `partners_with_drift=${ledgerDriftPartners.length}`,
        ...ledgerDriftPartners.slice(0, 5).map(
          (p) => `partner=${p.partnerId} diff=฿${p.differenceThb}`,
        ),
      ],
    })
    alertsSent.push('LEDGER_DRIFT')
  }

  return { pendingFiscalCount, ledgerDriftPartners, alertsSent }
}
