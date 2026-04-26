/**
 * Какой набор полей показывать в модалке «Все фильтры».
 */
import { isTransportListingCategory } from '@/lib/listing-category-slug'
import {
  normalizeCategoryWizardProfileColumn,
  isServiceMarketplaceWizardProfileColumn,
} from '@/lib/config/category-wizard-profile-db'

/**
 * @param {string} [categorySlug]
 * @param {string | null | undefined} [wizardProfileFromDb] — `categories.wizard_profile` (из API)
 * @returns {'housing'|'transport'|'service'}
 */
export function getSearchFilterPanelKind(categorySlug, wizardProfileFromDb) {
  const s = String(categorySlug || 'all').toLowerCase()
  if (s === 'all') return 'housing'
  const col = normalizeCategoryWizardProfileColumn(wizardProfileFromDb)
  if (col === 'transport' || col === 'transport_helicopter') return 'transport'
  if (isServiceMarketplaceWizardProfileColumn(wizardProfileFromDb)) return 'service'
  if (isTransportListingCategory(s)) return 'transport'
  if (s === 'nanny' || s === 'babysitter') return 'service'
  return 'housing'
}
