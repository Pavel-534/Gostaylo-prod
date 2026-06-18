/**
 * Stage 164 — PostGIS / map spatial health snapshot for admin health dashboard.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { getPostgisSpatialState } from '@/lib/api/postgis-probe'
import { getMapPinsMetricsSnapshot } from '@/lib/geo/map-pins-metrics'
import { MAP_CLUSTER_THRESHOLD } from '@/lib/api/run-map-pins-get'

/**
 * @returns {Promise<object>}
 */
export async function loadSpatialStatsHealth() {
  const postgis = await getPostgisSpatialState()
  const mapPinsMetrics = getMapPinsMetricsSnapshot()

  const out = {
    postgis,
    gistIndexPresent: null,
    activeWithCoordinates: 0,
    activeWithLatLng: 0,
    activeTotal: 0,
    coordinatesCoverageRatio: 0,
    clusterThreshold: MAP_CLUSTER_THRESHOLD,
    mapPinsMetrics,
    error: null,
  }

  if (!supabaseAdmin) {
    out.error = 'no_db'
    return out
  }

  const { data: driftRow, error: driftErr } = await supabaseAdmin.rpc('listings_geo_drift_scan_v1', {
    p_tolerance_m: 5,
    p_sample_limit: 1,
  })

  if (!driftErr && Array.isArray(driftRow) && driftRow[0]) {
    out.gistIndexPresent = Boolean(driftRow[0].gist_index_present)
    out.activeTotal = Number(driftRow[0].scanned_active || 0)
    out.activeWithCoordinates =
      out.activeTotal -
      Number(driftRow[0].coords_null_latlng_set || 0) -
      Number(driftRow[0].latlng_null_coords_set || 0)
    out.activeWithLatLng = out.activeTotal - Number(driftRow[0].latlng_null_coords_set || 0)
  } else if (driftErr) {
    const msg = String(driftErr.message || '')
    if (!/function.*does not exist|could not find the function/i.test(msg)) {
      out.error = msg
    }
    const { data: rows, error: countErr } = await supabaseAdmin
      .from('listings')
      .select('id, latitude, longitude, coordinates')
      .eq('status', 'ACTIVE')
      .limit(5000)
    if (!countErr && Array.isArray(rows)) {
      out.activeTotal = rows.length
      out.activeWithLatLng = rows.filter((r) => r.latitude != null && r.longitude != null).length
      out.activeWithCoordinates = rows.filter((r) => r.coordinates != null).length
    } else if (!out.error) {
      out.error = countErr?.message || msg
    }
  }

  if (out.activeTotal > 0) {
    out.coordinatesCoverageRatio = Number((out.activeWithCoordinates / out.activeTotal).toFixed(3))
  }

  out.postgisIndexHealth =
    postgis.postgisSpatialSearch && out.gistIndexPresent !== false ? 'ok' : 'degraded'

  return out
}
