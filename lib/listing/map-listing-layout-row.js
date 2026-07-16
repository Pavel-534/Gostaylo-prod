/**
 * Map full listings DB row → layout/SEO subset (metadata, JSON-LD).
 * Stage 171.30 (P0.5) — shared with unified PDP bootstrap.
 */

function isListingDraftRow(row) {
  return row?.metadata && typeof row.metadata === 'object' && row.metadata.is_draft === true
}

/**
 * ACTIVE or PENDING (non-draft) — OG Guest-Gate SSOT shape.
 * @param {object | null | undefined} row — Supabase listings row (+ categories join)
 * @returns {object | null}
 */
export function mapListingLayoutRowFromDbRow(row) {
  if (!row || isListingDraftRow(row)) return null

  const status = String(row.status || '').toUpperCase()
  if (status !== 'ACTIVE' && status !== 'PENDING') return null

  let categories = row.categories
  if (Array.isArray(categories)) {
    categories = categories[0] ?? null
  }

  return {
    id: row.id,
    owner_id: row.owner_id,
    status: row.status,
    title: row.title,
    description: row.description,
    address: row.address,
    district: row.district,
    cover_image: row.cover_image,
    images: row.images,
    metadata: row.metadata,
    base_price_thb: row.base_price_thb,
    latitude: row.latitude,
    longitude: row.longitude,
    available: row.available,
    categories,
  }
}

/**
 * ACTIVE-only row for JSON-LD (`ListingSchema`).
 * @param {object | null | undefined} layoutRow
 * @returns {object | null}
 */
export function getActiveListingLayoutRowForSchema(layoutRow) {
  if (!layoutRow || String(layoutRow.status || '').toUpperCase() !== 'ACTIVE') return null
  return layoutRow
}
