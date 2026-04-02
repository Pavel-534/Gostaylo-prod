/**
 * Единая выборка объявления для layout карточки: metadata, JSON-LD, без дубля запросов.
 */
import { cache } from 'react'
import { supabaseAdmin } from '@/lib/supabase'

export const getCachedActiveListingForLayout = cache(async (id) => {
  if (!supabaseAdmin || !id) return null

  const { data, error } = await supabaseAdmin
    .from('listings')
    .select(
      `
      id,
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
    `,
    )
    .eq('id', id)
    .eq('status', 'ACTIVE')
    .single()

  if (error || !data) return null
  return data
})
