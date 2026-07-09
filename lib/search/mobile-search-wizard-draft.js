/**
 * Stage 178.3 Step 2 — draft snapshot for MobileSearchWizard (core public search filters).
 * URL SSOT unchanged; parent commits via applySnapshot + commitToUrl on Apply.
 */

/**
 * @typedef {Object} MobileSearchWizardDraft
 * @property {string} selectedCategory
 * @property {string} where
 * @property {{ from: Date | null, to: Date | null }} dateRange
 * @property {string} checkInTime
 * @property {string} checkOutTime
 * @property {string} guests
 * @property {{ adults: number, children: number, infants: number } | null} guestsBreakdown
 * @property {string} searchQuery
 * @property {boolean} smartSearchOn
 */

/** @param {Partial<MobileSearchWizardDraft> & Record<string, unknown>} committed */
export function cloneMobileSearchWizardDraft(committed) {
  const guestsN = Math.max(1, parseInt(committed.guests, 10) || 1)
  const breakdown = committed.guestsBreakdown
  return {
    selectedCategory: committed.selectedCategory ?? 'all',
    where: committed.where ?? 'all',
    dateRange: {
      from: committed.dateRange?.from ? new Date(committed.dateRange.from) : null,
      to: committed.dateRange?.to ? new Date(committed.dateRange.to) : null,
    },
    checkInTime: committed.checkInTime ?? '07:00',
    checkOutTime: committed.checkOutTime ?? '07:00',
    guests: String(guestsN),
    guestsBreakdown: breakdown
      ? {
          adults: Math.max(1, parseInt(breakdown.adults, 10) || 1),
          children: Math.max(0, parseInt(breakdown.children, 10) || 0),
          infants: Math.max(0, parseInt(breakdown.infants, 10) || 0),
        }
      : { adults: guestsN, children: 0, infants: 0 },
    searchQuery: committed.searchQuery ?? committed.textQuery ?? '',
    smartSearchOn: committed.smartSearchOn !== false,
  }
}

/** @param {MobileSearchWizardDraft} draft */
export function mobileSearchWizardDraftToFilterSnapshot(draft) {
  return {
    selectedCategory: draft.selectedCategory,
    where: draft.where,
    dateRange: draft.dateRange,
    checkInTime: draft.checkInTime,
    checkOutTime: draft.checkOutTime,
    guests: draft.guests,
    guestsBreakdown: draft.guestsBreakdown,
    textQuery: draft.searchQuery,
    smartSearchOn: draft.smartSearchOn,
  }
}
