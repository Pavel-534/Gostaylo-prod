/**
 * Stage 200.77 — guest-facing invoice checkout lines (chat Special Offer).
 * SSOT total = invoice.amount. Never invent nightly rate or platform commission.
 * Cleaning / deposit only when present on invoice (metadata) and stay + extras = total.
 */

import { calculateNights } from '@/lib/utils/booking-logic.js'

function n(x) {
  const v = Number(x)
  return Number.isFinite(v) ? v : 0
}

function readMeta(invoice) {
  return invoice?.metadata && typeof invoice.metadata === 'object' && !Array.isArray(invoice.metadata)
    ? invoice.metadata
    : {}
}

/**
 * @param {object | null | undefined} invoice
 * @param {object | null | undefined} booking — checkout booking shape (checkIn/checkOut ok)
 * @returns {{
 *   amount: number,
 *   currency: string,
 *   nights: number,
 *   description: string | null,
 *   lines: Array<{ type: 'stay' | 'cleaning' | 'deposit' | 'invoice_total', amount: number, nights?: number }>,
 *   hasDetail: boolean,
 * }}
 */
export function buildInvoiceGuestBreakdown(invoice, booking = null) {
  const meta = readMeta(invoice)
  const amount = n(invoice?.amount)
  const currency = String(invoice?.currency || meta.currency || 'THB').toUpperCase()
  const checkIn = String(
    invoice?.check_in || meta.check_in || booking?.checkIn || booking?.check_in || '',
  ).slice(0, 10)
  const checkOut = String(
    invoice?.check_out || meta.check_out || booking?.checkOut || booking?.check_out || '',
  ).slice(0, 10)
  const nights = calculateNights(checkIn, checkOut) || 0
  const descriptionRaw = invoice?.description ?? meta.description
  const description =
    typeof descriptionRaw === 'string' && descriptionRaw.trim() ? descriptionRaw.trim() : null

  if (!(amount > 0)) {
    return {
      amount: 0,
      currency,
      nights,
      description,
      lines: [],
      hasDetail: false,
    }
  }

  const cleaning = n(invoice?.cleaning_fee ?? meta.cleaning_fee ?? meta.cleaningFee)
  const deposit = n(
    invoice?.security_deposit ?? meta.security_deposit ?? meta.securityDeposit ?? meta.deposit,
  )

  const extras = []
  if (cleaning > 0) extras.push({ type: 'cleaning', amount: cleaning })
  if (deposit > 0) extras.push({ type: 'deposit', amount: deposit })
  const extrasSum = extras.reduce((s, row) => s + row.amount, 0)
  const stayAmount = Math.round((amount - extrasSum) * 100) / 100
  const canSplit =
    extras.length > 0 && stayAmount > 0 && Math.abs(stayAmount + extrasSum - amount) < 0.02

  /** @type {Array<{ type: 'stay' | 'cleaning' | 'deposit' | 'invoice_total', amount: number, nights?: number }>} */
  let lines
  if (canSplit) {
    lines = [
      { type: 'stay', amount: stayAmount, nights: nights > 0 ? nights : undefined },
      ...extras,
    ]
  } else {
    // Lump-sum special offer — one honest stay/total line (no fake nightly rate).
    lines = [
      {
        type: nights > 0 ? 'stay' : 'invoice_total',
        amount,
        nights: nights > 0 ? nights : undefined,
      },
    ]
  }

  return {
    amount,
    currency,
    nights,
    description,
    lines,
    hasDetail: true,
  }
}
