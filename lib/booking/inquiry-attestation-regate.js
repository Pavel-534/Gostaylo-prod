/**
 * AUDIT_03 W3.1 — inquiry bookings that skipped client attestation must re-gate at payable.
 */

/**
 * @param {object | null | undefined} booking
 * @returns {boolean}
 */
export function bookingSkippedPriceAttestation(booking) {
  const meta = booking?.metadata && typeof booking.metadata === 'object' ? booking.metadata : {}
  return meta.price_attestation_skipped === true
}

/**
 * Payable path is allowed when attestation was never skipped, or host invoice / sync regate completed.
 * @param {{ booking?: object | null, invoiceId?: string | null }} args
 */
export function assertInquiryAttestationRegateForPayable({ booking, invoiceId = null } = {}) {
  if (!bookingSkippedPriceAttestation(booking)) {
    return { ok: true }
  }
  const meta = booking?.metadata && typeof booking.metadata === 'object' ? booking.metadata : {}
  if (meta.price_attestation_regate_at || meta.chat_invoice_id || invoiceId) {
    return { ok: true }
  }
  return {
    ok: false,
    code: 'ATTESTATION_REGATE_REQUIRED',
    error:
      'This inquiry was created without price attestation. Create a host invoice (or complete special-offer sync) before checkout.',
  }
}

/**
 * Patch applied when chat invoice sync establishes payable SSOT.
 */
export function attestationRegateMetadataPatch(existingMeta = {}) {
  const meta = existingMeta && typeof existingMeta === 'object' ? { ...existingMeta } : {}
  meta.price_attestation_skipped = false
  meta.price_attestation_regate_at = new Date().toISOString()
  meta.price_attestation_regate_source = 'chat_invoice'
  return meta
}
