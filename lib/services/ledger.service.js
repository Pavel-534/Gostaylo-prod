/**
 * Double-entry ledger (THB) — Stage 110.3 thin facade.
 *
 * Money flow (prod):
 * 1. Guest pays → EscrowService.moveToEscrow → SQL RPC posts BOOKING_PAYMENT_CAPTURED (atomic with PAID_ESCROW)
 * 2. Ops replay / reconcile → postPaymentCaptureFromBooking (idempotent; skips if RPC already posted)
 * 3. Treasury batch paid → PayoutBatchService.markBatchSettled → postPartnerBatchBookingPayoutSettled
 * 4. Cancel (escrow) → postPartialRefundForBooking
 * 5. Dispute → ledger-dispute.js → dispute-hold.js
 *
 * Modules (import facade or subpaths; behavior unchanged):
 * - ledger-capture-legs.js — leg math from pricing_snapshot / booking row
 * - ledger-payment-capture.js — BOOKING_PAYMENT_CAPTURED
 * - ledger-settlement.js — partner payout obligation + batch settle
 * - ledger-refund.js — partial refund journals
 * - ledger-balance.js — net balances by account
 * - ledger-reconciliation.js — MVP margin / clearing check
 * - ledger-dispute.js — hold / release partner earnings
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
