/**
 * Stage 200.88 — Guest FX charge helpers (cross-currency, incl. pay=THB × base≠THB).
 *
 * Invariants:
 * - Partner netto stays on mid subtotal (never reduced by FX markup).
 * - FX markup is paid by the guest when payment_currency ≠ listing_base_currency.
 * - For non-THB pay: extra is in pay-currency brutto (worse customer rate); THB ledger mid unchanged.
 * - For THB pay × foreign base: extra is real THB in total_guest_brutto; intent/capture must include it.
 */

function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

/**
 * Extra THB charged on top of mid guest payable when brutto is THB (cross-currency THB pay).
 * @param {object | null | undefined} finalBreakdown
 * @returns {number}
 */
export function fxMarkupExtraThbFromFinalBreakdown(finalBreakdown) {
  const fb = finalBreakdown && typeof finalBreakdown === 'object' ? finalBreakdown : null
  if (!fb) return 0
  const brutto = fb.total_guest_brutto
  if (!brutto || typeof brutto !== 'object') return 0
  if (String(brutto.currency || '').toUpperCase() !== 'THB') return 0
  const mid = Math.round(Number(fb.total_guest_payable_rounded_thb) || 0)
  const charge = Math.round(Number(brutto.amount) || 0)
  if (!(charge > mid) || mid <= 0) return 0
  return charge - mid
}

/**
 * THB amount that must balance ledger capture (mid payable + THB FX extra when applicable).
 * @param {object | null | undefined} finalBreakdown
 * @param {object | null | undefined} [feeSplitV2]
 * @returns {number}
 */
export function resolveGuestLedgerTotalThbFromFinalBreakdown(finalBreakdown, feeSplitV2 = null) {
  const fb = finalBreakdown && typeof finalBreakdown === 'object' ? finalBreakdown : {}
  const fs = feeSplitV2 && typeof feeSplitV2 === 'object' ? feeSplitV2 : {}
  let mid = round2(fb.total_guest_payable_rounded_thb ?? fs.guest_payable_rounded_thb ?? 0)
  if (!mid) return 0
  return round2(mid + fxMarkupExtraThbFromFinalBreakdown(fb))
}

/**
 * price_paid / exchange_rate / guestChargeThb for booking insert/patch.
 * Prefers snapshot brutto when currency matches (RUB/USD/… or THB-with-FX).
 *
 * @param {{
 *   paymentCurrency?: string,
 *   roundedGuestTotalThb: number,
 *   exchangeRateToThb: number,
 *   finalBreakdown?: object | null,
 * }} args
 */
export function resolveBookingPricePaidFields({
  paymentCurrency = 'THB',
  roundedGuestTotalThb,
  exchangeRateToThb,
  finalBreakdown = null,
}) {
  const pay = String(paymentCurrency || 'THB').toUpperCase().trim() || 'THB'
  const midRounded = Math.round(Number(roundedGuestTotalThb) || 0)
  const fb = finalBreakdown && typeof finalBreakdown === 'object' ? finalBreakdown : null
  const brutto = fb?.total_guest_brutto

  if (brutto && typeof brutto === 'object') {
    const bruttoCur = String(brutto.currency || '').toUpperCase()
    const bruttoAmt = Number(brutto.amount)
    if (bruttoCur === pay && Number.isFinite(bruttoAmt) && bruttoAmt > 0) {
      if (pay === 'THB') {
        return {
          pricePaid: bruttoAmt,
          exchangeRate: 1,
          guestChargeThb: Math.round(bruttoAmt),
        }
      }
      const rate = Number(exchangeRateToThb)
      const safeRate = Number.isFinite(rate) && rate > 0 ? rate : midRounded / bruttoAmt
      return {
        pricePaid: bruttoAmt,
        exchangeRate: safeRate,
        guestChargeThb: midRounded,
      }
    }
  }

  const rate = Number(exchangeRateToThb)
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 1
  return {
    pricePaid: midRounded / safeRate,
    exchangeRate: safeRate,
    guestChargeThb: midRounded,
  }
}
