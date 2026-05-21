/**
 * Double-entry ledger (THB) — Stage 110.3 thin facade.
 *
 * Money flow (prod):
 * 1. Guest pays → EscrowService.moveToEscrow (PAID_ESCROW) → postPaymentCaptureFromBooking
 * 2. Thaw / READY_FOR_PAYOUT → PayoutBatchService.markBatchSettled → postPartnerBatchBookingPayoutSettled
 * 3. Cancel (escrow) → postPartialRefundForBooking
 * 4. Dispute → ledger/dispute-hold.js (hold / release)
 *
 * @see lib/services/ledger/ledger-capture-legs.js — leg math SSOT
 * @see lib/services/escrow/ledger-capture.js — async schedule from escrow
 */

export {
  computeBookingPaymentLedgerLegs,
  scaleLedgerLegsToGuestTotal,
} from '@/lib/services/ledger/ledger-capture-legs.js'

export {
  postDisputePartnerFundsHold,
  postDisputePartnerFundsRelease,
} from '@/lib/services/ledger/ledger-dispute.js'

import { partnerAccountId, ensurePartnerLedgerAccount } from '@/lib/services/ledger/ledger-accounts.js'
import { postPaymentCaptureFromBooking } from '@/lib/services/ledger/ledger-payment-capture.js'
import {
  postPartnerPayoutObligationSettled,
  postPartnerBatchBookingPayoutSettled,
} from '@/lib/services/ledger/ledger-settlement.js'
import { postPartialRefundForBooking } from '@/lib/services/ledger/ledger-refund.js'
import {
  sumPartnerPayoutDebitsThb,
  sumNetBalancesByAccountIds,
} from '@/lib/services/ledger/ledger-balance.js'
import { runReconciliationMvp } from '@/lib/services/ledger/ledger-reconciliation.js'

export class LedgerService {
  static partnerAccountId(partnerId) {
    return partnerAccountId(partnerId)
  }

  static ensurePartnerLedgerAccount(partnerId) {
    return ensurePartnerLedgerAccount(partnerId)
  }

  static postPaymentCaptureFromBooking(booking) {
    return postPaymentCaptureFromBooking(booking)
  }

  static postPartnerPayoutObligationSettled(payout) {
    return postPartnerPayoutObligationSettled(payout)
  }

  static postPartnerBatchBookingPayoutSettled(args) {
    return postPartnerBatchBookingPayoutSettled(args)
  }

  static postPartialRefundForBooking(booking, options) {
    return postPartialRefundForBooking(booking, options)
  }

  static sumPartnerPayoutDebitsThb(partnerId) {
    return sumPartnerPayoutDebitsThb(partnerId)
  }

  static sumNetBalancesByAccountIds(accountIds) {
    return sumNetBalancesByAccountIds(accountIds)
  }

  static runReconciliationMvp() {
    return runReconciliationMvp()
  }
}

export default LedgerService
