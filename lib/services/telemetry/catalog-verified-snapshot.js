/**
 * Stage 89.0 — персистентная телеметрия **`catalog_verified_majority`** (SSR поиск каталога).
 * Таблица: **`catalog_verified_snapshots`** (**`database/migrations/046_catalog_verified_snapshots.sql`**).
 */

import { supabaseAdmin } from '@/lib/supabase'

/**
 * @param {{
 *   verifiedShareApprox: number,
 *   verifiedCount: number,
 *   resultCount: number,
 *   category?: string | null,
 *   whereHint?: string | null,
 *   mapBoundsFiltered?: boolean,
 *   semanticBlend?: boolean,
 *   payloadProfile?: string | null,
 * }} payload
 */
export async function insertCatalogVerifiedMajoritySnapshot(payload) {
  if (!supabaseAdmin) return
  const row = {
    verified_share_approx: payload.verifiedShareApprox,
    verified_count: payload.verifiedCount,
    result_count: payload.resultCount,
    category: payload.category ?? null,
    where_hint: payload.whereHint ?? null,
    map_bounds_filtered: !!payload.mapBoundsFiltered,
    semantic_blend: !!payload.semanticBlend,
    payload_profile: payload.payloadProfile ?? null,
  }
  try {
    const { error } = await supabaseAdmin.from('catalog_verified_snapshots').insert(row)
    if (error) {
      console.warn('[telemetry] catalog_verified_snapshots insert failed', error.message)
    }
  } catch (e) {
    console.warn('[telemetry] catalog_verified_snapshots', e?.message || e)
  }
}
