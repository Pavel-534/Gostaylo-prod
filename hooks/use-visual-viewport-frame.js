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
 * Stage 200.134 / 200.135 / ADR-201 / 201.50 — visualViewport frame for mobile overlays.
 *
 * **SSOT (iOS):** when the soft keyboard is open, pin ONLY to the visualViewport
 * rectangle (`top` + `height` + `left` + `width`). Never lift with `bottomInset` —
 * that floats sheets above the iOS form accessory bar.
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
 * Exact visualViewport box — industrial pin for keyboard-open overlays (Stage 201.50).
 * @param {ReturnType<typeof useVisualViewportFrame>} frame
 */
export function buildVisualViewportBoxStyle(frame) {
  const h = Math.max(160, frame?.heightPx || 0)
  const style = {
    top: `${frame?.offsetTop || 0}px`,
    left: `${frame?.offsetLeft || 0}px`,
    bottom: 'auto',
    right: 'auto',
    height: `${h}px`,
    maxHeight: `${h}px`,
    width: frame?.widthPx != null ? `${frame.widthPx}px` : '100%',
    maxWidth: '100%',
    transform: 'none',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    paddingBottom: '0px',
  }
  return style
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
 *
 * - **action** — idle: hug + `bottom: 0` + safe-area. Keyboard: fill vv, `justify-end` (flush to keyboard).
 * - **form** — fill visualViewport; no safe-area while keyboard open.
 * - **dialog** — capped to vv near top (desktop Dialog overrides to center).
 */
export function buildVisualViewportPinStyle(frame, opts = {}) {
  const recipe = resolveRecipe(opts)
  const keyboardOpen = (frame?.bottomInset || 0) > KEYBOARD_VIEWPORT_SHRINK_PX
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

  // Stage 201.50/201.51 — keyboard: exact visualViewport box (scroll body owns fields).
  // Do not use justify-end: it parks CTAs on the keyboard and leaves fields covered.
  if (keyboardOpen && recipe !== MOBILE_CHROME_RECIPES.DIALOG) {
    return {
      ...buildVisualViewportBoxStyle(frame),
      overflow: 'hidden',
    }
  }

  if (recipe === MOBILE_CHROME_RECIPES.ACTION) {
    return {
      top: 'auto',
      bottom: '0px',
      height: 'auto',
      maxHeight: `${Math.max(160, frame.heightPx)}px`,
      paddingBottom: padBottom,
    }
  }

  if (recipe === MOBILE_CHROME_RECIPES.FORM) {
    const h = Math.max(160, frame.heightPx)
    return {
      top: `${frame.offsetTop}px`,
      left: `${frame.offsetLeft || 0}px`,
      bottom: 'auto',
      height: `${h}px`,
      maxHeight: `${h}px`,
      width: frame.widthPx != null ? `${frame.widthPx}px` : '100%',
      maxWidth: '100%',
      transform: 'none',
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
