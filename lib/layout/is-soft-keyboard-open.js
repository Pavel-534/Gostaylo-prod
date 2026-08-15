/**
 * Soft-keyboard detection SSOT (ADR-201 / Stage 201.45).
 *
 * Do NOT treat visualViewport bottomInset alone as keyboard — Samsung Internet /
 * some Android chrome report a large bottom inset for the browser toolbar, which
 * previously hid MobileBottomNav / PartnerMobileBottomNav permanently and zeroed
 * `--app-bottom-nav-height` (missing tab bar + no content bottom pad).
 *
 * Keyboard = large bottom inset AND focus in an editable field.
 */

/** Keep in sync with `KEYBOARD_VIEWPORT_SHRINK_PX` in use-visual-viewport-frame.js */
const KEYBOARD_VIEWPORT_SHRINK_PX = 120

export function isEditableFocusTarget(el) {
  if (!el || typeof el !== 'object') return false
  if (el.isContentEditable) return true
  const tag = String(el.tagName || '').toUpperCase()
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag === 'INPUT') {
    const type = String(el.type || 'text').toLowerCase()
    if (
      type === 'button' ||
      type === 'submit' ||
      type === 'reset' ||
      type === 'checkbox' ||
      type === 'radio' ||
      type === 'file' ||
      type === 'hidden'
    ) {
      return false
    }
    return true
  }
  return false
}

/**
 * @param {VisualViewport | null | undefined} [vv]
 * @param {Document | null | undefined} [doc]
 */
export function isSoftKeyboardOpen(vv, doc = typeof document !== 'undefined' ? document : null) {
  if (!vv || typeof window === 'undefined') return false
  const bottomInset = Math.max(0, window.innerHeight - vv.offsetTop - vv.height)
  if (bottomInset <= KEYBOARD_VIEWPORT_SHRINK_PX) return false
  const active = doc?.activeElement
  return isEditableFocusTarget(active)
}
