/**
 * Stage 211.2 — period pack math (no escrow, no ledger).
 * Booking money is summed elsewhere via booking-financial-read-model.
 * Payout cash uses the same PAID/COMPLETED + gross_amount fallback as partner stats.
 */

export const SETTLED_PAYOUT_STATUSES = Object.freeze(['PAID', 'COMPLETED'])

export function utcPeriodBounds(fromYmd, toYmd) {
  return {
    fromIso: `${fromYmd}T00:00:00.000Z`,
    toIso: `${toYmd}T23:59:59.999Z`,
  }
}

export function isTimestampInPeriod(raw, fromIso, toIso) {
  if (!raw) return false
  const t = Date.parse(String(raw))
  if (!Number.isFinite(t)) return false
  const from = Date.parse(fromIso)
  const to = Date.parse(toIso)
  return t >= from && t <= to
}

/** Stats / statement SSOT: gross_amount → final_amount → amount. */
export function settledPayoutAmountThb(row) {
  const g = parseFloat(row?.gross_amount)
  if (Number.isFinite(g) && g !== 0) return g
  const f = parseFloat(row?.final_amount)
  if (Number.isFinite(f) && f !== 0) return f
  const a = parseFloat(row?.amount)
  return Number.isFinite(a) ? a : 0
}

export function payoutSettledAt(row) {
  return row?.processed_at || row?.created_at || null
}

export function isSettledPayoutStatus(status) {
  return SETTLED_PAYOUT_STATUSES.includes(String(status || '').trim().toUpperCase())
}

/**
 * @param {object[]} payouts
 * @param {string} fromIso
 * @param {string} toIso
 * @returns {{ totalPaidOutThb: number, payoutCount: number }}
 */
export function sumSettledPayoutsInPeriod(payouts, fromIso, toIso) {
  let totalPaidOutThb = 0
  let payoutCount = 0
  for (const row of payouts || []) {
    if (!isSettledPayoutStatus(row?.status)) continue
    if (!isTimestampInPeriod(payoutSettledAt(row), fromIso, toIso)) continue
    totalPaidOutThb += settledPayoutAmountThb(row)
    payoutCount += 1
  }
  return {
    totalPaidOutThb: Math.round(totalPaidOutThb * 100) / 100,
    payoutCount,
  }
}

/**
 * @param {object[]} docs listPartnerSettlementDocuments rows
 */
export function filterSettlementDocumentsByPeriod(docs, fromIso, toIso) {
  return (docs || []).filter((row) => isTimestampInPeriod(row?.generatedAt, fromIso, toIso))
}

/**
 * @param {{ gross?: number, fee?: number, net?: number }[]} snaps
 */
export function sumPeriodSnapshotTotals(snaps) {
  let totalGrossThb = 0
  let totalCommissionThb = 0
  let totalNetEarnedThb = 0
  let bookingCount = 0
  for (const snap of snaps || []) {
    if (!snap) continue
    totalGrossThb += Number(snap.gross) || 0
    totalCommissionThb += Number(snap.fee) || 0
    totalNetEarnedThb += Number(snap.net) || 0
    bookingCount += 1
  }
  return {
    totalGrossThb: Math.round(totalGrossThb * 100) / 100,
    totalCommissionThb: Math.round(totalCommissionThb * 100) / 100,
    totalNetEarnedThb: Math.round(totalNetEarnedThb * 100) / 100,
    bookingCount,
  }
}
