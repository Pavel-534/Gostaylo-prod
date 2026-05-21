import LedgerService from '@/lib/services/ledger.service.js'

/**
 * @deprecated Not used on payment path since atomic RPC `move_to_escrow_and_post_ledger_v1`.
 * Kept for manual replay scripts / tests. Prefer LedgerService.postPaymentCaptureFromBooking (idempotent).
 *
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
