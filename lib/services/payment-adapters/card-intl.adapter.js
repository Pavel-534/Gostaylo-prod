import { randomUUID } from 'crypto'
import { getSiteDisplayName } from '@/lib/site-url'

/**
 * CARD_INTL adapter scaffold (Mandarin-ready).
 * Works in two modes:
 * - Live: when `MANDARIN_CARD_INTL_ENDPOINT` + `MANDARIN_API_KEY` configured.
 * - Mock: deterministic checkout URL fallback for local/dev.
 */
export class CardIntlAdapter {
  static key = 'CARD_INTL'

  static async createSession({ intent, bookingId }) {
    const endpoint = String(process.env.MANDARIN_CARD_INTL_ENDPOINT || '').trim()
    const apiKey = String(process.env.MANDARIN_API_KEY || '').trim()
    const amountThb = Number(intent?.amountThb || 0)

    if (!endpoint || !apiKey) {
      return {
        provider: 'CARD_INTL',
        checkoutUrl: `https://pay.mock.gostaylo/card/${encodeURIComponent(intent.id)}`,
        externalRef: `mock-card-${intent.id}`,
        adapterPayload: {
          adapter_key: 'CARD_INTL',
          mode: 'mock',
          amount_thb: amountThb,
          booking_id: bookingId,
        },
      }
    }

    const body = {
      amount_thb: amountThb,
      booking_id: bookingId,
      payment_intent_id: intent.id,
      currency: 'THB',
      description: `${getSiteDisplayName()} booking ${bookingId}`,
      metadata: {
        booking_id: bookingId,
        payment_intent_id: intent.id,
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
      return {
        provider: 'CARD_INTL',
        checkoutUrl: `https://pay.mock.gostaylo/card/${encodeURIComponent(intent.id)}`,
        externalRef: `fallback-card-${intent.id}`,
        adapterPayload: {
          adapter_key: 'CARD_INTL',
          mode: 'fallback_mock',
          provider_error: json?.error || res.statusText,
          amount_thb: amountThb,
          booking_id: bookingId,
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
        provider_response: json,
      },
    }
  }
}

export default CardIntlAdapter

