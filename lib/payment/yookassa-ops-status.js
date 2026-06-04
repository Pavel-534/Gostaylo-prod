/**
 * Stage 130.4 — YooKassa ops status for FinTech (no secrets).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { getYookassaConfig } from '@/lib/payments/yookassa.js'
import { getPaymentAdaptersHealth } from '@/lib/services/payment-adapters/health.js'
import { getControlledLiveMirGuardSnapshot } from '@/lib/payment/controlled-live-mir-guard.js'

function extractYookassaFieldsFromIntent(row) {
  const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  const payload = meta.provider_payload && typeof meta.provider_payload === 'object' ? meta.provider_payload : {}
  const providerResponse =
    payload.provider_response && typeof payload.provider_response === 'object'
      ? payload.provider_response
      : {}

  return {
    intentId: row?.id || null,
    bookingId: row?.booking_id || null,
    status: row?.status || null,
    externalRef: row?.external_ref || null,
    yookassaPaymentId:
      payload.yookassa_payment_id ||
      providerResponse.id ||
      (String(row?.external_ref || '').length > 8 && !String(row.external_ref).includes('mock')
        ? row.external_ref
        : null),
    yookassaTest:
      payload.yookassa_test === true || providerResponse.test === true ? true : payload.yookassa_test === false ? false : null,
    yookassaIdempotenceKey: meta.yookassa_idempotence_key || payload.yookassa_idempotence_key || null,
    providerMode: payload.mode || null,
    updatedAt: row?.updated_at || null,
  }
}

/**
 * @param {{ recentLimit?: number }} [opts]
 */
export async function loadYookassaOpsStatus(opts = {}) {
  const limit = Math.min(20, Math.max(1, Number(opts.recentLimit) || 8))
  const config = getYookassaConfig()
  const adapters = getPaymentAdaptersHealth()
  const mir = adapters.adapters?.MIR_RU || null
  const controlledLive = await getControlledLiveMirGuardSnapshot()

  let recentIntents = []
  if (supabaseAdmin?.from) {
    const { data, error } = await supabaseAdmin
      .from('payment_intents')
      .select('id, booking_id, status, external_ref, metadata, updated_at, provider')
      .eq('provider', 'MIR_RU')
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (!error && Array.isArray(data)) {
      recentIntents = data.map(extractYookassaFieldsFromIntent)
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    configured: config.configured,
    shopIdPresent: Boolean(config.shopId),
    apiBase: config.apiBase,
    adapterMode: mir?.runtimeMode || (config.configured ? 'LIVE_MODE' : 'MOCK_MODE'),
    missingEnv: mir?.missing || [],
    webhookIpEnforce:
      String(process.env.YOOKASSA_WEBHOOK_ENFORCE_IP || '').trim() === '1' ||
      (String(process.env.VERCEL_ENV || '') === 'production' &&
        String(process.env.YOOKASSA_WEBHOOK_ENFORCE_IP || '').trim() !== '0'),
    controlledLive,
    recentIntents,
  }
}
