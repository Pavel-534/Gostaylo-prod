/**
 * Stage 167.1 — server persistence for recently viewed listings.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { LISTINGS_SELECT_LITE } from '@/lib/api/search/listing-search-payload'
import { isExcludedFromPublicCatalog } from '@/lib/e2e/test-listing-cleanup'
import { getCommissionRate } from '@/lib/commission/get-commission-rate-server.js'
import { resolveDefaultCommissionPercent } from '@/lib/services/currency.service'
import { serializeRecommendationCards } from '@/lib/recommendations/serialize-recommendation-card'
import { RECENTLY_VIEWED_MAX } from '@/lib/recommendations/recently-viewed-merge'

const VIEW_LISTING_SELECT = `
  listing_id,
  viewed_at,
  listings (${LISTINGS_SELECT_LITE})
`

/**
 * @param {string} userId
 * @param {string} listingId
 */
export async function upsertListingView(userId, listingId) {
  const uid = String(userId || '').trim()
  const lid = String(listingId || '').trim()
  if (!uid || !lid) return { ok: false, reason: 'missing_ids' }

  const now = new Date().toISOString()
  const { error } = await supabaseAdmin
    .from('listing_views')
    .upsert(
      {
        user_id: uid,
        listing_id: lid,
        viewed_at: now,
      },
      { onConflict: 'user_id,listing_id' },
    )

  if (error) {
    console.error('[listing-views] upsert failed', error.message || error)
    return { ok: false, reason: error.message }
  }

  return { ok: true, viewedAt: now }
}

/**
 * @param {string} userId
 * @param {number} [limit]
 */
export async function fetchRecentListingViews(userId, limit = RECENTLY_VIEWED_MAX) {
  const uid = String(userId || '').trim()
  if (!uid) return []

  const { data, error } = await supabaseAdmin
    .from('listing_views')
    .select(VIEW_LISTING_SELECT)
    .eq('user_id', uid)
    .order('viewed_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 20))

  if (error) {
    console.error('[listing-views] fetch failed', error.message || error)
    return []
  }

  const { guestServiceFeePercent } = await getCommissionRate()
  const defaultCommission = resolveDefaultCommissionPercent()

  const rows = []
  for (const row of data || []) {
    const rawListing = row?.listings
    if (!rawListing || rawListing.status !== 'ACTIVE') continue
    if (isExcludedFromPublicCatalog(rawListing)) continue

    const [card] = await serializeRecommendationCards([rawListing], {
      guestServiceFeePercent,
      defaultCommission,
    })
    if (!card) continue

    rows.push({
      id: card.id,
      listing_id: card.id,
      viewed_at: row.viewed_at,
      ...card,
      listing: card,
    })
  }

  return rows
}

/**
 * Resolve stored recent ids to ACTIVE public catalog cards (drops deleted/hidden/inactive).
 * Preserves caller order (typically newest viewed_at first).
 *
 * @param {string[]} orderedIds
 */
export async function resolveActiveRecentListingCards(orderedIds) {
  const ids = [...new Set((orderedIds || []).map((id) => String(id || '').trim()).filter(Boolean))].slice(
    0,
    RECENTLY_VIEWED_MAX,
  )
  if (!ids.length) return []

  const { data, error } = await supabaseAdmin
    .from('listings')
    .select(LISTINGS_SELECT_LITE)
    .in('id', ids)
    .eq('status', 'ACTIVE')

  if (error) {
    console.error('[listing-views] resolve failed', error.message || error)
    return []
  }

  const activeRows = (data || []).filter((row) => row && !isExcludedFromPublicCatalog(row))
  if (!activeRows.length) return []

  const { guestServiceFeePercent } = await getCommissionRate()
  const defaultCommission = resolveDefaultCommissionPercent()
  const cards = await serializeRecommendationCards(activeRows, {
    guestServiceFeePercent,
    defaultCommission,
  })
  const cardById = new Map(cards.map((card) => [String(card.id), card]))

  const rows = []
  for (const id of ids) {
    const card = cardById.get(id)
    if (!card) continue
    rows.push({
      id: card.id,
      listing_id: card.id,
      ...card,
      listing: card,
    })
  }

  return rows
}
