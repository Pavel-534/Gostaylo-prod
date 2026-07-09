/**
 * Stage 178.3 Step 1 — read-only labels for mobile catalog search summary bar.
 * Pure formatters; SSOT for summary text (wizard reuses later).
 */

import { format, isSameDay } from 'date-fns'
import { ru as ruLocale } from 'date-fns/locale'
import { getCategoryName, getUIText } from '@/lib/translations'
import { getDestinationLabel } from '@/lib/locations/popular-destinations'
import { formatGuestsSummaryText } from '@/components/search/GuestsPopover'
import { pluralizeGuests } from '@/lib/i18n/pluralize'
import { getCategoryBySlug } from '@/lib/config/category-hierarchy'

function resolveWhereFallback(whereValue) {
  return String(whereValue || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
}

export function formatCatalogSearchDateRangeShort(dateRange, language = 'ru') {
  if (!dateRange?.from) return null
  const locale = language === 'ru' ? ruLocale : undefined
  if (!dateRange.to || isSameDay(dateRange.from, dateRange.to)) {
    return format(dateRange.from, language === 'ru' ? 'd MMM' : 'MMM d', { locale })
  }
  const sameMonth = dateRange.from.getMonth() === dateRange.to.getMonth()
  if (sameMonth) {
    const m = format(dateRange.from, language === 'ru' ? 'MMM' : 'MMM', { locale })
    return `${format(dateRange.from, 'd')}–${format(dateRange.to, 'd')} ${m}`
  }
  const mk = (d) => format(d, language === 'ru' ? 'd MMM' : 'MMM d', { locale })
  return `${mk(dateRange.from)} – ${mk(dateRange.to)}`
}

/**
 * @param {object} params
 * @returns {{ categoryLabel: string, whereLabel: string, datesLabel: string, guestsLabel: string, segments: string[] }}
 */
export function buildCatalogSearchSummaryLabels({
  language = 'ru',
  category = 'all',
  where = 'all',
  dateRange = { from: null, to: null },
  guests = '1',
  guestsBreakdown = null,
  categoriesForHierarchy = [],
}) {
  const t = (key) => getUIText(key, language)

  const categoryLabel =
    category && category !== 'all'
      ? getCategoryName(category, language) || String(category)
      : t('allLabel')

  const whereLabel =
    where && where !== 'all'
      ? getDestinationLabel(where, language) || resolveWhereFallback(where)
      : t('catalogSearchSummary_anywhere')

  const datesLabel = formatCatalogSearchDateRangeShort(dateRange, language) || t('dates')

  const guestsN = Math.max(1, parseInt(guests, 10) || 1)
  const guestsLabel = guestsBreakdown
    ? formatGuestsSummaryText(guestsBreakdown, language)
    : `${guestsN} ${pluralizeGuests(guestsN, language)}`

  const segments = [categoryLabel, whereLabel, datesLabel, guestsLabel]

  return { categoryLabel, whereLabel, datesLabel, guestsLabel, segments }
}

/** @param {Array<{ slug?: string, wizardProfile?: string, wizard_profile?: string }>} categories */
export function resolveCatalogSearchCategoryIconSource(category, categoryWizardProfile, categoriesForHierarchy) {
  const catObj = getCategoryBySlug(categoriesForHierarchy, category)
  if (catObj) {
    return {
      ...catObj,
      wizardProfile: categoryWizardProfile ?? catObj.wizardProfile ?? catObj.wizard_profile,
    }
  }
  if (category && category !== 'all') {
    return { slug: category, wizardProfile: categoryWizardProfile }
  }
  return { slug: 'all', wizardProfile: null }
}
