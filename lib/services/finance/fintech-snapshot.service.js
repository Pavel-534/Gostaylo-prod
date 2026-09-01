/**
 * Stage 131.0 — immutable fintech config snapshot on booking (payment lock).
 * Stage 202.25 — frozen pre-cutover path + fail-closed for post-cutover without snapshot.
 */
import { SystemConfigService } from '@/lib/services/finance/system-config.service.js'
import { supabaseAdmin } from '@/lib/supabase'
import {
  FINTECH_SNAPSHOT_CUTOVER_MS,
  getFrozenPolicyConfig,
} from '@/lib/services/finance/fintech-snapshot-freeze.service.js'

const SNAPSHOT_VERSION = 1

export class FinSnapshotMissingError extends Error {
  constructor(bookingId) {
    super('FIN_SNAPSHOT_MISSING_FOR_NEW_BOOKING')
    this.name = 'FinSnapshotMissingError'
    this.code = 'FIN_SNAPSHOT_MISSING_FOR_NEW_BOOKING'
    this.bookingId = bookingId ? String(bookingId) : null
  }
}

/**
 * @param {object | null | undefined} booking
 */
export function readFintechSnapshotFromBooking(booking) {
  const meta = booking?.metadata && typeof booking.metadata === 'object' ? booking.metadata : {}
  const snap = meta.fintech_snapshot
  if (!snap || typeof snap !== 'object') return null
  if (snap.v !== SNAPSHOT_VERSION || !snap.config || typeof snap.config !== 'object') return null
  return snap
}

/**
 * Policy object compatible with ReferralPolicyService + getReferralSettings merge.
 * @param {object} snapshotConfig normalized camelCase config from snapshot
 * @param {string} [source]
 */
export function policyFromFintechSnapshotConfig(snapshotConfig, source = 'booking_fintech_snapshot') {
  return { ...snapshotConfig, _source: source }
}

function isPreCutoverBooking(booking) {
  const createdAt = booking?.created_at
  if (!createdAt) return false
  const ms = Date.parse(String(createdAt))
  return Number.isFinite(ms) && ms < FINTECH_SNAPSHOT_CUTOVER_MS
}

/**
 * Resolve fintech policy: booking snapshot wins; pre-cutover without snapshot → frozen canon;
 * post-cutover without snapshot → fail-closed. No booking → live DB (global stats/promo).
 * @param {object | null | undefined} booking
 */
export async function resolveFintechPolicyForBooking(booking) {
  if (!booking) {
    return SystemConfigService.getFintechConfig()
  }

  const snap = readFintechSnapshotFromBooking(booking)
  if (snap?.config) {
    const source = snap.frozen === true ? 'snapshot_frozen' : 'snapshot'
    return policyFromFintechSnapshotConfig(snap.config, source)
  }

  if (isPreCutoverBooking(booking)) {
    return policyFromFintechSnapshotConfig(getFrozenPolicyConfig(), 'frozen_default_pre_cutover')
  }

  throw new FinSnapshotMissingError(booking?.id)
}

/**
 * Capture current global fintech settings for persistence on booking.
 */
export async function buildFintechSnapshotPayload() {
  const config = await SystemConfigService.getFintechConfig({ bypassCache: true })
  return {
    v: SNAPSHOT_VERSION,
    captured_at: new Date().toISOString(),
    settings_version: config.version,
    config: { ...config },
  }
}

/**
 * Attach snapshot at payment initiation (idempotent — never overwrite existing).
 * @param {string} bookingId
 * @param {object} [existingMetadata]
 */
export async function attachFintechSnapshotToBooking(bookingId, existingMetadata = {}) {
  const id = String(bookingId || '').trim()
  if (!id) return { attached: false, reason: 'BOOKING_ID_REQUIRED' }

  const meta =
    existingMetadata && typeof existingMetadata === 'object' ? { ...existingMetadata } : {}
  if (meta.fintech_snapshot?.config) {
    return { attached: false, reason: 'ALREADY_CAPTURED', snapshot: meta.fintech_snapshot }
  }

  const snapshot = await buildFintechSnapshotPayload()
  const nextMeta = { ...meta, fintech_snapshot: snapshot }

  const { error } = await supabaseAdmin
    .from('bookings')
    .update({
      metadata: nextMeta,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { attached: false, reason: error.message || 'UPDATE_FAILED' }
  return { attached: true, snapshot }
}

export default {
  FinSnapshotMissingError,
  readFintechSnapshotFromBooking,
  policyFromFintechSnapshotConfig,
  resolveFintechPolicyForBooking,
  buildFintechSnapshotPayload,
  attachFintechSnapshotToBooking,
}
