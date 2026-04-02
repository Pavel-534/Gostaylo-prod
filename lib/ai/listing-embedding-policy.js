/**
 * Политика: для каких listing.status считаем эмбеддинги и reindex.
 *
 * Важно: в Postgres enum listing_status должны быть только реально существующие литералы.
 * Нельзя использовать .neq('status', 'DELETED'), если DELETED нет в enum — будет ERROR 42704.
 *
 * Черновики в продукте обычно status=INACTIVE + metadata.is_draft (отдельного DRAFT в enum нет).
 * См. prisma enum ListingStatus: PENDING, ACTIVE, BOOKED, INACTIVE, REJECTED
 */

export const LISTING_STATUSES_ELIGIBLE_FOR_EMBEDDING = Object.freeze([
  'ACTIVE',
  'INACTIVE',
  'PENDING',
  'BOOKED',
])

/**
 * @param {string|null|undefined} status
 */
export function isListingStatusEligibleForEmbedding(status) {
  const s = String(status ?? '')
    .trim()
    .toUpperCase()
  return LISTING_STATUSES_ELIGIBLE_FOR_EMBEDDING.includes(s)
}
