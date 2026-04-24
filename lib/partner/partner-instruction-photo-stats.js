/**
 * Stage 32.0 — агрегат фото инструкций (`metadata.check_in_photos`) по активным листингам партнёра.
 */

import { supabaseAdmin } from '@/lib/supabase'

function countInstructionPhotos(meta) {
  const m = meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {}
  const raw = m.check_in_photos
  if (!Array.isArray(raw)) return 0
  return raw.filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u.trim())).length
}

/**
 * @param {string} partnerId
 * @returns {Promise<{ activeListingCount: number, listingsBelow3: number, avgInstructionPhotos: number | null }>}
 */
export async function fetchPartnerInstructionPhotoStats(partnerId) {
  if (!supabaseAdmin || !partnerId) {
    return { activeListingCount: 0, listingsBelow3: 0, avgInstructionPhotos: null }
  }

  const { data, error } = await supabaseAdmin
    .from('listings')
    .select('id, status, metadata')
    .eq('owner_id', String(partnerId))
    .in('status', ['ACTIVE', 'PENDING'])

  if (error || !Array.isArray(data)) {
    return { activeListingCount: 0, listingsBelow3: 0, avgInstructionPhotos: null }
  }

  const active = data.filter((l) => String(l.status || '').toUpperCase() === 'ACTIVE')
  if (active.length === 0) {
    return { activeListingCount: 0, listingsBelow3: 0, avgInstructionPhotos: null }
  }

  let below3 = 0
  let sumCapped = 0
  for (const l of active) {
    const n = countInstructionPhotos(l.metadata)
    const capped = Math.min(3, n)
    sumCapped += capped
    if (n < 3) below3 += 1
  }

  const avg = Math.round((sumCapped / active.length) * 10) / 10
  return {
    activeListingCount: active.length,
    listingsBelow3: below3,
    avgInstructionPhotos: avg,
  }
}
