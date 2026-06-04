import { allowMockAcquiringSessions } from '@/lib/payment/payment-production-guard.js'
import { logPaymentAdapterIncident } from '@/lib/services/payment-adapters/adapter-incident-log.js'
import { supabaseAdmin } from '@/lib/supabase'
import {
  createPayment,
  getYookassaConfig,
  resolveIdempotenceKey,
} from '@/lib/payments/yookassa.js'

async function resolveBookingCategorySlug(bookingId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('category_slug')
      .eq('id', bookingId)
      .maybeSingle()
    if (error) {
      console.warn('[MIR_RU] category_slug lookup failed:', error.message)
      return ''
    }
    return String(data?.category_slug || '').trim().toLowerCase()
  } catch (err) {
    console.warn('[MIR_RU] category_slug lookup exception:', err?.message || err)
    return ''
  }
}

/**
 * MIR_RU adapter (YooKassa) — Stage 100.3 RUB charge; Stage 130.2 thin wrapper over lib/payments/yookassa.js.
 *
 * @see lib/services/payment-adapters/acquirer-charge-amount.js
 * @see docs/YOOKASSA_BLUEPRINT_130.1.md
 */
export class MirRuAdapter {
  static key = 'MIR_RU'

  /**
   * Persist idempotence key before PSP call (adapter layer, not transport).
   * @param {string} intentId
   * @param {string} key
   * @param {object} existingMetadata
   */
  static async persistIdempotenceKey(intentId, key, existingMetadata = {}) {
    try {
      const { error } = await supabaseAdmin
        .from('payment_intents')
        .update({
          metadata: {
            ...(existingMetadata && typeof existingMetadata === 'object' ? existingMetadata : {}),
            yookassa_idempotence_key: key,
          },
        })
        .eq('id', intentId)
      if (error) {
        console.error('[MIR_RU] yookassa_idempotence_key persist failed:', error.message)
      }
    } catch (err) {
      console.error('[MIR_RU] yookassa_idempotence_key persist exception:', err?.message || err)
    }
  }

  /**
   * @param {{ intent: object, bookingId: string, charge?: import('./acquirer-charge-amount').ResolvedCharge }} params
   */
  static async createSession({ intent, bookingId, charge }) {
    const { configured } = getYookassaConfig()
    const amountThb = Number(intent?.amountThb || 0)
    const acquirerCurrency = String(charge?.acquirerCurrency || charge?.currency || 'RUB').toUpperCase()
    const acquirerAmount = Number(charge?.acquirerAmount ?? charge?.amount ?? 0)

    const chargeMeta = {
      amount_thb: amountThb,
      acquirer_amount: acquirerAmount,
      acquirer_currency: acquirerCurrency,
      charge_source: charge?.source || null,
      booking_id: bookingId,
    }

    if (!configured) {
      if (allowMockAcquiringSessions()) {
        return {
          provider: 'MIR_RU',
          checkoutUrl: `https://pay.mock.gostaylo/ru/${encodeURIComponent(intent.id)}`,
          externalRef: `mock-mir-${intent.id}`,
          adapterPayload: {
            adapter_key: 'MIR_RU',
            mode: 'mock',
            ...chargeMeta,
          },
        }
      }
      await logPaymentAdapterIncident('MIR_RU', { reason: 'missing_credentials', bookingId })
      return {
        provider: 'MIR_RU',
        checkoutUrl: null,
        externalRef: null,
        adapterPayload: {
          adapter_key: 'MIR_RU',
          mode: 'error',
          error: 'YOOKASSA_NOT_CONFIGURED',
          user_message: 'Платёжный шлюз временно недоступен. Попробуйте позже.',
          ...chargeMeta,
        },
      }
    }

    if (!(acquirerAmount > 0) || acquirerCurrency !== 'RUB') {
      return {
        provider: 'MIR_RU',
        checkoutUrl: null,
        externalRef: null,
        adapterPayload: {
          adapter_key: 'MIR_RU',
          mode: 'error',
          error: 'ACQUIRER_RUB_AMOUNT_UNAVAILABLE',
          ...chargeMeta,
        },
      }
    }

    const { key: idempotenceKey, generated } = resolveIdempotenceKey(intent)
    if (generated) {
      await MirRuAdapter.persistIdempotenceKey(intent.id, idempotenceKey, intent.metadata || {})
    }

    const categorySlug = await resolveBookingCategorySlug(bookingId)

    const result = await createPayment({
      bookingId,
      paymentIntentId: intent.id,
      amountRub: acquirerAmount,
      amountThb,
      idempotenceKey,
      categorySlug,
      metadataExtra: { charge_source: charge?.source || '' },
    })

    if (!result.ok) {
      const providerError =
        result.provider?.description || result.provider?.error || result.code || 'YOOKASSA_API_ERROR'
      await logPaymentAdapterIncident('MIR_RU', {
        reason: 'api_error',
        status: result.httpStatus,
        provider_error: providerError,
        bookingId,
        intentId: intent.id,
      })
      if (allowMockAcquiringSessions()) {
        return {
          provider: 'MIR_RU',
          checkoutUrl: `https://pay.mock.gostaylo/ru/${encodeURIComponent(intent.id)}`,
          externalRef: `fallback-mir-${intent.id}`,
          adapterPayload: {
            adapter_key: 'MIR_RU',
            mode: 'fallback_mock',
            provider_error: providerError,
            yookassa_idempotence_key: idempotenceKey,
            ...chargeMeta,
          },
        }
      }
      return {
        provider: 'MIR_RU',
        checkoutUrl: null,
        externalRef: null,
        adapterPayload: {
          adapter_key: 'MIR_RU',
          mode: 'error',
          error: result.code || 'YOOKASSA_API_ERROR',
          provider_error: providerError,
          user_message: 'Не удалось создать платёж. Попробуйте позже или свяжитесь с поддержкой.',
          yookassa_idempotence_key: idempotenceKey,
          ...chargeMeta,
        },
      }
    }

    return {
      provider: 'MIR_RU',
      checkoutUrl: result.confirmationUrl || null,
      externalRef: result.paymentId || null,
      adapterPayload: {
        adapter_key: 'MIR_RU',
        mode: 'live',
        yookassa_test: result.test === true,
        yookassa_payment_id: result.paymentId || null,
        yookassa_idempotence_key: idempotenceKey,
        ...chargeMeta,
        provider_response: result.raw,
      },
    }
  }
}

export default MirRuAdapter
