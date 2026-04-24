/**
 * Stage 32.0 — партнёрские промокоды: валидация листингов и insert payload.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { buildPromoInsertFromAdminBody } from '@/lib/promo/promo-codes-admin-map'
import { normalizeAllowedListingIdsForInsert } from '@/lib/promo/allowed-listing-ids'

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
  const isFlash = Boolean(body?.isFlashSale ?? body?.is_flash_sale)
  const hoursRaw = parseInt(String(body?.flashEndsInHours ?? ''), 10)
  const flashHrs = [3, 6, 12, 24].includes(hoursRaw) ? hoursRaw : null

  const bodyForInsert = { ...body, isFlashSale: isFlash }
  if (isFlash) {
    if (!flashHrs) {
      const e = new Error('Flash Sale: choose end time (3, 6, 12 or 24 hours)')
      e.code = 'VALIDATION'
      throw e
    }
    const end = new Date(Date.now() + flashHrs * 3600 * 1000)
    bodyForInsert.validUntilIso = end.toISOString()
    bodyForInsert.expiryDate = end.toISOString().slice(0, 10)
  }

  const base = buildPromoInsertFromAdminBody(bodyForInsert)
  const scoped = normalizeAllowedListingIdsForInsert(body?.listingIds)
  return {
    ...base,
    created_by_type: 'PARTNER',
    partner_id: String(partnerId),
    allowed_listing_ids: scoped,
    is_flash_sale: isFlash,
  }
}
