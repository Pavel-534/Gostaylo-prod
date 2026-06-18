/**
 * Stage 164 — Geo drift detector: coordinates vs lat/lng, stale rows, unverified geo, privacy risks.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { recordCriticalSignal } from '@/lib/critical-telemetry.js'
import { countRemainingUnverifiedLocations } from '@/lib/services/batch-location-normalize.service'

const DEFAULT_TOLERANCE_M = 5
const DEFAULT_SAMPLE_LIMIT = 24

const UNVERIFIED_ALERT_THRESHOLD = 200
const CLUSTER_PRIVACY_ALERT_THRESHOLD = 1

function emitGeoCriticalSignal(key, detailLines, persistDetail) {
  recordCriticalSignal(key, {
    severity: 'CRITICAL',
    tag: '[GEO_OPS][CRITICAL]',
    threshold: 1,
    windowMs: 60 * 60 * 1000,
    detailLines,
    persistDetail,
  })
}

/** @type {{ last_run_at: string | null, last_summary: object | null }} */
let lastRunSnapshot = { last_run_at: null, last_summary: null }

export function getGeoDriftLastRunSnapshot() {
  return lastRunSnapshot
}

/**
 * @param {import('@supabase/supabase-js').PostgrestError | null | undefined} error
 */
function isMissingRpcError(error) {
  if (!error) return false
  const msg = String(error.message || '')
  return (
    /function.*does not exist/i.test(msg) ||
    /could not find the function/i.test(msg) ||
    String(error.code || '') === '42883'
  )
}

/**
 * @param {object} [opts]
 * @param {number} [opts.toleranceM]
 * @param {number} [opts.sampleLimit]
 * @param {boolean} [opts.emitSignals]
 * @param {number | null} [opts.clusterPrivacyRatio]
 */
