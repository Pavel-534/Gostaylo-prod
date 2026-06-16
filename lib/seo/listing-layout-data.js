/**
 * Единая выборка объявления для layout карточки: metadata, JSON-LD, без дубля запросов.
 */
import { cache } from 'react'
import { supabaseAdmin } from '@/lib/supabase'

const LISTING_LAYOUT_SELECT = `
      id,
      owner_id,
      status,
      title,
      description,
      address,
      district,
      cover_image,
      images,
      metadata,
      base_price_thb,
      latitude,
      longitude,
      available,
      categories (slug)
    `

function isListingDraftRow(row) {
  return row?.metadata && typeof row.metadata === 'object' && row.metadata.is_draft === true
}

/** ACTIVE only — catalog JSON-LD and legacy callers. */
export const getCachedActiveListingForLayout = cache(async (id) => {
  const row = await getCachedListingForGuestGate(id)
  if (!row || String(row.status || '').toUpperCase() !== 'ACTIVE') return null
  return row
})

/** ACTIVE or PENDING (non-draft) — OG Guest-Gate SSOT. */
export const getCachedListingForGuestGate = cache(async (id) => {
  if (!supabaseAdmin || !id) return null

  const { data, error } = await supabaseAdmin
    .from('listings')
    .select(LISTING_LAYOUT_SELECT)
    .eq('id', id)
    .in('status', ['ACTIVE', 'PENDING'])
    .maybeSingle()

  if (error || !data || isListingDraftRow(data)) return null
  return data
})
