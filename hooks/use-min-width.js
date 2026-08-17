/**
 * Viewport gate for heavy desktop-only trees.
 * Returns `null` until measured (SSR + first paint), then boolean.
 * Mobile-first: treat `null` as "do not mount desktop widgets".
 */

import { useEffect, useState } from 'react'

/** Tailwind `md` */
export const VIEWPORT_MD_MIN_PX = 768
/** Tailwind `lg` — catalog desktop map column (`max-lg:hidden`) */
export const VIEWPORT_LG_MIN_PX = 1024

/**
 * @param {number} minWidthPx
 * @returns {boolean | null}
 */
export function useMinWidth(minWidthPx) {
  const [matches, setMatches] = useState(/** @type {boolean | null} */ (null))

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidthPx}px)`)
    const sync = () => setMatches(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [minWidthPx])

  return matches
}

/** @param {number} minWidthPx */
export function useMinWidthConfirmed(minWidthPx) {
  return useMinWidth(minWidthPx) === true
}
