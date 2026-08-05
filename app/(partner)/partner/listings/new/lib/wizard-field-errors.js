/**
 * Stage 200.29 — wizard required-field highlight helpers.
 */

export const WIZARD_FIELD_ERROR_RING =
  'border-red-500 ring-2 ring-red-200 focus-visible:ring-red-300 focus-visible:border-red-500'

export const WIZARD_FIELD_ERROR_BOX =
  'border-red-500 ring-2 ring-red-200 bg-red-50/40'

/**
 * @param {Record<string, boolean> | null | undefined} fieldErrors
 * @param {string} field
 */
export function wizardFieldHasError(fieldErrors, field) {
  return Boolean(fieldErrors && fieldErrors[field])
}

/**
 * @param {Record<string, boolean> | null | undefined} fieldErrors
 * @param {string} field
 * @param {string} [okClass]
 */
export function wizardFieldErrorClass(fieldErrors, field, okClass = '') {
  return wizardFieldHasError(fieldErrors, field) ? WIZARD_FIELD_ERROR_RING : okClass
}

/**
 * Scroll first marked invalid control into view (mobile sticky footer safe).
 * @param {string} [field]
 */
export function scrollWizardFieldIntoView(field) {
  if (typeof document === 'undefined') return
  const sel = field
    ? `[data-wizard-field="${field}"]`
    : '[data-wizard-field-error="true"]'
  const el = document.querySelector(sel)
  if (!el || typeof el.scrollIntoView !== 'function') return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
