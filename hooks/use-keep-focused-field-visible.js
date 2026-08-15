'use client'

import { useEffect } from 'react'
import {
  ensureFocusedFieldVisible,
  isEditableFocusTarget,
  scheduleEnsureFocusedFieldVisible,
} from '@/lib/layout/keep-focused-field-visible'

/**
 * Keep focused inputs in the visualViewport (above the soft keyboard).
 * Stage 201.51 / 201.52 — listens on `document` so portal timing cannot miss focusin.
 *
 * @param {React.RefObject<HTMLElement | null>} rootRef
 * @param {boolean} [enabled=true]
 */
export function useKeepFocusedFieldVisible(rootRef, enabled = true) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined

    let cancelSchedule = () => {}
    /** @type {HTMLElement | null} */
    let activeEl = null

    const rootContains = (node) => {
      const root = rootRef?.current
      if (!root || !node) return false
      try {
        return root.contains(node)
      } catch {
        return false
      }
    }

    const arm = (target) => {
      if (!(target instanceof HTMLElement)) return
      activeEl = target
      cancelSchedule()
      cancelSchedule = scheduleEnsureFocusedFieldVisible(target)
    }

    const onFocusIn = (event) => {
      const target = event.target
      if (!isEditableFocusTarget(target)) return
      if (!(target instanceof HTMLElement)) return
      if (!rootContains(target)) return
      arm(target)
    }

    const onFocusOut = () => {
      window.setTimeout(() => {
        const ae = document.activeElement
        if (!activeEl) return
        if (ae === activeEl) return
        if (rootContains(ae) && isEditableFocusTarget(ae)) {
          arm(ae)
          return
        }
        cancelSchedule()
        activeEl = null
      }, 0)
    }

    const onVv = () => {
      const ae = document.activeElement
      if (ae instanceof HTMLElement && rootContains(ae) && isEditableFocusTarget(ae)) {
        ensureFocusedFieldVisible(ae, { force: true })
      }
    }

    document.addEventListener('focusin', onFocusIn, true)
    document.addEventListener('focusout', onFocusOut, true)
    window.visualViewport?.addEventListener('resize', onVv)
    window.visualViewport?.addEventListener('scroll', onVv)

    const ae = document.activeElement
    if (ae instanceof HTMLElement && rootContains(ae) && isEditableFocusTarget(ae)) {
      arm(ae)
    }

    return () => {
      document.removeEventListener('focusin', onFocusIn, true)
      document.removeEventListener('focusout', onFocusOut, true)
      window.visualViewport?.removeEventListener('resize', onVv)
      window.visualViewport?.removeEventListener('scroll', onVv)
      cancelSchedule()
    }
  }, [rootRef, enabled])
}
