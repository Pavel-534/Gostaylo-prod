'use client'

import { useEffect, useState } from 'react'
import { MOBILE_CHROME_RECIPES } from '@/lib/layout/mobile-chrome-contract'

/** Same threshold as MobileBottomNav / PartnerMobileBottomNav / ADR-201. */
export const KEYBOARD_VIEWPORT_SHRINK_PX = 120

/**
 * Safe-area bottom pad for action/form sheets (home indicator).
 * Never use full `--app-bottom-nav-height` here — dock is locked while overlay is open (ADR-201).
 */
export const MOBILE_CHROME_SAFE_PAD_BOTTOM =
  'max(0.75rem, env(safe-area-inset-bottom, 0px))'

/**
 * Stage 200.134 / 200.135 / ADR-201 — visualViewport frame for mobile overlays.
 *
 * **SSOT (iOS):** pin form sheets to the visualViewport rectangle (`top: offsetTop`,
 * `height: height`). Do not rely on `bottomInset` alone for fill mode.
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

/**
 * Normalize legacy mode names → ADR-201 recipe.
 * @param {{ recipe?: string, mode?: string }} opts
 * @returns {'action' | 'form' | 'dialog'}
 */
function resolveRecipe(opts = {}) {
  const raw = opts.recipe || opts.mode
  if (raw === MOBILE_CHROME_RECIPES.ACTION || raw === 'hug') return MOBILE_CHROME_RECIPES.ACTION
  if (raw === MOBILE_CHROME_RECIPES.FORM || raw === 'fill') return MOBILE_CHROME_RECIPES.FORM
  if (raw === MOBILE_CHROME_RECIPES.DIALOG || raw === 'max') return MOBILE_CHROME_RECIPES.DIALOG
  return MOBILE_CHROME_RECIPES.FORM
}

/**
 * CSS pin for `position: fixed` overlays (ADR-201 Mobile Chrome Contract).
 *
 * @param {ReturnType<typeof useVisualViewportFrame>} frame
 * @param {{ recipe?: 'action' | 'form' | 'dialog', mode?: 'action' | 'form' | 'dialog' | 'hug' | 'fill' | 'max' }} [opts]
 *   `mode` kept as alias of `recipe` for older call sites / tests.
 *
 * - **action** — hug content, `bottom: 0`, safe-area pad only (dock locked separately).
 * - **form** — fill visualViewport (keyboard-safe); safe-area pad.
 * - **dialog** — capped to vv near top (desktop Dialog overrides to center).
 *
 * `respectAppBottomNav` is intentionally removed — it caused floating sheets / empty floors.
 */
export function buildVisualViewportPinStyle(frame, opts = {}) {
  const recipe = resolveRecipe(opts)
  const keyboardOpen = (frame?.bottomInset || 0) > KEYBOARD_VIEWPORT_SHRINK_PX
  // Stage 201.48 — vv already ends above the keyboard; safe-area pad here becomes a dead floor.
  const padBottom = keyboardOpen ? '0px' : MOBILE_CHROME_SAFE_PAD_BOTTOM

  if (frame?.heightPx == null) {
    if (recipe === MOBILE_CHROME_RECIPES.ACTION) {
      return {
        top: 'auto',
        bottom: '0px',
        height: 'auto',
        maxHeight: 'min(90dvh, 40rem)',
        paddingBottom: padBottom,
      }
    }
    if (recipe === MOBILE_CHROME_RECIPES.FORM) {
      return {
        top: 0,
        bottom: 'auto',
        height: '100dvh',
        maxHeight: '100dvh',
        paddingBottom: padBottom,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }
    }
    return {
      top: '0.5rem',
      bottom: 'auto',
      maxHeight: 'calc(100dvh - 1rem)',
    }
  }

  if (recipe === MOBILE_CHROME_RECIPES.ACTION) {
    // Real keyboard: lift with bottomInset. Browser chrome inset alone must not float the sheet.
    const bottom = keyboardOpen ? frame.bottomInset || 0 : 0
    return {
      top: 'auto',
      bottom: `${bottom}px`,
      height: 'auto',
      maxHeight: `${Math.max(160, frame.heightPx)}px`,
      paddingBottom: padBottom,
    }
  }

  if (recipe === MOBILE_CHROME_RECIPES.FORM) {
    // Keyboard: pin top+bottom to visualViewport (iOS accessory-bar safe). Idle: fill by height.
    if (keyboardOpen) {
      return {
        top: `${frame.offsetTop}px`,
        bottom: `${frame.bottomInset || 0}px`,
        height: 'auto',
        maxHeight: 'none',
        paddingBottom: padBottom,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }
    }
    const h = Math.max(160, frame.heightPx)
    return {
      top: `${frame.offsetTop}px`,
      bottom: 'auto',
      height: `${h}px`,
      maxHeight: `${h}px`,
      paddingBottom: padBottom,
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
    }
  }

  // dialog
  return {
    top: `calc(${frame.offsetTop}px + 0.5rem)`,
    bottom: 'auto',
    maxHeight: `calc(${frame.heightPx}px - 1rem)`,
  }
}

export default useVisualViewportFrame
