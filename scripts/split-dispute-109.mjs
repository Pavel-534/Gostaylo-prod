/**
 * Stage 109.2 — extract dispute.service.impl.js into topic modules.
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const src = fs.readFileSync(path.join(root, 'lib/services/dispute/dispute.service.impl.js'), 'utf8')

function findMethodBraceIndex(name) {
  const sigRe = new RegExp(`\\n  static (async )?${name}\\(`, 'm')
  const m = src.match(sigRe)
  if (!m) throw new Error(`missing ${name}`)
  let i = m.index + m[0].length
  let depth = 1
  for (; i < src.length; i++) {
    const ch = src[i]
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth === 0) {
        const tail = src.slice(i)
        const bm = tail.match(/^\)\s*\{/)
        if (!bm) throw new Error(`no body brace for ${name}`)
        return i + bm[0].length - 1
      }
    }
  }
  throw new Error(`unclosed signature for ${name}`)
}

function extractMethodBody(name) {
  const start = findMethodBraceIndex(name)
  let depth = 0
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) return src.slice(start + 1, i).trim()
    }
  }
  throw new Error(`unclosed ${name}`)
}

function wrapAsync(name, body) {
  return `export async function ${name}(${extractParams(name)}) {\n${body}\n}\n`
}

function wrapSync(name, body) {
  return `export function ${name}(${extractParams(name)}) {\n${body}\n}\n`
}

function extractParams(name) {
  const sigRe = new RegExp(`static (?:async )?${name}\\(`, 'm')
  const m = src.match(sigRe)
  if (!m) throw new Error(`missing params ${name}`)
  let i = m.index + m[0].length
  let depth = 1
  for (; i < src.length; i++) {
    const ch = src[i]
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth === 0) return src.slice(m.index + m[0].length, i).trim()
    }
  }
  throw new Error(`unclosed params for ${name}`)
}

function transformBody(body) {
  return body
    .replace(/\bthis\.appendDisputeEvent\b/g, 'appendDisputeEvent')
    .replace(/\bthis\.isTransitionAllowed\b/g, 'isTransitionAllowed')
    .replace(/\bthis\.resolveAdminWorkingStatus\b/g, 'resolveAdminWorkingStatus')
    .replace(/\bDisputeService\.appendDisputeEvent\b/g, 'appendDisputeEvent')
    .replace(/\bDisputeService\.actorRoleForBookingActor\b/g, 'actorRoleForBookingActor')
    .replace(/\bDisputeService\.finalizeDisputePaymentUnfreeze\b/g, 'finalizeDisputePaymentUnfreeze')
}

const resolutionHeader = `/**
 * Stage 109.2 — dispute resolution (unfreeze, notify parties).
 */
import { PushService } from '@/lib/services/push.service'
import { NotificationService } from '@/lib/services/notification.service'
import { getSiteDisplayName } from '@/lib/site-url'
import { trimReason, getProfileSafe } from '@/lib/services/dispute/dispute-shared.js'

`

const updateHeader = `/**
 * Stage 109.2 — dispute updates (events, FSM, evidence, SLA crons).
 */
import { supabaseAdmin } from '@/lib/supabase'
import { NotificationEvents, NotificationService } from '@/lib/services/notification.service'
import {
  ACTIVE_DISPUTE_STATUSES,
  DISPUTE_EVIDENCE_BUCKET,
  DISPUTE_FSM,
  DISPUTE_SLA_HOURS,
  MEDIATION_STATUS,
  SLA_REMINDER_POINTS,
  computeDisputeDeadlineIso,
  extractDisputeEvidenceObjectPaths,
  getProfileSafe,
  trimReason,
} from '@/lib/services/dispute/dispute-shared.js'
import { finalizeDisputePaymentUnfreeze } from '@/lib/services/dispute/dispute-resolution.js'
import { runDisputeOpenedSideEffects } from '@/lib/services/dispute/dispute-notifications.js'

`

const createHeader = `/**
 * Stage 109.2 — create official dispute / mediation flow.
 */
import { supabaseAdmin } from '@/lib/supabase'
import { getSiteDisplayName } from '@/lib/site-url'
import { canOpenOfficialDispute } from '@/lib/disputes/dispute-eligibility'
import { PARTNER_HELP_MEDIATION_MS } from '@/lib/config/partner-mediation'
import {
  ACTIVE_DISPUTE_STATUSES,
  MEDIATION_STATUS,
  RECENT_DISPUTE_COOLDOWN_MS,
  computeDisputeDeadlineIso,
  createDisputeId,
  getConversationIdForBooking,
  resolveCounterparty,
  trimReason,
} from '@/lib/services/dispute/dispute-shared.js'
import {
  appendDisputeEvent,
  actorRoleForBookingActor,
  isTransitionAllowed,
} from '@/lib/services/dispute/dispute-update.js'
import { runDisputeOpenedSideEffects } from '@/lib/services/dispute/dispute-notifications.js'

`

const resolutionNames = ['finalizeDisputePaymentUnfreeze', 'notifyPartiesDisputeResolved']
const updateNames = [
  'appendDisputeEvent',
  'actorRoleForBookingActor',
  'isTransitionAllowed',
  'resolveAdminWorkingStatus',
  'getEvidenceSignedUrls',
  'getFrozenBookingIdSet',
  'processSlaBreaches',
  'processStaleMediationDisputes',
]
const createNames = ['createOfficialDispute']

let resolution = resolutionHeader
for (const n of resolutionNames) {
  const async = src.includes(`static async ${n}`)
  const body = transformBody(extractMethodBody(n))
  resolution += async ? wrapAsync(n, body) : wrapSync(n, body)
  resolution += '\n'
}

let update = updateHeader
for (const n of updateNames) {
  const async = src.includes(`static async ${n}`)
  const body = transformBody(extractMethodBody(n))
  update += async ? wrapAsync(n, body) : wrapSync(n, body)
  update += '\n'
}

let create = createHeader
for (const n of createNames) {
  const body = transformBody(extractMethodBody(n))
  create += wrapAsync(n, body) + '\n'
}

fs.writeFileSync(path.join(root, 'lib/services/dispute/dispute-resolution.js'), resolution)
fs.writeFileSync(path.join(root, 'lib/services/dispute/dispute-update.js'), update)
fs.writeFileSync(path.join(root, 'lib/services/dispute/dispute-create.service.js'), create)

const facade = `/**
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
`

fs.writeFileSync(path.join(root, 'lib/services/dispute.service.js'), facade)
fs.unlinkSync(path.join(root, 'lib/services/dispute/dispute.service.impl.js'))

console.log('dispute split OK')
