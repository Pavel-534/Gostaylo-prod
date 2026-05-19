import { randomUUID } from 'crypto'
import { getSiteDisplayName } from '@/lib/site-url'
import { allowMockAcquiringSessions } from '@/lib/payment/payment-production-guard.js'
import { logPaymentAdapterIncident } from '@/lib/services/payment-adapters/adapter-incident-log.js'

/**
 * CARD_INTL adapter (Mandarin-ready).
 * Stage 100.3: RUB when booking/snapshot is RUB; otherwise THB for international rails.
 */
export class CardIntlAdapter {
  static key = 'CARD_INTL'

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
    const idemKey = `pi-${intent.id}-${randomUUID()}`
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Idempotency-Key': idemKey,
      },
      body: JSON.stringify(body),
    })
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
        ...chargeMeta,
        provider_response: json,
      },
    }
  }
}

export default CardIntlAdapter
