/**
 * Stage 186.0 — human-readable ledger row labels (i18n via getUIText keys).
 */

const EVENT_TYPE_KEYS = {
  BOOKING_PAYMENT_CAPTURED: 'partnerLedger_eventBookingPaymentCaptured',
  BOOKING_REFUND_PARTIAL: 'partnerLedger_eventBookingRefundPartial',
  BOOKING_REFUND_FULL: 'partnerLedger_eventBookingRefundFull',
  PARTNER_PAYOUT_OBLIGATION_SETTLED: 'partnerLedger_eventPayoutSettled',
  PARTNER_PAYOUT_BATCH_SETTLED: 'partnerLedger_eventPayoutBatchSettled',
  ESCROW_THAW: 'partnerLedger_eventEscrowThaw',
}

const DESCRIPTION_KEYS = {
  'Partner earnings': 'partnerLedger_descPartnerEarnings',
  'Partner earnings (payable)': 'partnerLedger_descPartnerEarningsPayable',
  'Partner earnings — payout settled': 'partnerLedger_descPayoutSettled',
  'Partner earnings — batch payout settled': 'partnerLedger_descPayoutBatchSettled',
}

/**
 * @param {string | null | undefined} eventType
 * @param {(key: string) => string} t
 */
export function mapLedgerEventType(eventType, t) {
  const raw = String(eventType || '').trim()
  if (!raw) return '—'
  const key = EVENT_TYPE_KEYS[raw.toUpperCase()]
  if (key) return t(key)
  return raw.replace(/_/g, ' ')
}

/**
 * @param {string | null | undefined} side
 * @param {(key: string) => string} t
 */
export function mapLedgerSide(side, t) {
  const s = String(side || '').trim().toUpperCase()
  if (s === 'CREDIT') return t('partnerLedger_sideCredit')
  if (s === 'DEBIT') return t('partnerLedger_sideDebit')
  return side || '—'
}

/**
 * @param {string | null | undefined} description
 * @param {(key: string) => string} t
 */
export function mapLedgerDescription(description, t) {
  const d = String(description || '').trim()
  if (!d) return null
  const key = DESCRIPTION_KEYS[d]
  return key ? t(key) : d
}
