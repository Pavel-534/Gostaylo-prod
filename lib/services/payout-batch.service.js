/**
 * Mass payout batches (Mon/Thu pools) — Stage 97.0.5 / 109.2 facade (prod payout path).
 *
 * Money flow: THAWED → promoteThawedToReadyForPayout → draft pool → lock → export → treasury markBatchSettled
 * → ledger debit PARTNER_EARNINGS (ledger-settlement.js). Legacy per-booking payout: escrow/payout.service.js (guarded).
 *
 * @see database/migrations/053_financial_model_v2.sql
 * @see lib/services/ledger/ledger-settlement.js
 * @see lib/services/escrow/legacy-payout-guard.js
 */
export { isScheduledPayoutPoolDay } from '@/lib/services/payout-batch/payout-batch-shared.js'

import * as PayoutBatchCreation from '@/lib/services/payout-batch/payout-batch-creation.js'
import * as PayoutBatchExport from '@/lib/services/payout-batch/payout-batch-export.js'
import * as PayoutBatchSettlement from '@/lib/services/payout-batch/payout-batch-settlement.js'

export class PayoutBatchService {
  static promoteThawedToReadyForPayout = PayoutBatchCreation.promoteThawedToReadyForPayout
  static createDraftPoolForToday = PayoutBatchCreation.createDraftPoolForToday
  static listBatches = PayoutBatchCreation.listBatches
  static listBatchesForAdmin = PayoutBatchCreation.listBatchesForAdmin
  static getBatchWithItems = PayoutBatchCreation.getBatchWithItems
  static lockBatch = PayoutBatchCreation.lockBatch
  static exportBatchRegistry = PayoutBatchExport.exportBatchRegistry
  static registryToCsv = PayoutBatchExport.registryToCsv
  static exportBatchesPeriodCsv = PayoutBatchExport.exportBatchesPeriodCsv
  static getBatchSettleBlockers = PayoutBatchSettlement.getBatchSettleBlockers
  static markBatchSettled = PayoutBatchSettlement.markBatchSettled
}

export default PayoutBatchService
