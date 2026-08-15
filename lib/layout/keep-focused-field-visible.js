/**
 * Stage 201.51 / 201.52 — keep focused editable above the soft keyboard (ADR-201).
 * Scrolls `[data-mobile-overlay-scrollport]` (or nearest overflow) so the field sits
 * in the upper third of visualViewport after the keyboard settles.
 */

import { isEditableFocusTarget } from '@/lib/layout/is-soft-keyboard-open.js'

export const MOBILE_OVERLAY_SCROLLPORT_ATTR = 'data-mobile-overlay-scrollport'

const DEFAULT_MARGIN_PX = 16
/** Fraction of visualViewport height from the top — keep caret in the upper band. */
const TARGET_FROM_TOP = 0.32

/**
 * @param {Element | null | undefined} el
 * @returns {Element | null}
 */
export function findVerticalScrollParent(el) {
  if (!el || typeof window === 'undefined') return null
  if (typeof el.closest === 'function') {
    const marked = el.closest(`[${MOBILE_OVERLAY_SCROLLPORT_ATTR}]`)
    if (marked) return marked
  }
  let node = el.parentElement
  while (node && node !== document.body && node !== document.documentElement) {
    const style = window.getComputedStyle(node)
    const oy = style.overflowY
    // Prefer overflow scrollports even before content overflows (keyboard not settled yet).
    if (oy === 'auto' || oy === 'scroll' || oy === 'overlay') {
      return node
    }
    node = node.parentElement
  }
  return null
}

/**
 * Place `el` in the upper band of the visualViewport (above the keyboard).
 * @param {Element | null | undefined} el
 * @param {{ marginPx?: number, force?: boolean }} [opts]
 */
export function ensureFocusedFieldVisible(el, opts = {}) {
  if (!el || typeof window === 'undefined') return
  if (!(el instanceof HTMLElement)) return

  const margin = opts.marginPx ?? DEFAULT_MARGIN_PX
  const vv = window.visualViewport
  const vvTop = vv ? vv.offsetTop : 0
  const vvHeight = vv ? vv.height : window.innerHeight
  const vvBottom = vvTop + vvHeight
  const targetY = vvTop + vvHeight * TARGET_FROM_TOP

  const rect = el.getBoundingClientRect()
  const fieldTop = rect.top
  const fieldBottom = rect.bottom
  const fieldCenter = fieldTop + rect.height / 2

  const coveredByKeyboard = fieldBottom > vvBottom - margin
  const aboveViewport = fieldTop < vvTop + margin
  if (!opts.force && !coveredByKeyboard && !aboveViewport) {
    // Already in the safe band — only nudge if far from target.
    if (Math.abs(fieldCenter - targetY) < vvHeight * 0.22) return
  }

  const scrollParent = findVerticalScrollParent(el)
  if (scrollParent) {
    const delta = fieldCenter - targetY
    const max = Math.max(0, scrollParent.scrollHeight - scrollParent.clientHeight)
    const next = Math.max(0, Math.min(max, scrollParent.scrollTop + delta))
    if (typeof scrollParent.scrollTo === 'function') {
      scrollParent.scrollTo({ top: next, behavior: 'auto' })
    } else {
      scrollParent.scrollTop = next
    }
    return
  }

  try {
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
  } catch {
    try {
      el.scrollIntoView({ block: 'center', inline: 'nearest' })
    } catch {
      /* ignore */
    }
  }
}

/**
 * Schedule keep-visible after iOS keyboard animation / visualViewport settle.
 * @param {Element | null | undefined} el
 * @returns {() => void}
 */
export function scheduleEnsureFocusedFieldVisible(el) {
  if (!el || typeof window === 'undefined') return () => {}

  const run = (force = false) => ensureFocusedFieldVisible(el, { force })
  run(true)

  const timeouts = [32, 80, 160, 280, 450, 700].map((ms) =>
    window.setTimeout(() => run(true), ms),
  )

  const onVv = () => run(true)
  const vv = window.visualViewport
  vv?.addEventListener('resize', onVv)
  vv?.addEventListener('scroll', onVv)
  window.addEventListener('resize', onVv)

  return () => {
    timeouts.forEach((id) => window.clearTimeout(id))
    vv?.removeEventListener('resize', onVv)
    vv?.removeEventListener('scroll', onVv)
    window.removeEventListener('resize', onVv)
  }
}

export { isEditableFocusTarget }
