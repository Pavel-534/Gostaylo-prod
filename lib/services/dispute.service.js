/**
 * Stage 109.2 — dispute service facade (implementation in topic modules).
 */
export {
  extractDisputeEvidenceObjectPaths,
  ACTIVE_DISPUTE_STATUSES,
  DISPUTE_FSM,
  DISPUTE_EVIDENCE_BUCKET,
  MEDIATION_STATUS,
} from '@/lib/services/dispute/dispute-shared.js'

export { runDisputeOpenedSideEffects } from '@/lib/services/dispute/dispute-notifications.js'

import * as DisputeResolution from '@/lib/services/dispute/dispute-resolution.js'
import * as DisputeUpdate from '@/lib/services/dispute/dispute-update.js'
import * as DisputeCreate from '@/lib/services/dispute/dispute-create.service.js'
import {
  ACTIVE_DISPUTE_STATUSES as ACTIVE,
  DISPUTE_FSM as FSM,
} from '@/lib/services/dispute/dispute-shared.js'

export class DisputeService {
  static ACTIVE_DISPUTE_STATUSES = ACTIVE
  static DISPUTE_FSM = FSM

  static finalizeDisputePaymentUnfreeze = DisputeResolution.finalizeDisputePaymentUnfreeze
  static notifyPartiesDisputeResolved = DisputeResolution.notifyPartiesDisputeResolved
  static appendDisputeEvent = DisputeUpdate.appendDisputeEvent
  static actorRoleForBookingActor = DisputeUpdate.actorRoleForBookingActor
  static isTransitionAllowed = DisputeUpdate.isTransitionAllowed
  static resolveAdminWorkingStatus = DisputeUpdate.resolveAdminWorkingStatus
  static getEvidenceSignedUrls = DisputeUpdate.getEvidenceSignedUrls
  static getFrozenBookingIdSet = DisputeUpdate.getFrozenBookingIdSet
  static createOfficialDispute = DisputeCreate.createOfficialDispute
  static processSlaBreaches = DisputeUpdate.processSlaBreaches
  static processStaleMediationDisputes = DisputeUpdate.processStaleMediationDisputes
}

export default DisputeService
