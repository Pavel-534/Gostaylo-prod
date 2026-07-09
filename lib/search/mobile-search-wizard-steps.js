/**
 * Stage 178.3 Step 3 — wizard step order and navigation SSOT.
 */

/** @typedef {'what' | 'where' | 'when' | 'who'} MobileSearchWizardStep */

export const MOBILE_SEARCH_WIZARD_STEPS = /** @type {const} */ ([
  'what',
  'where',
  'when',
  'who',
])

/** @param {MobileSearchWizardStep} step */
export function getNextWizardStep(step) {
  const idx = MOBILE_SEARCH_WIZARD_STEPS.indexOf(step)
  if (idx < 0 || idx >= MOBILE_SEARCH_WIZARD_STEPS.length - 1) return null
  return MOBILE_SEARCH_WIZARD_STEPS[idx + 1]
}

/** @param {MobileSearchWizardStep} step */
export function getPrevWizardStep(step) {
  const idx = MOBILE_SEARCH_WIZARD_STEPS.indexOf(step)
  if (idx <= 0) return null
  return MOBILE_SEARCH_WIZARD_STEPS[idx - 1]
}

/** @param {MobileSearchWizardStep} step */
export function isLastWizardStep(step) {
  return step === 'who'
}

/** @param {MobileSearchWizardStep} step */
export function getWizardStepTitleKey(step) {
  switch (step) {
    case 'what':
      return 'mobileSearchWhatTitle'
    case 'where':
      return 'whereShort'
    case 'when':
      return 'selectYourDates'
    case 'who':
      return 'mobileSearchWhoTitle'
    default:
      return 'mobileSearchWhatTitle'
  }
}
