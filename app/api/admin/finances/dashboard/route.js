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

export const dynamic = 'force-dynamic'

async function requireAdminOnly() {
  return requireAccess({ roles: ['ADMIN'] })
}

export async function GET() {
  const gate = await requireAdminOnly()
  if (gate.error) return gate.error

  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'no_db' }, { status: 503 })
  }

  const envV2 = isPricingEngineV2EnabledFromEnv()
  const settingsV2 = await isPricingEngineV2Enabled()
  const effectiveV2 = envV2 || settingsV2

  const fiscalSupplier = getFiscalTransitSupplierInfo()
  const fiscalSandbox = isFiscalSandboxEnabled()

  let readyCount = 0
  let readyThb = 0
  const { data: readyRows } = await supabaseAdmin
    .from('bookings')
    .select('id, partner_earnings_thb')
    .eq('status', 'READY_FOR_PAYOUT')
    .limit(5000)
  for (const r of readyRows || []) {
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
      pendingFiscal,
      reconciliation,
      settingsUpdatedAt: generalRow?.updated_at || null,
    },
  })
}
