import { NextResponse } from 'next/server'
import { requireAccess } from '@/lib/security/access-guard'
import { supabaseAdmin } from '@/lib/supabase'
import {
  isPricingEngineV2EnabledFromEnv,
  isPricingEngineV2Enabled,
} from '@/lib/pricing-engine/feature-flag.js'
import {
  getFiscalTransitSupplierInfo,
  isFiscalSandboxEnabled,
} from '@/lib/pricing-engine/fiscal-config.js'
import LedgerService from '@/lib/services/ledger.service.js'
import { loadTreasuryRailsSummary } from '@/lib/treasury/treasury-rails-summary.js'
import { isFintechTestBookingRow } from '@/lib/admin/fintech-test-data-markers.js'

export const dynamic = 'force-dynamic'

async function requireAdminOnly() {
  return requireAccess({ roles: ['ADMIN'] })
}

export async function GET(request) {
  const gate = await requireAdminOnly()
  if (gate.error) return gate.error

  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'no_db' }, { status: 503 })
  }

  const excludeTest = new URL(request.url).searchParams.get('excludeTest') === '1'

  const envV2 = isPricingEngineV2EnabledFromEnv()
  const settingsV2 = await isPricingEngineV2Enabled()
  const effectiveV2 = envV2 || settingsV2

  const fiscalSupplier = getFiscalTransitSupplierInfo()
  const fiscalSandbox = isFiscalSandboxEnabled()

  let readyCount = 0
  let readyThb = 0
  const { data: readyRows } = await supabaseAdmin
    .from('bookings')
    .select('id, partner_earnings_thb, listing_id, guest_name, special_requests, renter_id, partner_id')
    .eq('status', 'READY_FOR_PAYOUT')
    .limit(5000)
  for (const r of readyRows || []) {
    if (excludeTest && isFintechTestBookingRow(r)) continue
    readyCount += 1
    readyThb += Number(r.partner_earnings_thb) || 0
  }

  let pendingFiscal = []
  const { data: fiscalPending } = await supabaseAdmin
    .from('bookings')
    .select('id, status, updated_at, metadata')
    .in('status', ['PAID_ESCROW', 'THAWED', 'READY_FOR_PAYOUT', 'COMPLETED'])
    .filter('metadata->fiscal->>status', 'eq', 'PENDING_FISCAL')
    .order('updated_at', { ascending: true })
    .limit(40)

  if (fiscalPending?.length) {
    pendingFiscal = fiscalPending.map((b) => ({
      id: b.id,
      status: b.status,
      updated_at: b.updated_at,
      last_error: b.metadata?.fiscal?.last_error || null,
    }))
  } else {
    const { data: fallback } = await supabaseAdmin
      .from('bookings')
      .select('id, status, updated_at, metadata')
      .in('status', ['PAID_ESCROW', 'THAWED', 'READY_FOR_PAYOUT'])
      .order('updated_at', { ascending: true })
      .limit(200)
    pendingFiscal = (fallback || [])
      .filter((b) => String(b?.metadata?.fiscal?.status || '') === 'PENDING_FISCAL')
      .slice(0, 40)
      .map((b) => ({
        id: b.id,
        status: b.status,
        updated_at: b.updated_at,
        last_error: b.metadata?.fiscal?.last_error || null,
      }))
  }

  let reconciliation = null
  try {
    reconciliation = await LedgerService.runReconciliationMvp()
  } catch (e) {
    reconciliation = { error: e?.message || String(e) }
  }

  const { data: generalRow } = await supabaseAdmin
    .from('system_settings')
    .select('value, updated_at')
    .eq('key', 'general')
    .maybeSingle()

  const readyAlertThb = (() => {
    const fromSettings = Number(generalRow?.value?.fintech_ready_payout_alert_thb)
    if (Number.isFinite(fromSettings) && fromSettings > 0) return fromSettings
    const fromEnv = Number(process.env.FINTECH_READY_PAYOUT_ALERT_THB)
    if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv
    return 100_000
  })()

  const ledgerDriftThb = Math.abs(Number(reconciliation?.deltaThb) || 0)
  const pendingFiscalCount = pendingFiscal.length

  const { data: openBatches } = await supabaseAdmin
    .from('payout_batches')
    .select('id, status, exported_at, scheduled_for, metadata')
    .in('status', ['LOCKED', 'EXPORTED'])
    .order('updated_at', { ascending: false })
    .limit(5)

  const openBatchIds = (openBatches || []).map((b) => b.id)
  let awaitingActsCount = 0
  if (openBatchIds.length) {
    const { count } = await supabaseAdmin
      .from('payout_batch_items')
      .select('id', { count: 'exact', head: true })
      .in('batch_id', openBatchIds)
    awaitingActsCount = count ?? 0
  }

  const { data: lastSettled } = await supabaseAdmin
    .from('payout_batches')
    .select('id, status, settled_at, metadata')
    .eq('status', 'SETTLED')
    .order('settled_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastSettledActs = lastSettled?.metadata?.partner_settlement_documents
    ? Object.keys(lastSettled.metadata.partner_settlement_documents).length
    : 0

  const railsSummary = await loadTreasuryRailsSummary({ excludeTest })

  return NextResponse.json({
    success: true,
    data: {
      pricingEngineV2: {
        effective: effectiveV2,
        envOverride: envV2,
        settingsEnabled: Boolean(
          generalRow?.value?.pricingEngineV2Enabled ||
            generalRow?.value?.pricing_engine_v2_enabled,
        ),
        envVar: process.env.PRICING_ENGINE_V2 || null,
      },
      fiscal: {
        sandbox: fiscalSandbox,
        mode: fiscalSandbox ? 'SANDBOX' : 'PRODUCTION',
        ruAgentInn: fiscalSupplier.inn || '(not set)',
        kgSupplierName: fiscalSupplier.name,
        providerConfigured: Boolean(process.env.FISCAL_PROVIDER_URL),
      },
      payout: {
        readyForPayoutCount: readyCount,
        readyForPayoutThb: Math.round(readyThb * 100) / 100,
      },
      rails: railsSummary.rails,
      awaitingConversion: railsSummary.awaitingConversion,
      treasury: {
        openBatchesCount: (openBatches || []).length,
        awaitingActsLines: awaitingActsCount,
        lastSettledBatch: lastSettled
          ? {
              id: lastSettled.id,
              settledAt: lastSettled.settled_at,
              partnerActsCount: lastSettledActs,
            }
          : null,
      },
      pendingFiscal,
      reconciliation,
      alerts: {
        pendingFiscalCount,
        ledgerDriftThb: Math.round(ledgerDriftThb * 100) / 100,
        readyForPayoutThb: Math.round(readyThb * 100) / 100,
        readyForPayoutAlertThb: readyAlertThb,
        fiscalAlert: pendingFiscalCount > 0,
        driftAlert: ledgerDriftThb > 0.01,
        payoutAlert: readyThb > readyAlertThb,
      },
      settingsUpdatedAt: generalRow?.updated_at || null,
    },
  })
}
