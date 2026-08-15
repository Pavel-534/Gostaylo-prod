'use client'

import { useEffect, useState } from 'react'

/** Same threshold as PartnerMobileBottomNav / MobileBottomNav. */
export const KEYBOARD_VIEWPORT_SHRINK_PX = 120

/**
 * Stage 200.134 / 200.135 — visualViewport frame for mobile overlays (keyboard / iOS chrome).
 *
 * **SSOT rule (iOS):** pin fixed dialogs/sheets to the *visualViewport rectangle*
 * (`top: offsetTop`, `height: height`). Do **not** rely on
 * `bottom: innerHeight - offsetTop - height` alone — when the user focuses a mid/lower
 * field (often with the number pad), Safari changes `offsetTop` and that bottom inset
 * sinks the sheet under the keyboard.
 *
 * Prefer this over raw `100vh` / `dvh` for overlay max-height.
 *
 * @returns {{ heightPx: number | null, offsetTop: number, offsetLeft: number, widthPx: number | null, bottomInset: number }}
 */
export function useVisualViewportFrame() {
  const [frame, setFrame] = useState({
    heightPx: null,
    offsetTop: 0,
    offsetLeft: 0,
    widthPx: null,
    bottomInset: 0,
  })

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const sync = () => {
      const vv = window.visualViewport
      if (!vv) {
        setFrame({
          heightPx: null,
          offsetTop: 0,
          offsetLeft: 0,
          widthPx: null,
          bottomInset: 0,
        })
        return
      }
      setFrame({
        heightPx: vv.height,
        offsetTop: vv.offsetTop,
        offsetLeft: vv.offsetLeft,
        widthPx: vv.width,
        bottomInset: Math.max(0, window.innerHeight - vv.offsetTop - vv.height),
      })
    }

    sync()
    const vv = window.visualViewport
    vv?.addEventListener('resize', sync)
    vv?.addEventListener('scroll', sync)
    window.addEventListener('orientationchange', sync)
    window.addEventListener('focusin', sync)
    const onFocusOut = () => {
      window.setTimeout(sync, 50)
      window.setTimeout(sync, 300)
    }
    window.addEventListener('focusout', onFocusOut)

    return () => {
      vv?.removeEventListener('resize', sync)
      vv?.removeEventListener('scroll', sync)
      window.removeEventListener('orientationchange', sync)
      window.removeEventListener('focusin', sync)
      window.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  return frame
}

function readAppBottomNavPx() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 0
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--app-bottom-nav-height')
    .trim()
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * CSS pin for `position: fixed` overlays inside the visible viewport.
 * @param {ReturnType<typeof useVisualViewportFrame>} frame
 * @param {{ mode?: 'fill' | 'max' | 'hug', respectAppBottomNav?: boolean }} [opts]
 *
 * - `fill` — form sheet that occupies the visible vv (sticky footer / keyboard).
 * - `max` — short dialog capped to vv, pinned near the top.
 * - `hug` — bottom action sheet sized to content, flush to screen bottom (Stage 201.43).
 *   Clear the tab bar with **paddingBottom**, never `bottom: navHeight` (that floated sheets
 *   and left a dead gap above the dock on iOS/Android).
 */
export function buildVisualViewportPinStyle(frame, { mode = 'fill', respectAppBottomNav = false } = {}) {
  if (frame?.heightPx == null) {
    if (mode === 'hug') {
      return {
        top: 'auto',
        bottom: '0px',
        height: 'auto',
        maxHeight: 'min(90dvh, 40rem)',
        ...(respectAppBottomNav
          ? { paddingBottom: 'max(0.75rem, var(--app-bottom-nav-height, 0px))' }
          : { paddingBottom: '0.75rem' }),
      }
    }
    return mode === 'fill'
      ? { top: 0, bottom: 'auto', height: '100dvh', maxHeight: '100dvh' }
      : { top: '0.5rem', bottom: 'auto', maxHeight: 'calc(100dvh - 1rem)' }
  }

  /**
   * Stage 201.39 / 201.43 — iOS Safari often reports bottomInset > 0 for browser chrome
   * (not keyboard). Only treat large inset as keyboard for lifting `bottom`.
   */
  const keyboardOpen = (frame.bottomInset || 0) > KEYBOARD_VIEWPORT_SHRINK_PX
  const navReserve = respectAppBottomNav && !keyboardOpen ? readAppBottomNavPx() : 0

  if (mode === 'hug') {
    const bottom = keyboardOpen ? frame.bottomInset || 0 : 0
    const padPx = keyboardOpen ? 12 : Math.max(12, navReserve)
    return {
      top: 'auto',
      bottom: `${bottom}px`,
      height: 'auto',
      maxHeight: `${Math.max(160, frame.heightPx)}px`,
      paddingBottom: `${padPx}px`,
    }
  }

  if (mode === 'fill') {
    const h = Math.max(160, frame.heightPx - navReserve)
    return {
      top: `${frame.offsetTop}px`,
      bottom: 'auto',
      height: `${h}px`,
      maxHeight: `${h}px`,
    }
  }

  return {
    top: `calc(${frame.offsetTop}px + 0.5rem)`,
    bottom: 'auto',
    maxHeight: `calc(${frame.heightPx - navReserve}px - 1rem)`,
  }
}

export default useVisualViewportFrame
