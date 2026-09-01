/**
 * Stage 202.25 — inventory + freeze for pre-cutover bookings without fintech_snapshot.
 */
import { FINTECH_CONFIG_DEFAULTS } from '@/lib/config/fintech-config-defaults.js'
import { REFERRAL_GUEST_MARGIN_BOOKING_STATUSES } from '@/lib/booking/status-sets.js'
import { normalizeFintechSettingsRow } from '@/lib/services/finance/system-config.service.js'

export const FINTECH_SNAPSHOT_CUTOVER_ISO = '2026-08-19T00:00:00.000Z'
export const FINTECH_SNAPSHOT_CUTOVER_MS = Date.parse(FINTECH_SNAPSHOT_CUTOVER_ISO)

const SNAPSHOT_VERSION = 1

/** Statuses where missing snapshot can affect accrual / cap / waterfall resolve. */
export const FINTECH_SNAPSHOT_FREEZE_STATUSES = Object.freeze([
  ...REFERRAL_GUEST_MARGIN_BOOKING_STATUSES,
  'CONFIRMED',
  'AWAITING_PAYMENT',
])

/**
 * Canonical frozen policy = owner cutover defaults (2026-08-19).
 * @returns {ReturnType<typeof normalizeFintechSettingsRow>}
 */
export function getFrozenPolicyConfig() {
  return normalizeFintechSettingsRow(FINTECH_CONFIG_DEFAULTS)
}

/** @deprecated use getFrozenPolicyConfig — alias for tests / TZ naming */
export const FROZEN_POLICY_19AUG2026 = getFrozenPolicyConfig()

/**
 * @returns {{ v: 1, frozen: true, captured_at: string, settings_version: number, config: object }}
 */
export function buildFrozenFintechSnapshotPayload() {
  return {
    v: SNAPSHOT_VERSION,
    frozen: true,
    captured_at: FINTECH_SNAPSHOT_CUTOVER_ISO,
    settings_version: 1,
    config: { ...getFrozenPolicyConfig() },
  }
}

function readValidSnapshotFromBooking(booking) {
  const meta = booking?.metadata && typeof booking.metadata === 'object' ? booking.metadata : {}
  const snap = meta.fintech_snapshot
  if (!snap || typeof snap !== 'object') return null
  if (snap.v !== SNAPSHOT_VERSION || !snap.config || typeof snap.config !== 'object') return null
  return snap
}

export function bookingLacksValidFintechSnapshot(booking) {
  return readValidSnapshotFromBooking(booking) == null
}

export function isPreCutoverBooking(booking) {
  const createdAt = booking?.created_at
  if (!createdAt) return false
  const ms = Date.parse(String(createdAt))
  return Number.isFinite(ms) && ms < FINTECH_SNAPSHOT_CUTOVER_MS
}

function classifyBookingWithoutSnapshot(booking) {
  if (!bookingLacksValidFintechSnapshot(booking)) {
    return { bucket: 'has_snapshot', booking }
  }
  if (isPreCutoverBooking(booking)) {
    return { bucket: 'pre_cutover', booking }
  }
  return { bucket: 'post_cutover', booking }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase service_role client
 * @param {{ statuses?: string[], limit?: number }} [opts]
 */
export async function countBookingsWithoutSnapshot(supabase, opts = {}) {
  const statuses = opts.statuses?.length ? opts.statuses : [...FINTECH_SNAPSHOT_FREEZE_STATUSES]
  const limit = Math.max(1, Math.min(Number(opts.limit) || 50_000, 200_000))

  const { data, error } = await supabase
    .from('bookings')
    .select('id, status, created_at, metadata')
    .in('status', statuses)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw new Error(error.message || 'BOOKINGS_INVENTORY_FAILED')

  let withoutSnapshot = 0
  let preCutover = 0
  let postCutover = 0
  const samples = { pre_cutover: [], post_cutover: [] }

  for (const row of data || []) {
    const { bucket } = classifyBookingWithoutSnapshot(row)
    if (bucket === 'has_snapshot') continue
    withoutSnapshot += 1
    if (bucket === 'pre_cutover') {
      preCutover += 1
      if (samples.pre_cutover.length < 5) samples.pre_cutover.push(row)
    } else {
      postCutover += 1
      if (samples.post_cutover.length < 5) samples.post_cutover.push(row)
    }
  }

  return {
    scanned: (data || []).length,
    withoutSnapshot,
    preCutover,
    postCutover,
    samples,
    truncated: (data || []).length >= limit,
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ dryRun?: boolean, batchSize?: number, statuses?: string[] }} [opts]
 */
export async function freezeBookingsWithoutSnapshot(supabase, opts = {}) {
  const dryRun = opts.dryRun !== false
  const batchSize = Math.max(1, Math.min(Number(opts.batchSize) || 100, 500))
  const statuses = opts.statuses?.length ? opts.statuses : [...FINTECH_SNAPSHOT_FREEZE_STATUSES]
  const frozenPayload = buildFrozenFintechSnapshotPayload()

  let cursor = null
  let updated = 0
  let skipped = 0
  let errors = []

  for (;;) {
    let query = supabase
      .from('bookings')
      .select('id, status, created_at, metadata')
      .in('status', statuses)
      .lt('created_at', FINTECH_SNAPSHOT_CUTOVER_ISO)
      .order('created_at', { ascending: true })
      .limit(batchSize)

    if (cursor) query = query.gt('created_at', cursor)

    const { data, error } = await query
    if (error) {
      errors.push({ phase: 'select', message: error.message || 'SELECT_FAILED' })
      break
    }

    const rows = data || []
    if (!rows.length) break

    for (const row of rows) {
      cursor = row.created_at
      if (!bookingLacksValidFintechSnapshot(row)) {
        skipped += 1
        continue
      }
      if (!isPreCutoverBooking(row)) {
        skipped += 1
        continue
      }

      if (dryRun) {
        updated += 1
        continue
      }

      const meta = row.metadata && typeof row.metadata === 'object' ? { ...row.metadata } : {}
      const nextMeta = { ...meta, fintech_snapshot: frozenPayload }
      const { error: updErr } = await supabase
        .from('bookings')
        .update({
          metadata: nextMeta,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)

      if (updErr) {
        errors.push({ bookingId: row.id, message: updErr.message || 'UPDATE_FAILED' })
      } else {
        updated += 1
      }
    }

    if (rows.length < batchSize) break
  }

  return { dryRun, updated, skipped, errors }
}

export default {
  FINTECH_SNAPSHOT_CUTOVER_ISO,
  getFrozenPolicyConfig,
  buildFrozenFintechSnapshotPayload,
  countBookingsWithoutSnapshot,
  freezeBookingsWithoutSnapshot,
}
