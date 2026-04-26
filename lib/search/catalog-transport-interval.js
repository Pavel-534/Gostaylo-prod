/**
 * Stage 67.0 — интервальный режим дат/времени в каталоге для транспортных категорий (SSOT: wizard_profile).
 */

import { isTransportIntervalWizardProfile } from '@/lib/config/category-wizard-profile-db'

/**
 * @param {string} categorySlug
 * @param {Record<string, string | null | undefined>} [wizardProfileBySlug] — slug → `categories.wizard_profile`
 */
export function isCatalogTransportIntervalMode(categorySlug, wizardProfileBySlug = {}) {
  const slug = String(categorySlug || '').toLowerCase().trim()
  if (!slug || slug === 'all') return false
  const wp = wizardProfileBySlug[slug] ?? wizardProfileBySlug[categorySlug]
  return isTransportIntervalWizardProfile(wp, slug)
}
