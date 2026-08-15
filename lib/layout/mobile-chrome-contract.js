/**
 * ADR-201 — Mobile Chrome Contract (overlay recipes).
 * SSOT names for Sheet / Dialog / custom search sheet. Do not invent a fourth recipe.
 */

/** @typedef {'action' | 'form' | 'dialog'} MobileChromeRecipe */

export const MOBILE_CHROME_RECIPES = Object.freeze({
  /** Short bottom menus — hug content, flush bottom, safe-area pad only. */
  ACTION: 'action',
  /** Tall editors / sticky CTA — fill visualViewport. */
  FORM: 'form',
  /** Centered / capped dialogs on mobile. */
  DIALOG: 'dialog',
})

/**
 * Sheet `fit` prop → recipe.
 * Legacy: `content` → action, `viewport` → form (Stage 201.38 names).
 * @param {string | undefined} fit
 * @returns {'action' | 'form'}
 */
export function sheetFitToRecipe(fit) {
  if (fit === 'form' || fit === 'viewport') return MOBILE_CHROME_RECIPES.FORM
  return MOBILE_CHROME_RECIPES.ACTION
}

/**
 * Dialog `mobileAnchor` → recipe.
 * @param {'top' | 'bottom' | string | undefined} mobileAnchor
 * @returns {MobileChromeRecipe}
 */
export function dialogAnchorToRecipe(mobileAnchor) {
  return mobileAnchor === 'bottom' ? MOBILE_CHROME_RECIPES.FORM : MOBILE_CHROME_RECIPES.DIALOG
}
