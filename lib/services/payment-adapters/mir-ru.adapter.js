import { randomUUID } from 'crypto'
import { getSiteDisplayName } from '@/lib/site-url'

/**
 * MIR_RU adapter (YooKassa) — Stage 100.3: charge in **RUB** from booking snapshot.
 * Ledger / escrow remain THB via `payment_intents.amount_thb`.
 *
 * @see lib/services/payment-adapters/acquirer-charge-amount.js
 */
export class MirRuAdapter {
  static key = 'MIR_RU'

  /**
   * @param {{ intent: object, bookingId: string, charge?: import('./acquirer-charge-amount').ResolvedCharge }} params
   */
  static async createSession({ intent, bookingId, charge }) {
    const shopId = String(process.env.YOOKASSA_SHOP_ID || '').trim()
    const secret = String(process.env.YOOKASSA_SECRET_KEY || '').trim()
    const endpoint = String(process.env.YOOKASSA_API_URL || 'https://api.yookassa.ru/v3/payments').trim()
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

    if (!shopId || !secret) {
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

    const idemKey = `pi-${intent.id}-${randomUUID()}`
    const basic = Buffer.from(`${shopId}:${secret}`).toString('base64')
    const body = {
      amount: {
        value: acquirerAmount.toFixed(2),
        currency: 'RUB',
      },
      capture: true,
      confirmation: {
        type: 'redirect',
        return_url: process.env.PAYMENT_RETURN_URL || 'https://gostaylo.com/checkout/success',
      },
      description: `${getSiteDisplayName()} booking ${bookingId}`,
      metadata: {
        booking_id: bookingId,
        bookingId,
        payment_intent_id: intent.id,
        paymentIntentId: intent.id,
        amount_thb: String(amountThb),
        charge_source: charge?.source || '',
      },
    }
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${basic}`,
        'Idempotence-Key': idemKey,
      },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        provider: 'MIR_RU',
        checkoutUrl: `https://pay.mock.gostaylo/ru/${encodeURIComponent(intent.id)}`,
        externalRef: `fallback-mir-${intent.id}`,
        adapterPayload: {
          adapter_key: 'MIR_RU',
          mode: 'fallback_mock',
          provider_error: json?.description || json?.error || res.statusText,
          ...chargeMeta,
        },
      }
    }

    return {
      provider: 'MIR_RU',
      checkoutUrl: json?.confirmation?.confirmation_url || null,
      externalRef: json?.id || null,
      adapterPayload: {
        adapter_key: 'MIR_RU',
        mode: 'live',
        ...chargeMeta,
        provider_response: json,
      },
    }
  }
}

export default MirRuAdapter
