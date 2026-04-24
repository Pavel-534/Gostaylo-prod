/**
 * Stage 32.0 — партнёрские промокоды: валидация листингов и insert payload.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { buildPromoInsertFromAdminBody } from '@/lib/promo/promo-codes-admin-map'

/**
 * @param {string} partnerId
 * @param {unknown} listingIds
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function verifyListingIdsOwnedByPartner(partnerId, listingIds) {
  if (!supabaseAdmin || !partnerId) return { ok: false, error: 'Server misconfigured' }
  if (listingIds == null) return { ok: true }
  if (!Array.isArray(listingIds)) return { ok: false, error: 'listingIds must be an array' }
  const ids = [...new Set(listingIds.map((x) => String(x || '').trim()).filter(Boolean))]
  if (ids.length === 0) return { ok: true }
  if (ids.length > 40) return { ok: false, error: 'Too many listingIds (max 40)' }

  const { data, error } = await supabaseAdmin.from('listings').select('id, owner_id').in('id', ids)
  if (error) return { ok: false, error: error.message }
  if (!data || data.length !== ids.length) return { ok: false, error: 'One or more listings not found' }
  const pid = String(partnerId)
  for (const row of data) {
    if (String(row.owner_id) !== pid) return { ok: false, error: 'Listing is not yours' }
  }
  return { ok: true }
}

/**
 * @param {object} body — как в админке (code, type, value, expiryDate, usageLimit)
 * @param {string} partnerId
 * @returns {object} row для insert в `promo_codes`
 */
export function buildPartnerPromoInsert(body, partnerId) {
  const base = buildPromoInsertFromAdminBody(body)
  return {
    ...base,
    created_by_type: 'PARTNER',
    partner_id: String(partnerId),
  }
}
