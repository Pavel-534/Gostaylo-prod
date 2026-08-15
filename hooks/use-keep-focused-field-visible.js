'use client'

import { useEffect } from 'react'
import {
  isEditableFocusTarget,
  scheduleEnsureFocusedFieldVisible,
} from '@/lib/layout/keep-focused-field-visible'

/**
 * While `rootRef` hosts an overlay, keep focused inputs in the visualViewport
 * (above the soft keyboard). Stage 201.51.
 *
 * @param {React.RefObject<HTMLElement | null>} rootRef
 * @param {boolean} [enabled=true]
 */
export function useKeepFocusedFieldVisible(rootRef, enabled = true) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined
    const root = rootRef?.current
    if (!root) return undefined

    let cancelSchedule = () => {}

    const onFocusIn = (event) => {
      const target = event.target
      if (!isEditableFocusTarget(target)) return
      if (!(target instanceof HTMLElement)) return
      if (!root.contains(target)) return
      cancelSchedule()
      cancelSchedule = scheduleEnsureFocusedFieldVisible(target)
    }

    root.addEventListener('focusin', onFocusIn)
    return () => {
      root.removeEventListener('focusin', onFocusIn)
      cancelSchedule()
    }
  }, [rootRef, enabled])
}
