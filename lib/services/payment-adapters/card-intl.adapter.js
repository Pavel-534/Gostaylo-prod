import { getSiteDisplayName } from '@/lib/site-url'
import { allowMockAcquiringSessions } from '@/lib/payment/payment-production-guard.js'
import { logPaymentAdapterIncident } from '@/lib/services/payment-adapters/adapter-incident-log.js'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveMandarinIdempotencyKey } from '@/lib/payments/mandarin.js'

/** Stage 200.75 — bound hung Mandarin create-session. */
const MANDARIN_CREATE_TIMEOUT_MS = 10_000

function isFetchAbortError(err) {
  const name = String(err?.name || '')
  return name === 'AbortError' || name === 'TimeoutError'
}

/**
 * CARD_INTL adapter (Mandarin-ready).
 * Stage 100.3: RUB when booking/snapshot is RUB; otherwise THB for international rails.
 * Stage 200.70: stable Idempotency-Key per intent (no randomUUID per attempt).
 */
export class CardIntlAdapter {
  static key = 'CARD_INTL'

  /**
   * @param {string} intentId
   * @param {string} key
   * @param {object} existingMetadata
   */
  static async persistIdempotencyKey(intentId, key, existingMetadata = {}) {
    try {
      const { error } = await supabaseAdmin
        .from('payment_intents')
        .update({
          metadata: {
            ...(existingMetadata && typeof existingMetadata === 'object' ? existingMetadata : {}),
            mandarin_idempotency_key: key,
          },
        })
        .eq('id', intentId)
      if (error) {
        console.error('[CARD_INTL] mandarin_idempotency_key persist failed:', error.message)
      }
    } catch (err) {
      console.error('[CARD_INTL] mandarin_idempotency_key persist exception:', err?.message || err)
    }
  }

  /**
   * @param {{ intent: object, bookingId: string, charge?: object }} params
   */
  static async createSession({ intent, bookingId, charge }) {
    const endpoint = String(process.env.MANDARIN_CARD_INTL_ENDPOINT || '').trim()
    const apiKey = String(process.env.MANDARIN_API_KEY || '').trim()
    const amountThb = Number(intent?.amountThb || 0)
    const acquirerCurrency = String(charge?.acquirerCurrency || charge?.currency || 'THB').toUpperCase()
    const acquirerAmount = Number(charge?.acquirerAmount ?? charge?.amount ?? amountThb)

    const chargeMeta = {
      amount_thb: amountThb,
      acquirer_amount: acquirerAmount,
      acquirer_currency: acquirerCurrency,
      charge_source: charge?.source || null,
      booking_id: bookingId,
    }

    if (!endpoint || !apiKey) {
      if (allowMockAcquiringSessions()) {
        return {
          provider: 'CARD_INTL',
          checkoutUrl: `https://pay.mock.gostaylo/card/${encodeURIComponent(intent.id)}`,
          externalRef: `mock-card-${intent.id}`,
          adapterPayload: {
            adapter_key: 'CARD_INTL',
            mode: 'mock',
            ...chargeMeta,
          },
        }
      }
      await logPaymentAdapterIncident('CARD_INTL', { reason: 'missing_credentials', bookingId })
      return {
        provider: 'CARD_INTL',
        checkoutUrl: null,
        externalRef: null,
        adapterPayload: {
          adapter_key: 'CARD_INTL',
          mode: 'error',
          error: 'MANDARIN_NOT_CONFIGURED',
          user_message: 'Платёжный шлюз временно недоступен. Попробуйте позже.',
          ...chargeMeta,
        },
      }
    }

    const { key: idemKey, generated } = resolveMandarinIdempotencyKey(intent)
    if (generated && intent?.id) {
      await CardIntlAdapter.persistIdempotencyKey(intent.id, idemKey, intent.metadata || {})
    }

    const body = {
      amount: acquirerAmount,
      amount_thb: amountThb,
      booking_id: bookingId,
      payment_intent_id: intent.id,
      currency: acquirerCurrency,
      description: `${getSiteDisplayName()} booking ${bookingId}`,
      metadata: {
        booking_id: bookingId,
        payment_intent_id: intent.id,
        amount_thb: amountThb,
        charge_source: charge?.source || '',
      },
    }
    const res = await (async () => {
      try {
        return await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'Idempotency-Key': idemKey,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(MANDARIN_CREATE_TIMEOUT_MS),
        })
      } catch (err) {
        await logPaymentAdapterIncident('CARD_INTL', {
          reason: isFetchAbortError(err) ? 'timeout' : 'network_error',
          provider_error: err?.message || String(err),
          bookingId,
          intentId: intent.id,
        })
        if (allowMockAcquiringSessions()) {
          return {
            __mockFallback: true,
            session: {
              provider: 'CARD_INTL',
              checkoutUrl: `https://pay.mock.gostaylo/card/${encodeURIComponent(intent.id)}`,
              externalRef: `fallback-card-${intent.id}`,
              adapterPayload: {
                adapter_key: 'CARD_INTL',
                mode: 'fallback_mock',
                provider_error: err?.message || 'timeout',
                mandarin_idempotency_key: idemKey,
                ...chargeMeta,
              },
            },
          }
        }
        return {
          __errorResult: true,
          session: {
            provider: 'CARD_INTL',
            checkoutUrl: null,
            externalRef: null,
            adapterPayload: {
              adapter_key: 'CARD_INTL',
              mode: 'error',
              error: isFetchAbortError(err) ? 'MANDARIN_TIMEOUT' : 'MANDARIN_NETWORK_ERROR',
              provider_error: err?.message || String(err),
              user_message: 'Не удалось создать платёж. Попробуйте позже или свяжитесь с поддержкой.',
              mandarin_idempotency_key: idemKey,
              ...chargeMeta,
            },
          },
        }
      }
    })()
    if (res?.__mockFallback || res?.__errorResult) {
      return res.session
    }
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      const providerError = json?.error || res.statusText
      await logPaymentAdapterIncident('CARD_INTL', {
        reason: 'api_error',
        status: res.status,
        provider_error: providerError,
        bookingId,
        intentId: intent.id,
      })
      if (allowMockAcquiringSessions()) {
        return {
          provider: 'CARD_INTL',
          checkoutUrl: `https://pay.mock.gostaylo/card/${encodeURIComponent(intent.id)}`,
          externalRef: `fallback-card-${intent.id}`,
          adapterPayload: {
            adapter_key: 'CARD_INTL',
            mode: 'fallback_mock',
            provider_error: providerError,
            mandarin_idempotency_key: idemKey,
            ...chargeMeta,
          },
        }
      }
      return {
        provider: 'CARD_INTL',
        checkoutUrl: null,
        externalRef: null,
        adapterPayload: {
          adapter_key: 'CARD_INTL',
          mode: 'error',
          error: 'MANDARIN_API_ERROR',
          provider_error: providerError,
          user_message: 'Не удалось создать платёж. Попробуйте позже или свяжитесь с поддержкой.',
          mandarin_idempotency_key: idemKey,
          ...chargeMeta,
        },
      }
    }

    return {
      provider: 'CARD_INTL',
      checkoutUrl: json?.checkout_url || json?.payment_url || null,
      externalRef: json?.payment_id || json?.id || null,
      adapterPayload: {
        adapter_key: 'CARD_INTL',
        mode: 'live',
        mandarin_idempotency_key: idemKey,
        ...chargeMeta,
        provider_response: json,
      },
    }
  }
}

export default CardIntlAdapter
