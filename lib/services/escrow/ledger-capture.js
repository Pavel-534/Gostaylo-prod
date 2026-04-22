import LedgerService from '@/lib/services/ledger.service.js'

/**
 * Post capture journal without blocking the payment confirmation path (serverless-friendly).
 * Failures are logged; ops can replay from DB vs ledger reconciliation.
 * @param {object} booking — row as returned after PAID_ESCROW update
 */
export function schedulePostPaymentLedgerCapture(booking) {
  void (async () => {
    try {
      const ledgerRes = await LedgerService.postPaymentCaptureFromBooking(booking)
      if (!ledgerRes.success && !ledgerRes.skipped) {
        console.error('[ESCROW] ledger post failed:', ledgerRes.error)
      }
    } catch (ledgerErr) {
      console.error('[ESCROW] ledger post exception', ledgerErr)
    }
  })()
}
