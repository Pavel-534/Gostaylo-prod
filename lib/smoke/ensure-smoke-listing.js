/**
 * Stage 156.3 — guarantee listings row exists before smoke bookings (FK shield).
 */
import { supabaseAdmin } from '@/lib/supabase'
import { E2E_TEST_DATA_TAG } from '@/lib/e2e/test-data-tag'
import { withFintechTestDataMeta } from '@/lib/admin/fintech-test-data-meta.js'

/**
 * @param {{
 *   listingId: string,
 *   partnerId: string,
 *   categoryId?: string | null,
 *   tag?: string,
 *   priceThb?: number,
 * }} params
 */
export async function ensureSmokeListingExists({
  listingId,
  partnerId,
  categoryId = null,
  tag = `${E2E_TEST_DATA_TAG} smoke_listing_ensure`,
  priceThb = 3000,
}) {
  if (!supabaseAdmin) throw new Error('SUPABASE not configured')
  const id = String(listingId || '').trim()
  const owner = String(partnerId || '').trim()
  if (!id || !owner) throw new Error('SMOKE_LISTING_ENSURE_MISSING_IDS')

  const { data: existing, error: readErr } = await supabaseAdmin
    .from('listings')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (readErr) throw new Error(readErr.message || 'LISTING_READ_FAILED')
  if (existing?.id) return id

  let catId = categoryId ? String(categoryId).trim() : ''
  if (!catId) {
    const { data: cat, error: catErr } = await supabaseAdmin
      .from('categories')
      .select('id')
      .limit(1)
      .maybeSingle()
    if (catErr) throw new Error(catErr.message || 'CATEGORY_READ_FAILED')
    catId = cat?.id ? String(cat.id) : ''
  }
  if (!catId) throw new Error('NO_CATEGORY_FOR_SMOKE_LISTING')

  const ts = new Date().toISOString()
  const { error: upErr } = await supabaseAdmin.from('listings').upsert(
    {
      id,
      owner_id: owner,
      category_id: catId,
      status: 'ACTIVE',
      title: `${tag} listing`,
      description: tag,
      district: 'Smoke',
      base_price_thb: Math.max(500, Number(priceThb) || 3000),
      commission_rate: 0,
      images: [],
      available: true,
      instant_booking: true,
      max_capacity: 2,
      metadata: withFintechTestDataMeta({ test_data_tag: E2E_TEST_DATA_TAG, e2e_fixture: 'smoke_listing_ensure' }),
      updated_at: ts,
    },
    { onConflict: 'id' },
  )
  if (upErr) throw new Error(upErr.message || 'LISTING_UPSERT_FAILED')
  return id
}
