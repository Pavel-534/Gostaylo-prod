'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  listingWizardStepToSlug,
  resolveListingWizardStepFromParam,
} from '@/lib/partner/listing-wizard-step-slugs.js'

const MIN_STEP = 1
const MAX_STEP = 5

/**
 * Wizard step state + bidirectional URL sync via history.replaceState (Stage 188.0 Post-188).
 *
 * @param {number} initialStep
 * @returns {[number, import('react').Dispatch<import('react').SetStateAction<number>>]}
 */
export function useListingWizardStepUrlSync(initialStep) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [currentStep, setCurrentStepRaw] = useState(initialStep)
  const mountedRef = useRef(false)

  const replaceWizardStepInUrl = useCallback(
    (step) => {
      if (typeof window === 'undefined') return
      const safeStep = Math.min(MAX_STEP, Math.max(MIN_STEP, Number(step) || MIN_STEP))
      const slug = listingWizardStepToSlug(safeStep)
      const params = new URLSearchParams(window.location.search)
      if (params.get('step') === slug) return
      params.set('step', slug)
      const qs = params.toString()
      const href = qs ? `${pathname}?${qs}` : pathname
      window.history.replaceState(window.history.state, '', href)
    },
    [pathname],
  )

  const setCurrentStep = useCallback(
    (next) => {
      setCurrentStepRaw((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next
        const safeStep = Math.min(MAX_STEP, Math.max(MIN_STEP, Number(resolved) || MIN_STEP))
        if (safeStep !== prev) {
          queueMicrotask(() => replaceWizardStepInUrl(safeStep))
        }
        return safeStep
      })
    },
    [replaceWizardStepInUrl],
  )

  /** External navigation (?step=…) — update state without redundant URL write. */
  useEffect(() => {
    const step = resolveListingWizardStepFromParam(searchParams.get('step'))
    if (step) setCurrentStepRaw(step)
  }, [searchParams])

  /** First paint: ensure address bar reflects current step (F5 / draft restore without ?step). */
  useEffect(() => {
    if (mountedRef.current || typeof window === 'undefined') return
    mountedRef.current = true
    const fromUrl = resolveListingWizardStepFromParam(searchParams.get('step'))
    replaceWizardStepInUrl(fromUrl || currentStep)
  }, [searchParams, currentStep, replaceWizardStepInUrl])

  return [currentStep, setCurrentStep]
}
