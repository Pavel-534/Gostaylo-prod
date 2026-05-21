/**
 * Stage 111.1b — общая аттестация цен для createBooking + createInquiryBooking.
 */

import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'
import { buildFraudBanReplyMarkup } from '@/lib/services/fraud-telegram-ban-button.js'
import { recordCriticalSignal } from '@/lib/critical-telemetry.js'
import {
  MIN_BOOKING_GUEST_TOTAL_THB,
  computeAttestationGuestTotalThb,
  verifyClientGuestTotalAttestation,
} from '@/lib/booking-price-integrity.js'

/**
 * @param {{
 *   path: string,
 *   listingId: string,
 *   renterId: string | null,
 *   serverSubtotalThb: number,
 *   clientQuotedSubtotalThb?: number | null,
 *   required?: boolean,
 * }} args
 */
export function gateClientSubtotalAttestation({
  path,
  listingId,
  renterId,
  serverSubtotalThb,
  clientQuotedSubtotalThb,
  required = true,
}) {
  if (!required) {
    return { ok: true }
  }
  if (clientQuotedSubtotalThb === undefined || clientQuotedSubtotalThb === null) {
    return {
      ok: false,
      error: 'Price attestation required (clientQuotedSubtotalThb)',
      code: 'PRICE_ATTESTATION_REQUIRED',
    }
  }
  const clientSubtotalThb = Math.round(Number(clientQuotedSubtotalThb))
  if (!Number.isFinite(clientSubtotalThb) || serverSubtotalThb !== clientSubtotalThb) {
    const fraudBanMarkup = buildFraudBanReplyMarkup(renterId)
    void notifySystemAlert(
      `[PRICE_TAMPERING] <b>PRICE_MISMATCH</b> ${path} (subtotal)\n` +
        `[FRAUD_DETECTION] ⚠️ <b>ATTEMPTED PRICE MANIPULATION</b>\n` +
        `${path}: клиентская сумма ≠ серверной\n` +
        `listing: <code>${escapeSystemAlertHtml(listingId)}</code>\n` +
        `ожидалось THB: <b>${serverSubtotalThb}</b>, пришло: <b>${escapeSystemAlertHtml(String(clientQuotedSubtotalThb))}</b>\n` +
        `renter: <code>${escapeSystemAlertHtml(renterId || '—')}</code>`,
      fraudBanMarkup ? { reply_markup: fraudBanMarkup } : {},
    )
    recordCriticalSignal('PRICE_TAMPERING', {
      tag: '[FRAUD_DETECTION]',
      banUserId: renterId || null,
      detailLines: [
        `path: ${path}`,
        `listing: ${listingId}`,
        `server THB: ${serverSubtotalThb}`,
        `client THB: ${clientSubtotalThb}`,
        `renter: ${renterId || '—'}`,
      ],
    })
    return { error: 'Price verification failed', code: 'PRICE_MISMATCH' }
  }
  return { ok: true }
}

/**
 * @param {{
 *   path: string,
 *   listingId: string,
 *   renterId: string | null,
 *   clientQuotedGuestTotalThb?: number | null,
 *   guestPayableThb: number,
 *   pricingSnapshot: object,
 *   pricingEngineV2Active: boolean,
 *   precomputedRoundedThb?: number | null,
 *   enforceMinTotal?: boolean,
 * }} args
 */
export function gateClientGuestTotalAttestation({
  path,
  listingId,
  renterId,
  clientQuotedGuestTotalThb,
  guestPayableThb,
  pricingSnapshot,
  pricingEngineV2Active,
  precomputedRoundedThb,
  enforceMinTotal = true,
}) {
  const attestation = computeAttestationGuestTotalThb({
    guestPayableThb,
    pricingSnapshot,
    pricingEngineV2Active,
    precomputedRoundedThb,
  })
  if (!attestation) {
    return { error: 'Invalid price', code: 'PRICE_MISMATCH' }
  }
  const attestationGuestTotalThb = attestation.totalThb

  const guestVerify = verifyClientGuestTotalAttestation(
    clientQuotedGuestTotalThb,
    attestationGuestTotalThb,
  )
  if (!guestVerify.ok) {
    const fraudBanMarkupGuest = buildFraudBanReplyMarkup(renterId)
    void notifySystemAlert(
      `[PRICE_TAMPERING] <b>PRICE_MISMATCH</b> ${path} (guest total / ${attestation.source})\n` +
        `[FRAUD_DETECTION] ⚠️ <b>ATTEMPTED PRICE MANIPULATION</b>\n` +
        `ожидалось итог THB: <b>${attestationGuestTotalThb}</b>, пришло: <b>${escapeSystemAlertHtml(String(clientQuotedGuestTotalThb))}</b>\n` +
        `mode: <code>${escapeSystemAlertHtml(attestation.roundingMode)}</code>\n` +
        `listing: <code>${escapeSystemAlertHtml(listingId)}</code>\n` +
        `renter: <code>${escapeSystemAlertHtml(renterId || '—')}</code>`,
      fraudBanMarkupGuest ? { reply_markup: fraudBanMarkupGuest } : {},
    )
    recordCriticalSignal('PRICE_TAMPERING', {
      tag: '[FRAUD_DETECTION]',
      banUserId: renterId || null,
      detailLines: [
        `path: ${path} guest total`,
        `attestation: ${attestation.source}`,
        `listing: ${listingId}`,
        `server THB: ${attestationGuestTotalThb}`,
        `client THB: ${guestVerify.clientThb}`,
      ],
    })
    return { error: 'Price verification failed', code: 'PRICE_MISMATCH' }
  }

  if (enforceMinTotal && attestationGuestTotalThb < MIN_BOOKING_GUEST_TOTAL_THB) {
    void notifySystemAlert(
      `[SECURITY_ALERT] <b>BOOKING_MIN_TOTAL_THB</b>\n` +
        `path: ${escapeSystemAlertHtml(path)}\n` +
        `listing: <code>${escapeSystemAlertHtml(listingId)}</code>\n` +
        `guest payable THB: <b>${attestationGuestTotalThb}</b> (min <b>${MIN_BOOKING_GUEST_TOTAL_THB}</b>)\n` +
        `renter: <code>${escapeSystemAlertHtml(renterId || '—')}</code>`,
    )
    return {
      error: `Minimum payable total is ${MIN_BOOKING_GUEST_TOTAL_THB} THB (subtotal + service fee).`,
      code: 'BOOKING_MIN_TOTAL_THB',
    }
  }

  return { ok: true, attestation, attestationGuestTotalThb }
}
