/**
 * Stage 162.1 — probe PostGIS column + radius RPC availability (migration-safe degrade).
 */

import { supabaseAdmin } from '@/lib/supabase'

const PROBE_TTL_MS = 5 * 60 * 1000

/** @type {{ hasCoordinatesColumn: boolean | null, hasRadiusRpc: boolean | null, ts: number }} */
let cache = {
  hasCoordinatesColumn: null,
  hasRadiusRpc: null,
  ts: 0,
}

let inflightPromise = null

/**
 * @param {import('@supabase/supabase-js').PostgrestError | null | undefined} error
 */
function isMissingSchemaError(error) {
  if (!error) return false
  const code = String(error.code || '')
  const msg = String(error.message || '')
  return (
    code === '42703' ||
    code === '42883' ||
    code === 'PGRST202' ||
    /column.*does not exist/i.test(msg) ||
    /function.*does not exist/i.test(msg) ||
    /could not find the function/i.test(msg)
  )
}

async function probeCoordinatesColumn() {
  try {
    const { error } = await supabaseAdmin.from('listings').select('coordinates').limit(1)
    if (error) {
      if (isMissingSchemaError(error)) return { value: false, definitive: true }
      return { value: false, definitive: false }
    }
    return { value: true, definitive: true }
  } catch {
    return { value: false, definitive: false }
  }
}

async function probeRadiusRpc() {
  try {
    const { error } = await supabaseAdmin.rpc('listings_ids_within_radius_v1', {
      p_lat: 7.88,
      p_lng: 98.39,
      p_radius_m: 1000,
    })
    if (error) {
      if (isMissingSchemaError(error)) return { value: false, definitive: true }
      return { value: false, definitive: false }
    }
    return { value: true, definitive: true }
  } catch {
    return { value: false, definitive: false }
  }
}

async function refreshProbe() {
  const [coordinates, radiusRpc] = await Promise.all([probeCoordinatesColumn(), probeRadiusRpc()])
  const allDefinitive = coordinates.definitive && radiusRpc.definitive
  cache = {
    hasCoordinatesColumn: coordinates.value,
    hasRadiusRpc: radiusRpc.value,
    ts: allDefinitive ? Date.now() : 0,
  }
  return cache
}

/**
 * @returns {Promise<{ hasCoordinatesColumn: boolean, hasRadiusRpc: boolean, postgisSpatialSearch: boolean }>}
 */
export async function getPostgisSpatialState() {
  const now = Date.now()
  if (cache.hasCoordinatesColumn !== null && now - cache.ts < PROBE_TTL_MS) {
    return {
      hasCoordinatesColumn: cache.hasCoordinatesColumn,
      hasRadiusRpc: cache.hasRadiusRpc,
      postgisSpatialSearch: Boolean(cache.hasCoordinatesColumn && cache.hasRadiusRpc),
    }
  }
  if (inflightPromise) return inflightPromise
  inflightPromise = refreshProbe()
    .then((state) => ({
      hasCoordinatesColumn: state.hasCoordinatesColumn,
      hasRadiusRpc: state.hasRadiusRpc,
      postgisSpatialSearch: Boolean(state.hasCoordinatesColumn && state.hasRadiusRpc),
    }))
    .finally(() => {
      inflightPromise = null
    })
  return inflightPromise
}

export function invalidatePostgisSpatialCache() {
  cache = { hasCoordinatesColumn: null, hasRadiusRpc: null, ts: 0 }
}
