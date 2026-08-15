/**
 * Stage 201.51 — keep focused editable above the soft keyboard (ADR-201).
 * Scrolls the nearest scrollport so the field sits in the upper-middle of visualViewport.
 */

import { isEditableFocusTarget } from '@/lib/layout/is-soft-keyboard-open.js'

const DEFAULT_MARGIN_PX = 20

/**
 * @param {Element | null | undefined} el
 * @returns {Element | null}
 */
export function findVerticalScrollParent(el) {
  if (!el || typeof window === 'undefined') return null
  let node = el.parentElement
  while (node && node !== document.body && node !== document.documentElement) {
    const style = window.getComputedStyle(node)
    const oy = style.overflowY
    const canScroll =
      (oy === 'auto' || oy === 'scroll' || oy === 'overlay') &&
      node.scrollHeight > node.clientHeight + 1
    if (canScroll) return node
    node = node.parentElement
  }
  return null
}

/**
 * Place `el` near the vertical center of the visualViewport (above the keyboard).
 * @param {Element | null | undefined} el
 * @param {{ marginPx?: number }} [opts]
 */
export function ensureFocusedFieldVisible(el, opts = {}) {
  if (!el || typeof window === 'undefined') return
  if (!(el instanceof HTMLElement)) return

  const margin = opts.marginPx ?? DEFAULT_MARGIN_PX
  const vv = window.visualViewport
  const vvTop = vv ? vv.offsetTop : 0
  const vvHeight = vv ? vv.height : window.innerHeight
  const vvBottom = vvTop + vvHeight
  const targetCenter = vvTop + vvHeight * 0.38

  const rect = el.getBoundingClientRect()
  const fieldCenter = rect.top + rect.height / 2
  const fullyVisible =
    rect.top >= vvTop + margin && rect.bottom <= vvBottom - margin

  if (fullyVisible && Math.abs(fieldCenter - targetCenter) < vvHeight * 0.2) {
    return
  }

  const scrollParent = findVerticalScrollParent(el)
  if (scrollParent) {
    const delta = fieldCenter - targetCenter
    const max = scrollParent.scrollHeight - scrollParent.clientHeight
    scrollParent.scrollTop = Math.max(0, Math.min(max, scrollParent.scrollTop + delta))
    return
  }

  try {
    el.scrollIntoView({ block: 'center', inline: 'nearest' })
  } catch {
    /* ignore */
  }
}

/**
 * Schedule keep-visible after iOS keyboard animation / visualViewport settle.
 * @param {Element | null | undefined} el
 */
export function scheduleEnsureFocusedFieldVisible(el) {
  if (!el || typeof window === 'undefined') return () => {}
  const run = () => ensureFocusedFieldVisible(el)
  run()
  const t1 = window.setTimeout(run, 50)
  const t2 = window.setTimeout(run, 180)
  const t3 = window.setTimeout(run, 350)
  const vv = window.visualViewport
  vv?.addEventListener('resize', run)
  vv?.addEventListener('scroll', run)
  return () => {
    window.clearTimeout(t1)
    window.clearTimeout(t2)
    window.clearTimeout(t3)
    vv?.removeEventListener('resize', run)
    vv?.removeEventListener('scroll', run)
  }
}

export { isEditableFocusTarget }
