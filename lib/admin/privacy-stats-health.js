/**
 * Stage 164 — coordinate privacy health snapshot (policy distribution + runtime fuzz/reveal).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { resolveCoordinatePrivacyPolicy } from '@/lib/geo/listing-public-coordinates'
import { getCoordinatePrivacyMetricsSnapshot } from '@/lib/geo/coordinate-privacy-metrics'

/**
 * @returns {Promise<object>}
 */
export async function loadPrivacyStatsHealth() {
  const runtime = getCoordinatePrivacyMetricsSnapshot()
  const out = {
    runtime,
    activeWithCoords: 0,
    fuzzPolicyCount: 0,
    exactPolicyCount: 0,
    fuzzPolicyRatio: 0,
    revealRate: runtime.reveal_rate,
    error: null,
  }

  if (!supabaseAdmin) {
    out.error = 'no_db'
    return out
  }

  const { data: rows, error } = await supabaseAdmin
    .from('listings')
    .select('id, latitude, longitude, category_id, categories(slug, wizard_profile)')
    .eq('status', 'ACTIVE')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .limit(3000)

  if (error) {
    out.error = error.message
    return out
  }

  let fuzz = 0
  let exact = 0
  for (const row of rows || []) {
    const cat = row.categories && typeof row.categories === 'object' ? row.categories : null
    const pol = resolveCoordinatePrivacyPolicy({
      categorySlug: cat?.slug ?? null,
      categoryId: row.category_id,
      wizardProfile: cat?.wizard_profile ?? null,
    })
    if (pol.mode === 'exact') exact += 1
    else fuzz += 1
  }

  const total = fuzz + exact
  out.activeWithCoords = total
  out.fuzzPolicyCount = fuzz
  out.exactPolicyCount = exact
  out.fuzzPolicyRatio = total ? Number((fuzz / total).toFixed(3)) : 0

  return out
}