export async function runGeoDriftScan(opts = {}) {
  const toleranceM = Number.isFinite(opts.toleranceM) ? opts.toleranceM : DEFAULT_TOLERANCE_M
  const sampleLimit = Number.isFinite(opts.sampleLimit) ? opts.sampleLimit : DEFAULT_SAMPLE_LIMIT
  const emitSignals = opts.emitSignals !== false

  const summary = {
    ok: true,
    scannedAt: new Date().toISOString(),
    toleranceM,
    rpcAvailable: false,
    remainingUnverifiedLocations: 0,
    coordLatlngMismatch: 0,
    coordsNullLatlngSet: 0,
    latlngNullCoordsSet: 0,
    unverifiedActive: 0,
    privacyAddressExposed: 0,
    gistIndexPresent: null,
    clusterPrivacyRatio: opts.clusterPrivacyRatio ?? null,
    sampleMismatchIds: [],
    sampleStaleIds: [],
    samplePrivacyIds: [],
    alertsSent: [],
    error: null,
  }

  if (!supabaseAdmin) {
    summary.ok = false
    summary.error = 'no_db'
    return summary
  }

  summary.remainingUnverifiedLocations = await countRemainingUnverifiedLocations()

  const { data, error } = await supabaseAdmin.rpc('listings_geo_drift_scan_v1', {
    p_tolerance_m: toleranceM,
    p_sample_limit: sampleLimit,
  })

  if (error) {
    if (isMissingRpcError(error)) {
      summary.error = 'rpc_missing:apply migrations/stage164_0_geo_ops_health.sql'
      summary.ok = false
    } else {
      summary.ok = false
      summary.error = error.message
    }
    lastRunSnapshot = { last_run_at: summary.scannedAt, last_summary: summary }
    return summary
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row) {
    summary.ok = false
    summary.error = 'empty_rpc_result'
    lastRunSnapshot = { last_run_at: summary.scannedAt, last_summary: summary }
    return summary
  }

  summary.rpcAvailable = true
  summary.coordLatlngMismatch = Number(row.coord_latlng_mismatch || 0)
  summary.coordsNullLatlngSet = Number(row.coords_null_latlng_set || 0)
  summary.latlngNullCoordsSet = Number(row.latlng_null_coords_set || 0)
  summary.unverifiedActive = Number(row.unverified_active || 0)
  summary.privacyAddressExposed = Number(row.privacy_address_exposed || 0)
  summary.gistIndexPresent = row.gist_index_present != null ? Boolean(row.gist_index_present) : null
  summary.sampleMismatchIds = Array.isArray(row.sample_mismatch_ids)
    ? row.sample_mismatch_ids.map(String)
    : []
  summary.sampleStaleIds = Array.isArray(row.sample_stale_ids) ? row.sample_stale_ids.map(String) : []
  summary.samplePrivacyIds = Array.isArray(row.sample_privacy_ids)
    ? row.sample_privacy_ids.map(String)
    : []

  if (emitSignals) {
    const coordinateIssues =
      summary.coordLatlngMismatch +
      summary.coordsNullLatlngSet +
      summary.latlngNullCoordsSet

    if (coordinateIssues >= 1) {
      emitGeoCriticalSignal(
        'GEO_COORDINATE_MISMATCH',
        [
          `mismatch=${summary.coordLatlngMismatch}`,
          `stale_coords=${summary.coordsNullLatlngSet}`,
          `stale_latlng=${summary.latlngNullCoordsSet}`,
          `sample=${summary.sampleMismatchIds.slice(0, 5).join(',') || summary.sampleStaleIds.slice(0, 5).join(',')}`,
          'Action: verify sync_listing_coordinates_from_latlng trigger; backfill coordinates',
        ],
        {
          mismatch: summary.coordLatlngMismatch,
          staleCoords: summary.coordsNullLatlngSet,
          staleLatlng: summary.latlngNullCoordsSet,
          sampleMismatchIds: summary.sampleMismatchIds.slice(0, 12),
          sampleStaleIds: summary.sampleStaleIds.slice(0, 12),
        },
      )
      summary.alertsSent.push('GEO_COORDINATE_MISMATCH')
    }

    if (summary.privacyAddressExposed >= 1) {
      emitGeoCriticalSignal(
        'GEO_PRIVACY_VIOLATION',
        [
          `exposed=${summary.privacyAddressExposed}`,
          `sample=${summary.samplePrivacyIds.slice(0, 5).join(',')}`,
          'Action: strip address on privacy verticals or move to reveal-only path',
        ],
        {
          count: summary.privacyAddressExposed,
          samplePrivacyIds: summary.samplePrivacyIds.slice(0, 12),
        },
      )
      summary.alertsSent.push('GEO_PRIVACY_VIOLATION')
    }

    if (summary.remainingUnverifiedLocations >= UNVERIFIED_ALERT_THRESHOLD) {
      recordCriticalSignal('REMAINING_UNVERIFIED_LOCATIONS', {
        tag: '[GEO_OPS]',
        threshold: 1,
        windowMs: 6 * 60 * 60 * 1000,
        detailLines: [
          `count=${summary.remainingUnverifiedLocations}`,
          'Action: cron /api/v2/cron/normalize-locations; admin /admin/locations/suggestions',
        ],
        persistDetail: { count: summary.remainingUnverifiedLocations },
      })
      summary.alertsSent.push('REMAINING_UNVERIFIED_LOCATIONS')
    }

    if (summary.gistIndexPresent === false) {
      recordCriticalSignal('POSTGIS_INDEX_HEALTH', {
        tag: '[GEO_OPS]',
        threshold: 1,
        windowMs: 6 * 60 * 60 * 1000,
        detailLines: ['idx_listings_coordinates missing', 'Action: apply stage162_1_postgis.sql'],
        persistDetail: { gistIndexPresent: false },
      })
      summary.alertsSent.push('POSTGIS_INDEX_HEALTH')
    }

    const clusterRatio = summary.clusterPrivacyRatio
    if (
      clusterRatio != null &&
      clusterRatio < CLUSTER_PRIVACY_ALERT_THRESHOLD &&
      Number.isFinite(clusterRatio)
    ) {
      recordCriticalSignal('CLUSTER_PRIVACY_RATIO', {
        tag: '[GEO_OPS]',
        threshold: 1,
        windowMs: 30 * 60 * 1000,
        detailLines: [
          `ratio=${clusterRatio}`,
          'Cluster responses without isApproximate — check listings_map_clusters_grid_v1 / map-pins',
        ],
        persistDetail: { clusterPrivacyRatio: clusterRatio },
      })
      summary.alertsSent.push('CLUSTER_PRIVACY_RATIO')
    }
  }

  lastRunSnapshot = { last_run_at: summary.scannedAt, last_summary: summary }
  return summary
}

/** Stage 165 — alias for ops/cron callers */
export async function runFullAudit(opts = {}) {
  return runGeoDriftScan(opts)
}
