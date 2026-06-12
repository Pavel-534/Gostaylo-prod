/**
 * Stage 131.0 — immutable fintech config snapshot on booking (payment lock).
 */
import { supabaseAdmin } from '@/lib/supabase'
import { SystemConfigService } from '@/lib/services/finance/system-config.service.js'

const SNAPSHOT_VERSION = 1

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
 */
export function policyFromFintechSnapshotConfig(snapshotConfig) {
  return { ...snapshotConfig, _source: 'booking_fintech_snapshot' }
}

/**
 * Resolve fintech policy: booking snapshot wins over live DB.
 * @param {object | null | undefined} booking
 */
export async function resolveFintechPolicyForBooking(booking) {
  const snap = readFintechSnapshotFromBooking(booking)
  if (snap?.config) return policyFromFintechSnapshotConfig(snap.config)
  return SystemConfigService.getFintechConfig()
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
  readFintechSnapshotFromBooking,
  policyFromFintechSnapshotConfig,
  resolveFintechPolicyForBooking,
  buildFintechSnapshotPayload,
  attachFintechSnapshotToBooking,
}
