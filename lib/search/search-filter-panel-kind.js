/**
 * Какой набор полей показывать в модалке «Все фильтры».
 */
import { isTransportListingCategory } from '@/lib/listing-category-slug'

export function getSearchFilterPanelKind(categorySlug) {
  const s = String(categorySlug || 'all').toLowerCase()
  if (s === 'all') return 'housing'
  if (isTransportListingCategory(s)) return 'transport'
  if (s === 'nanny' || s === 'babysitter') return 'nanny'
  return 'housing'
}
